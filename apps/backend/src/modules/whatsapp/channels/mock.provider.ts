import { MessagingProvider, OutgoingMessage, IncomingMessage } from '../types/index.js';

// Mock provider for local development and testing.
// Logs messages to console instead of calling real APIs.

let messageCounter = 0;

export class MockMessagingProvider implements MessagingProvider {
  readonly channel = 'whatsapp' as const;

  private sentMessages: Array<{ to: string; content: string; timestamp: Date }> = [];

  async sendMessage(msg: OutgoingMessage): Promise<{ messageId: string; success: boolean }> {
    const messageId = `mock_${Date.now()}_${++messageCounter}`;
    const content = msg.content || msg.templateName || '[media]';

    this.sentMessages.push({
      to: msg.to,
      content,
      timestamp: new Date(),
    });

    console.log(`[MOCK WhatsApp] → ${msg.to}: ${content}`);
    return { messageId, success: true };
  }

  async sendTemplate(to: string, templateName: string, params: Record<string, string>): Promise<{ messageId: string }> {
    const paramStr = Object.entries(params).map(([k, v]) => `${k}=${v}`).join(', ');
    const content = `[Template: ${templateName}] ${paramStr}`;
    const result = await this.sendMessage({ to, channel: 'whatsapp', type: 'text', content });
    return { messageId: result.messageId };
  }

  async downloadMedia(): Promise<Buffer> {
    return Buffer.from('mock-media-content');
  }

  verifyWebhook(body: Record<string, unknown>): boolean {
    return body['hub.mode'] === 'subscribe' && body['hub.verify_token'] === 'mock-verify-token';
  }

  parseWebhook(body: Record<string, unknown>): IncomingMessage[] {
    // For testing: parse a simulated message from a test payload
    if (body._testMessage) {
      const testMsg = body._testMessage as {
        from: string;
        text: string;
        type?: string;
      };
      return [{
        id: `mock_${Date.now()}_${++messageCounter}`,
        channel: 'whatsapp',
        from: testMsg.from,
        to: 'mock-business',
        type: (testMsg.type as IncomingMessage['type']) || 'text',
        content: testMsg.text,
        timestamp: new Date(),
        rawPayload: body,
      }];
    }
    return [];
  }

  getSentMessages(): Array<{ to: string; content: string; timestamp: Date }> {
    return [...this.sentMessages];
  }

  getLastMessage(): { to: string; content: string; timestamp: Date } | undefined {
    return this.sentMessages[this.sentMessages.length - 1];
  }

  clearHistory(): void {
    this.sentMessages = [];
  }
}
