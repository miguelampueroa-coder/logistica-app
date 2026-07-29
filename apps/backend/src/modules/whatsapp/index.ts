import { ChannelManager, WhatsAppCloudProvider } from './channels/messaging.provider.js';
import { MockMessagingProvider } from './channels/mock.provider.js';
import { WebhookGateway } from './webhook/webhook.gateway.js';
import { ConversationEngine } from './engine/conversation.engine.js';
import { IntentClassifier } from './engine/intent.classifier.js';
import { EntityExtractor } from './engine/entity.extractor.js';
import { ResponseBuilder } from './engine/response.builder.js';
import { QuoteService } from './services/quote.service.js';
import { OrderService } from './services/order.service.js';
import { CustomerMemory } from './services/customer.memory.js';
import { GeocodingService } from './services/geocoding.service.js';
import { AudioTranscriptionService } from './services/audio-transcription.service.js';
import { ImageAnalysisService } from './services/image-analysis.service.js';
import { NotificationEngine } from './services/notification.engine.js';
import { setNotificationEngine } from './api/admin.routes.js';

export interface WhatsAppModuleConfig {
  enabled: boolean;
  whatsapp?: {
    accessToken: string;
    phoneNumberId: string;
    verifyToken: string;
    apiVersion?: string;
  };
  defaultCompanyId?: string;
}

export class WhatsAppModule {
  readonly channelManager: ChannelManager;
  readonly webhookGateway: WebhookGateway;
  readonly conversationEngine: ConversationEngine;
  readonly notificationEngine: NotificationEngine;
  readonly config: WhatsAppModuleConfig;

  private constructor(
    channelManager: ChannelManager,
    webhookGateway: WebhookGateway,
    conversationEngine: ConversationEngine,
    notificationEngine: NotificationEngine,
    config: WhatsAppModuleConfig
  ) {
    this.channelManager = channelManager;
    this.webhookGateway = webhookGateway;
    this.conversationEngine = conversationEngine;
    this.notificationEngine = notificationEngine;
    this.config = config;
  }

  static create(config: WhatsAppModuleConfig): WhatsAppModule {
    // Channel Manager
    const channelManager = new ChannelManager();

    if (config.whatsapp?.accessToken) {
      // Production: use real WhatsApp Cloud API
      const whatsappProvider = new WhatsAppCloudProvider({
        accessToken: config.whatsapp.accessToken,
        phoneNumberId: config.whatsapp.phoneNumberId,
        verifyToken: config.whatsapp.verifyToken,
        apiVersion: config.whatsapp.apiVersion,
      });
      channelManager.register(whatsappProvider);
    } else {
      // Development: use mock provider
      const mockProvider = new MockMessagingProvider();
      channelManager.register(mockProvider);
      console.log('[WhatsApp Module] Using MOCK provider (no credentials configured)');
    }

    // Engine components
    const intentClassifier = new IntentClassifier();
    const entityExtractor = new EntityExtractor();
    const responseBuilder = new ResponseBuilder();
    const quoteService = new QuoteService();
    const orderService = new OrderService();
    const customerMemory = new CustomerMemory();
    const geocodingService = new GeocodingService();
    const audioService = new AudioTranscriptionService();
    const imageService = new ImageAnalysisService();

    // Conversation Engine
    const conversationEngine = new ConversationEngine(
      intentClassifier,
      entityExtractor,
      responseBuilder,
      quoteService,
      orderService,
      customerMemory,
      geocodingService,
      audioService,
      imageService,
      channelManager
    );

    // Notification Engine
    const notificationEngine = new NotificationEngine(channelManager);
    orderService.setNotificationEngine(notificationEngine);
    setNotificationEngine(notificationEngine);

    // Webhook Gateway
    const webhookGateway = new WebhookGateway(channelManager);
    webhookGateway.setMessageHandler(async (msg) => {
      const companyId = config.defaultCompanyId || '00000000-0000-0000-0000-000000000000';
      await conversationEngine.processMessage(msg, companyId);
    });

    return new WhatsAppModule(channelManager, webhookGateway, conversationEngine, notificationEngine, config);
  }
}
