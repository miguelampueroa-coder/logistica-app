import { getSupabaseAdmin } from '../../../config/database.js';
import {
  ConversationContext,
  ConversationRecord,
  ConversationStep,
  DispatchOrderData,
  IncomingMessage,
  REQUIRED_ORDER_FIELDS,
} from '../types/index.js';
import { IntentClassifier } from './intent.classifier.js';
import { EntityExtractor } from './entity.extractor.js';
import { ResponseBuilder } from './response.builder.js';
import { QuoteService } from '../services/quote.service.js';
import { OrderService } from '../services/order.service.js';
import { CustomerMemory } from '../services/customer.memory.js';
import { GeocodingService } from '../services/geocoding.service.js';
import { AudioTranscriptionService } from '../services/audio-transcription.service.js';
import { ImageAnalysisService } from '../services/image-analysis.service.js';
import { ChannelManager } from '../channels/messaging.provider.js';

export class ConversationEngine {
  private intentClassifier: IntentClassifier;
  private entityExtractor: EntityExtractor;
  private responseBuilder: ResponseBuilder;
  private quoteService: QuoteService;
  private orderService: OrderService;
  private customerMemory: CustomerMemory;
  private geocodingService: GeocodingService;
  private audioService: AudioTranscriptionService;
  private imageService: ImageAnalysisService;
  private channelManager: ChannelManager;

  constructor(
    intentClassifier: IntentClassifier,
    entityExtractor: EntityExtractor,
    responseBuilder: ResponseBuilder,
    quoteService: QuoteService,
    orderService: OrderService,
    customerMemory: CustomerMemory,
    geocodingService: GeocodingService,
    audioService: AudioTranscriptionService,
    imageService: ImageAnalysisService,
    channelManager: ChannelManager
  ) {
    this.intentClassifier = intentClassifier;
    this.entityExtractor = entityExtractor;
    this.responseBuilder = responseBuilder;
    this.quoteService = quoteService;
    this.orderService = orderService;
    this.customerMemory = customerMemory;
    this.geocodingService = geocodingService;
    this.audioService = audioService;
    this.imageService = imageService;
    this.channelManager = channelManager;
  }

  async processMessage(
    msg: IncomingMessage,
    companyId: string
  ): Promise<void> {
    const supabase = getSupabaseAdmin();
    let customerText = msg.content || '';

    // Handle audio messages — transcribe to text
    if (msg.type === 'audio' && msg.mediaUrl) {
      try {
        const audioBuffer = await this.fetchMedia(msg.mediaUrl);
        const transcript = await this.audioService.transcribe(audioBuffer, 'audio/ogg');
        customerText = transcript.text;
        console.log(`[Engine] Audio transcribed: "${customerText}"`);
      } catch (error) {
        console.error('[Engine] Audio transcription failed:', error);
        customerText = '[Audio no procesable]';
      }
    }

    // Handle image messages — analyze content
    if (msg.type === 'image' && msg.mediaUrl) {
      try {
        const imageBuffer = await this.fetchMedia(msg.mediaUrl);
        const analysis = await this.imageService.analyze(imageBuffer, 'image/jpeg');
        console.log(`[Engine] Image analyzed:`, analysis);

        // If in order flow, enrich draft with image data
        const contextForImage = this.parseContext({}); // temporary
        if (analysis.type === 'package') {
          // Store analysis for later use in package description step
          (msg as IncomingMessage & { _imageAnalysis?: typeof analysis })._imageAnalysis = analysis;
        }
        if (analysis.ocrText) {
          customerText = analysis.ocrText;
        }
      } catch (error) {
        console.error('[Engine] Image analysis failed:', error);
      }
    }

    // Log inbound CRM interaction
    await this.logCrmInteraction(companyId, undefined, 'message_received', {
      phone: msg.from,
      channel: msg.channel,
    });

    // Get or create conversation
    const conversation = await this.getOrCreateConversation(
      msg.from, companyId, msg.channel, supabase
    );

    // Store inbound message
    await this.storeMessage(conversation.id, 'inbound', msg.type, customerText, msg.id, supabase);

    // Update last message timestamp
    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversation.id);

