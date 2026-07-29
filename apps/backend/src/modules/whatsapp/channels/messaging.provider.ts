import { MessagingProvider, OutgoingMessage, IncomingMessage } from '../types/index.js';

// --- WhatsApp Cloud API Provider (Meta) ---

export class WhatsAppCloudProvider implements MessagingProvider {
  readonly channel = 'whatsapp' as const;

  private apiUrl: string;
  private accessToken: string;
  private phoneNumberId: string;
  private verifyToken: string;

  constructor(config: {
    accessToken: string;
    phoneNumberId: string;
    verifyToken: string;
    apiVersion?: string;
  }) {
    this.accessToken = config.accessToken;
    this.phoneNumberId = config.phoneNumberId;
    this.verifyToken = config.verifyToken;
    this.apiUrl = `https://graph.facebook.com/${config.apiVersion || 'v18.0'}`;
  }

  async sendMessage(msg: OutgoingMessage): Promise<{ messageId: string; success: boolean }> {
    const body: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      to: msg.to,
      type: msg.type,
    };

    if (msg.type === 'text' && msg.content) {
      body.text = { body: msg.content };
    } else if (msg.type === 'image' && msg.mediaUrl) {
      body.image = { link: msg.mediaUrl };
    } else if (msg.type === 'document' && msg.mediaUrl) {
      body.document = { link: msg.mediaUrl, filename: msg.content || 'document' };
    } else if (msg.type === 'location' && msg.content) {
      const loc = JSON.parse(msg.content);
      body.location = { latitude: loc.lat, longitude: loc.lng, name: loc.name };
    } else if (msg.templateName) {
      body.type = 'template';
      body.template = {
        name: msg.templateName,
        language: { code: 'es' },
        components: this.buildTemplateComponents(msg.templateParams),
      };
    }

    const response = await fetch(`${this.apiUrl}/${this.phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`WhatsApp API error: ${JSON.stringify(error)}`);
    }

    const result = await response.json() as { messages: Array<{ id: string }> };
    return { messageId: result.messages?.[0]?.id || '', success: true };
  }

  async sendTemplate(to: string, templateName: string, params: Record<string, string>): Promise<{ messageId: string }> {
    const result = await this.sendMessage({
      to,
      channel: 'whatsapp',
      type: 'text',
      templateName,
      templateParams: params,
    });
    return { messageId: result.messageId };
  }

  async downloadMedia(mediaId: string): Promise<Buffer> {
    const mediaResponse = await fetch(`${this.apiUrl}/${mediaId}`, {
      headers: { 'Authorization': `Bearer ${this.accessToken}` },
    });
    if (!mediaResponse.ok) throw new Error(`Failed to fetch media URL: ${mediaResponse.status}`);

    const mediaData = await mediaResponse.json() as { url: string };
    const fileResponse = await fetch(mediaData.url, {
      headers: { 'Authorization': `Bearer ${this.accessToken}` },
    });
    if (!fileResponse.ok) throw new Error(`Failed to download media: ${fileResponse.status}`);

    const arrayBuffer = await fileResponse.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  verifyWebhook(body: Record<string, unknown>): boolean {
    return body['hub.mode'] === 'subscribe' && body['hub.verify_token'] === this.verifyToken;
  }

  parseWebhook(body: Record<string, unknown>): IncomingMessage[] {
    const messages: IncomingMessage[] = [];
    const entries = (body.entry || []) as Array<{
      changes: Array<{
        value: { messages?: unknown[]; contacts?: unknown[]; metadata?: Record<string, unknown> };
      }>;
    }>;

    for (const entry of entries) {
      for (const change of entry.changes) {
        const value = change.value;
        const rawMessages = (value.messages || []) as Array<Record<string, unknown>>;
        const contacts = (value.contacts || []) as Array<Record<string, unknown>>;

        for (const msg of rawMessages) {
          const contact = contacts.find(
            (c: Record<string, unknown>) => c.wa_id === msg.from
          ) as Record<string, unknown> | undefined;

          messages.push({
            id: msg.id as string,
            channel: 'whatsapp',
            from: msg.from as string,
            to: (value.metadata?.display_phone_number as string) || '',
            type: this.mapMessageType(msg.type as string),
            content: this.extractContent(msg),
            mediaUrl: this.extractMediaId(msg),
            mediaMimeType: this.extractMediaMimeType(msg),
            location: msg.location as { lat: number; lng: number; address?: string } | undefined,
            contact: this.extractContact(msg),
            timestamp: new Date(parseInt(msg.timestamp as string) * 1000),
            rawPayload: msg,
          });

          if (contact?.name) {
            messages[messages.length - 1].contact = {
              name: contact.name as string,
              phone: (contact.wa_id as string) || '',
            };
          }
        }
      }
    }

    return messages;
  }

  private mapMessageType(type: string): IncomingMessage['type'] {
    const map: Record<string, IncomingMessage['type']> = {
      text: 'text', image: 'image', video: 'video', audio: 'audio',
      document: 'document', location: 'location', contacts: 'contact', sticker: 'sticker',
    };
    return map[type] || 'text';
  }

  private extractContent(msg: Record<string, unknown>): string {
    if (msg.text && typeof msg.text === 'object') return (msg.text as { body: string }).body || '';
    if (msg.caption) return msg.caption as string;
    if (msg.text) return msg.text as string;
    return '';
  }

  private extractMediaId(msg: Record<string, unknown>): string | undefined {
    for (const type of ['image', 'document', 'video', 'audio']) {
      const media = msg[type] as Record<string, unknown> | undefined;
      if (media?.id) return media.id as string;
    }
    return undefined;
  }

  private extractMediaMimeType(msg: Record<string, unknown>): string | undefined {
    for (const type of ['image', 'document', 'video', 'audio']) {
      const media = msg[type] as Record<string, unknown> | undefined;
      if (media?.mime_type) return media.mime_type as string;
    }
    return undefined;
  }

  private extractContact(msg: Record<string, unknown>): { name: string; phone: string } | undefined {
    const contacts = msg.contacts as Array<{ name: { formatted_name: string }; phone: string }> | undefined;
    if (contacts && contacts.length > 0) {
      return { name: contacts[0].name.formatted_name, phone: contacts[0].phone };
    }
    return undefined;
  }

  private buildTemplateComponents(params?: Record<string, string>): unknown[] {
    if (!params) return [];
    return Object.entries(params).map(([key, value]) => ({
      type: 'body',
      parameters: [{ type: 'text', text: `${key}: ${value}` }],
    }));
  }
}

// --- Channel Manager ---

export class ChannelManager {
  private providers: Map<string, MessagingProvider> = new Map();

  register(provider: MessagingProvider): void {
    this.providers.set(provider.channel, provider);
  }

  get(channel: string): MessagingProvider | undefined {
    return this.providers.get(channel);
  }

  getRequired(channel: string): MessagingProvider {
    const provider = this.providers.get(channel);
    if (!provider) throw new Error(`No provider registered for channel: ${channel}`);
    return provider;
  }

  getRegisteredChannels(): string[] {
    return Array.from(this.providers.keys());
  }
}
