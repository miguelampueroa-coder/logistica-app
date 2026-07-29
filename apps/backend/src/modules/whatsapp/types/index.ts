// ============================================================
// WhatsApp Logistics AI — Types
// ============================================================

// --- Channel Abstraction ---

export type ChannelType = 'whatsapp' | 'telegram' | 'rcs' | 'web' | 'sms';

export type MessageType = 'text' | 'image' | 'audio' | 'location' | 'contact' | 'document' | 'sticker' | 'video';

export type MessageDirection = 'inbound' | 'outbound';

export interface IncomingMessage {
  id: string;
  channel: ChannelType;
  from: string;
  to: string;
  type: MessageType;
  content?: string;
  mediaUrl?: string;
  mediaMimeType?: string;
  location?: { lat: number; lng: number; address?: string };
  contact?: { name: string; phone: string };
  timestamp: Date;
  rawPayload: Record<string, unknown>;
}

export interface OutgoingMessage {
  to: string;
  channel: ChannelType;
  type: MessageType;
  content?: string;
  mediaUrl?: string;
  templateName?: string;
  templateParams?: Record<string, string>;
}

export interface MessagingProvider {
  readonly channel: ChannelType;
  sendMessage(msg: OutgoingMessage): Promise<{ messageId: string; success: boolean }>;
  sendTemplate(to: string, templateName: string, params: Record<string, string>): Promise<{ messageId: string }>;
  downloadMedia(mediaId: string): Promise<Buffer>;
  verifyWebhook(body: Record<string, unknown>, headers: Record<string, string>): boolean;
  parseWebhook(body: Record<string, unknown>): IncomingMessage[];
}

// --- Conversation ---

export type ConversationStatus = 'active' | 'pending_human' | 'closed';

export type ConversationStep =
  | 'greeting'
  | 'collecting_intent'
  | 'collecting_origin'
  | 'collecting_destination'
  | 'collecting_recipient'
  | 'collecting_package'
  | 'confirming_quote'
  | 'confirming_order'
  | 'awaiting_action'
  | 'completed'
  | 'human_handoff';

export interface ConversationContext {
  currentStep: ConversationStep;
  activeOrderId?: string;
  draftOrder: Partial<DispatchOrderData>;
  lastIntent?: IntentType;
  turnCount: number;
  lastQuestion?: string;
}

export interface ConversationRecord {
  id: string;
  company_id: string;
  customer_phone: string;
  customer_name?: string;
  channel: ChannelType;
  status: ConversationStatus;
  context: ConversationContext;
  last_message_at?: string;
  created_at: string;
  updated_at: string;
}

// --- Intent ---

export type IntentType =
  | 'create_order'
  | 'quote_order'
  | 'track_order'
  | 'cancel_order'
  | 'modify_order'
  | 'repeat_order'
  | 'ask_help'
  | 'human_request'
  | 'greet'
  | 'goodbye'
  | 'unknown';

export interface IntentResult {
  intent: IntentType;
  confidence: number;
}

// --- Entity Extraction ---

export interface ExtractedEntities {
  origin?: AddressEntity;
  destination?: AddressEntity;
  recipient?: RecipientEntity;
  package?: PackageEntity;
  urgency?: boolean;
  scheduledAt?: string;
}

export interface AddressEntity {
  address: string;
  lat?: number;
  lng?: number;
  label?: string;
  contactName?: string;
  contactPhone?: string;
}

export interface RecipientEntity {
  name?: string;
  phone?: string;
}

export interface PackageEntity {
  description?: string;
  weightKg?: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
}

// --- Dispatch Order ---

export type DispatchOrderStatus =
  | 'draft'
  | 'collecting_data'
  | 'ready'
  | 'submitted'
  | 'in_progress'
  | 'delivered'
  | 'cancelled';

export type Priority = 'low' | 'normal' | 'high' | 'urgent';

export interface DispatchOrderData {
  originAddress?: string;
  originLat?: number;
  originLng?: number;
  originContactName?: string;
  originContactPhone?: string;
  destAddress?: string;
  destLat?: number;
  destLng?: number;
  destContactName?: string;
  destContactPhone?: string;
  packageDescription?: string;
  packageWeightKg?: number;
  packageLengthCm?: number;
  packageWidthCm?: number;
  packageHeightCm?: number;
  packageDeclaredValue?: number;
  packageNotes?: string;
  urgency?: boolean;
  preferredVehicleType?: string;
}

export interface DispatchOrderRecord {
  id: string;
  company_id: string;
  conversation_id: string;
  shipment_id?: string;
  customer_phone: string;
  customer_name?: string;
  status: DispatchOrderStatus;
  extracted_data: DispatchOrderData;
  missing_fields: string[];
  notes?: string;
  priority: Priority;
  source_channel: ChannelType;
  operator_id?: string;
  created_at: string;
  updated_at: string;
}

// --- Required Fields for Order ---

export const REQUIRED_ORDER_FIELDS = [
  'originAddress',
  'originLat',
  'originLng',
  'destAddress',
  'destLat',
  'destLng',
  'packageDescription',
  'packageWeightKg',
  'packageLengthCm',
  'packageWidthCm',
  'packageHeightCm',
] as const;

// --- Price Breakdown (reuses existing) ---

export interface PriceBreakdown {
  basePrice: number;
  weightFee: number;
  volumeFee: number;
  urgencyFee: number;
  vehicleMultiplier: number;
  totalPrice: number;
}

// --- Company Memory ---

export type MemoryType = 'frequent_address' | 'frequent_recipient' | 'preference' | 'alias' | 'instruction';

export interface MemoryEntry {
  id: string;
  company_id: string;
  customer_phone: string;
  memory_type: MemoryType;
  key: string;
  value: Record<string, unknown>;
  usage_count: number;
  last_used_at: string;
}

// --- CRM ---

export type CrmInteractionType =
  | 'message_received'
  | 'message_sent'
  | 'order_created'
  | 'order_updated'
  | 'order_submitted'
  | 'order_delivered'
  | 'order_cancelled'
  | 'human_takeover'
  | 'ai_handled'
  | 'escalated';

// --- Webhook Event ---

export type WebhookProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'duplicate';

export interface WebhookEventRecord {
  id: string;
  channel: string;
  event_type: string;
  provider_message_id?: string;
  payload: Record<string, unknown>;
  processing_status: WebhookProcessingStatus;
  error?: string;
  idempotency_key?: string;
  created_at: string;
}