    // If in human handoff mode, don't auto-reply
    if (conversation.status === 'pending_human') {
      return;
    }

    // Parse context from JSON
    const context = this.parseContext(conversation.context);

    // Classify intent (but in active flow, prioritize continuing the flow)
    const intentResult = this.intentClassifier.classify(customerText);
    const isFlowActive = context.currentStep.startsWith('collecting_') || context.currentStep === 'confirming_quote';

    // Extract entities
    const entities = this.entityExtractor.extract(customerText);

    // Handle location shares
    if (msg.location) {
      const addr = this.entityExtractor.extractLocationFromShared(msg.location);
      if (context.currentStep === 'collecting_origin') {
        context.draftOrder.originAddress = addr.address;
        context.draftOrder.originLat = addr.lat;
        context.draftOrder.originLng = addr.lng;
      } else if (context.currentStep === 'collecting_destination') {
        context.draftOrder.destAddress = addr.address;
        context.draftOrder.destLat = addr.lat;
        context.draftOrder.destLng = addr.lng;
      }
    }

    // Handle contact shares
    if (msg.contact) {
      const recipient = this.entityExtractor.extractContactFromShared(msg.contact);
      context.draftOrder.destContactName = recipient.name;
      context.draftOrder.destContactPhone = recipient.phone;
    }

    // Merge extracted entities into draft
    this.mergeEntities(context, entities);

    // Check customer memory for aliases (fuzzy matching)
    if (entities.origin?.label) {
      const resolved = await this.customerMemory.resolveAliasFuzzy(companyId, msg.from, entities.origin.label);
      if (resolved) {
        context.draftOrder.originAddress = resolved.address;
        context.draftOrder.originLat = resolved.lat;
        context.draftOrder.originLng = resolved.lng;
      }
    }

    // Determine reply
    let reply: string;

    // Priority: if in active order flow and no explicit intent override, continue the flow
    if (isFlowActive && !this.isIntentOverride(intentResult.intent)) {
      reply = await this.continueOrderFlow(conversation, context, customerText, companyId, supabase);
    } else {
      switch (intentResult.intent) {
        case 'human_request':
          await this.transferToHuman(conversation.id, companyId, supabase);
          reply = this.responseBuilder.humanHandoff();
          break;

        case 'cancel_order':
          reply = await this.handleCancel(conversation, context, supabase);
          break;

        case 'track_order':
          reply = await this.handleTrack(conversation, supabase);
          break;

        case 'greet':
          reply = this.responseBuilder.greeting();
          context.currentStep = 'collecting_intent';
          context.turnCount = 0;
          break;

        case 'goodbye':
          reply = this.responseBuilder.goodbye();
          break;

        case 'ask_help':
          reply = this.responseBuilder.help();
          break;

        case 'create_order':
        case 'quote_order':
          context.currentStep = 'collecting_intent';
          reply = await this.continueOrderFlow(conversation, context, customerText, companyId, supabase);
          break;

        default:
          reply = await this.handleAmbiguous(conversation, context, companyId, supabase);
          break;
      }
    }

    // Store outbound message
    await this.storeMessage(conversation.id, 'outbound', 'text', reply, undefined, supabase);

    // Log outbound CRM interaction
    await this.logCrmInteraction(companyId, conversation.id, 'message_sent', {
      intent: intentResult.intent,
      confidence: intentResult.confidence,
      step: context.currentStep,
    });

    // Save updated context
    context.turnCount++;
    await supabase
      .from('conversations')
      .update({ context: context as unknown as Record<string, unknown> })
      .eq('id', conversation.id);

    // Send reply via channel
    const provider = this.channelManager.get(msg.channel);
    if (provider) {
      await provider.sendMessage({
        to: msg.from,
        channel: msg.channel,
        type: 'text',
        content: reply,
      });
    }
  }

  private continueOrderFlow(
    conversation: ConversationRecord,
    context: ConversationContext,
    customerText: string,
    companyId: string,
    supabase: ReturnType<typeof getSupabaseAdmin>
  ): Promise<string> {
    // Store the customer text in context so state machine can use it
    (context as ConversationContext & { _customerText?: string })._customerText = customerText;
    return this.handleOrderFlow(conversation, context, companyId, supabase);
  }

  private async handleOrderFlow(
    conversation: ConversationRecord,
    context: ConversationContext,
    companyId: string,
    supabase: ReturnType<typeof getSupabaseAdmin>
  ): Promise<string> {
    const draft = context.draftOrder;
    const customerText = (context as ConversationContext & { _customerText?: string })._customerText || '';

    switch (context.currentStep) {
      case 'greeting':
      case 'collecting_intent':
        context.currentStep = 'collecting_origin';
        return this.responseBuilder.askOrigin();

      case 'collecting_origin': {
        // If we have address but no coordinates, try geocoding
        if (draft.originAddress && !draft.originLat) {
          const results = await this.geocodingService.geocode(draft.originAddress, 3);
          if (results.length === 1) {
            draft.originLat = results[0].lat;
            draft.originLng = results[0].lng;
          } else if (results.length > 1) {
            return this.responseBuilder.ambiguousAddress(results.map(r => r.displayName));
          }
        }
        if (draft.originAddress && draft.originLat) {
          context.currentStep = 'collecting_destination';
          return this.responseBuilder.confirmOriginAndAskDestination(draft.originAddress);
        }
        return this.responseBuilder.askOrigin();
      }

      case 'collecting_destination': {
        // If we have address but no coordinates, try geocoding
        if (draft.destAddress && !draft.destLat) {
          const results = await this.geocodingService.geocode(draft.destAddress, 3);
          if (results.length === 1) {
            draft.destLat = results[0].lat;
            draft.destLng = results[0].lng;
          } else if (results.length > 1) {
            return this.responseBuilder.ambiguousAddress(results.map(r => r.displayName));
          }
        }
        if (draft.destAddress && draft.destLat) {
          context.currentStep = 'collecting_recipient';
          return this.responseBuilder.confirmDestinationAndAskRecipient(draft.destAddress);
        }
        return this.responseBuilder.askDestination();
      }

      case 'collecting_recipient':
        if (draft.destContactName && draft.destContactPhone) {
          context.currentStep = 'collecting_package';
          return this.responseBuilder.confirmRecipientAndAskPackage(
            draft.destContactName, draft.destContactPhone
          );
        }
        return this.responseBuilder.askRecipient();

      case 'collecting_package':
        if (draft.packageDescription && draft.packageWeightKg && draft.packageLengthCm) {
          context.currentStep = 'confirming_quote';
          const quote = await this.quoteService.calculate(draft);
          // Store quote temporarily in context
          (context as ConversationContext & { _lastQuote?: { totalPrice: number } })._lastQuote = quote;
          return this.responseBuilder.orderSummary(draft, quote);
        }
        return this.responseBuilder.askPackage();

      case 'confirming_quote': {
        const text = customerText.toLowerCase().trim();

        if (/\b(?:sí|si|confirmo|confirmar|dale|ok|perfecto|bueno|yes|yep|de acuerdo)\b/i.test(text)) {
          // Resolve customer phone for order creation
          const customerPhone = conversation.customer_phone;
          const result = await this.orderService.createFromChat(
            companyId, conversation.id, draft, customerPhone
          );

          if (result.success) {
            context.currentStep = 'completed';
            context.activeOrderId = result.orderId;

            // Auto-save addresses as aliases for future use
            await this.customerMemory.autoSaveFromOrder(
              companyId, conversation.customer_phone, draft
            );

            // Log CRM
            await this.logCrmInteraction(companyId, conversation.id, 'order_created', {
              shipment_id: result.orderId,
              total_price: draft,
            });

            return this.responseBuilder.orderCreated(result.orderId!);
          }
          return this.responseBuilder.orderError(result.error || 'Error desconocido');
        }

        if (/\b(?:no|cancelar|mejor no|olvídalo|olvidalo|nah)\b/i.test(text)) {
          context.currentStep = 'collecting_origin';
          context.draftOrder = {};
          return this.responseBuilder.orderCancelledStart();
        }

        return this.responseBuilder.confirmOrder();
      }

      case 'completed':
        context.currentStep = 'collecting_intent';
        return this.responseBuilder.askWhatElse();

      default:
        context.currentStep = 'collecting_intent';
        return this.responseBuilder.askWhatElse();
    }
  }

  private isIntentOverride(intent: string): boolean {
    // These intents should override an active flow
    return ['human_request', 'cancel_order', 'track_order', 'greet', 'goodbye', 'ask_help'].includes(intent);
  }

  private async handleCancel(
    conversation: ConversationRecord,
    context: ConversationContext,
    supabase: ReturnType<typeof getSupabaseAdmin>
  ): Promise<string> {
    if (context.activeOrderId) {
      const { data: dispatchOrder } = await supabase
        .from('dispatch_orders')
        .select('id, shipment_id, status')
        .eq('conversation_id', conversation.id)
        .eq('status', 'submitted')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (dispatchOrder?.shipment_id) {
        await this.orderService.cancelShipment(dispatchOrder.shipment_id);
        await supabase
          .from('dispatch_orders')
          .update({ status: 'cancelled' })
          .eq('id', dispatchOrder.id);

        context.activeOrderId = undefined;
        context.currentStep = 'completed';

        await this.logCrmInteraction(conversation.company_id, conversation.id, 'order_cancelled', {
          shipment_id: dispatchOrder.shipment_id,
        });

        return this.responseBuilder.orderCancelled();
      }
    }
    return this.responseBuilder.noActiveOrder();
  }

  private async handleTrack(
    conversation: ConversationRecord,
    supabase: ReturnType<typeof getSupabaseAdmin>
  ): Promise<string> {
    const { data: dispatchOrder } = await supabase
      .from('dispatch_orders')
      .select('id, shipment_id, status')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (dispatchOrder?.shipment_id) {
      const shipment = await this.orderService.getShipmentStatus(dispatchOrder.shipment_id);
      if (shipment) {
        return this.responseBuilder.trackingInfo(shipment as {
          status: string;
          origin_address?: string;
          dest_address?: string;
          total_price?: number;
          picked_up_at?: string;
          delivered_at?: string;
        });
      }
    }
    return this.responseBuilder.noActiveOrder();
  }

  private async handleAmbiguous(
    conversation: ConversationRecord,
    context: ConversationContext,
    companyId: string,
    supabase: ReturnType<typeof getSupabaseAdmin>
  ): Promise<string> {
    if (context.currentStep.startsWith('collecting_')) {
      switch (context.currentStep) {
        case 'collecting_origin':
          return this.responseBuilder.askOrigin();
        case 'collecting_destination':
          return this.responseBuilder.askDestination();
        case 'collecting_recipient':
          return this.responseBuilder.askRecipient();
        case 'collecting_package':
          return this.responseBuilder.askPackage();
      }
    }
    return this.responseBuilder.fallback();
  }

  private async transferToHuman(
    conversationId: string,
    companyId: string,
    supabase: ReturnType<typeof getSupabaseAdmin>
  ): Promise<void> {
    await supabase
      .from('conversations')
      .update({ status: 'pending_human' })
      .eq('id', conversationId);

    await this.logCrmInteraction(companyId, conversationId, 'escalated', {});
  }

  private mergeEntities(
    context: ConversationContext,
    entities: { origin?: { address: string; lat?: number; lng?: number }; destination?: { address: string; lat?: number; lng?: number }; recipient?: { name?: string; phone?: string }; package?: { description?: string; weightKg?: number; lengthCm?: number; widthCm?: number; heightCm?: number }; urgency?: boolean }
  ): void {
    const draft = context.draftOrder;

    if (entities.origin) {
      draft.originAddress = entities.origin.address;
      if (entities.origin.lat) draft.originLat = entities.origin.lat;
      if (entities.origin.lng) draft.originLng = entities.origin.lng;
    }
    if (entities.destination) {
      draft.destAddress = entities.destination.address;
      if (entities.destination.lat) draft.destLat = entities.destination.lat;
      if (entities.destination.lng) draft.destLng = entities.destination.lng;
    }
    if (entities.recipient) {
      if (entities.recipient.name) draft.destContactName = entities.recipient.name;
      if (entities.recipient.phone) draft.destContactPhone = entities.recipient.phone;
    }
    if (entities.package) {
      if (entities.package.description) draft.packageDescription = entities.package.description;
      if (entities.package.weightKg) draft.packageWeightKg = entities.package.weightKg;
      if (entities.package.lengthCm) draft.packageLengthCm = entities.package.lengthCm;
      if (entities.package.widthCm) draft.packageWidthCm = entities.package.widthCm;
      if (entities.package.heightCm) draft.packageHeightCm = entities.package.heightCm;
    }
    if (entities.urgency !== undefined) {
      draft.urgency = entities.urgency;
    }
  }

  private async getOrCreateConversation(
    phone: string,
    companyId: string,
    channel: string,
    supabase: ReturnType<typeof getSupabaseAdmin>
  ): Promise<ConversationRecord> {
    const { data: existing } = await supabase
      .from('conversations')
      .select('*')
      .eq('company_id', companyId)
      .eq('customer_phone', phone)
      .eq('channel', channel)
      .not('status', 'eq', 'closed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (existing) return existing as unknown as ConversationRecord;

    const defaultContext: ConversationContext = {
      currentStep: 'greeting',
      draftOrder: {},
      turnCount: 0,
    };

    const { data: created } = await supabase
      .from('conversations')
      .insert({
        company_id: companyId,
        customer_phone: phone,
        channel,
        status: 'active',
        context: defaultContext as unknown as Record<string, unknown>,
      })
      .select()
      .single();

    return created as unknown as ConversationRecord;
  }

  private parseContext(raw: unknown): ConversationContext {
    if (!raw || typeof raw !== 'object') {
      return { currentStep: 'greeting', draftOrder: {}, turnCount: 0 };
    }
    const ctx = raw as Record<string, unknown>;
    return {
      currentStep: (ctx.currentStep as ConversationStep) || 'greeting',
      activeOrderId: ctx.activeOrderId as string | undefined,
      draftOrder: (ctx.draftOrder as Partial<DispatchOrderData>) || {},
      lastIntent: ctx.lastIntent as ConversationContext['lastIntent'],
      turnCount: (ctx.turnCount as number) || 0,
      lastQuestion: ctx.lastQuestion as string | undefined,
    };
  }

  private async storeMessage(
    conversationId: string,
    direction: 'inbound' | 'outbound',
    type: string,
    content: string | undefined,
    providerMessageId: string | undefined,
    supabase: ReturnType<typeof getSupabaseAdmin>
  ): Promise<void> {
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      direction,
      type,
      content,
      provider_message_id: providerMessageId,
    });
  }

  private async fetchMedia(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch media: ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  private async logCrmInteraction(
    companyId: string,
    conversationId: string | undefined,
    interactionType: string,
    metadata: Record<string, unknown>
  ): Promise<void> {
    try {
      const supabase = getSupabaseAdmin();
      await supabase.from('crm_interactions').insert({
        company_id: companyId,
        conversation_id: conversationId,
        interaction_type: interactionType,
        metadata,
      });
    } catch {
      // Silent fail — CRM logging should never crash the flow
    }
  }
}
