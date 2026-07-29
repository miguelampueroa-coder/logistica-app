// Push notification service using Firebase Cloud Messaging.
// Sends notifications to mobile app users.

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
}

export interface PushResult {
  success: boolean;
  successCount: number;
  failureCount: number;
  errors?: string[];
}

export interface PushNotificationProvider {
  sendToUser(userId: string, payload: PushPayload): Promise<boolean>;
  sendToMultiple(userIds: string[], payload: PushPayload): Promise<PushResult>;
  sendToTopic(topic: string, payload: PushPayload): Promise<boolean>;
}

/**
 * Mock provider for development.
 * Logs notifications to console.
 */
export class MockPushProvider implements PushNotificationProvider {
  async sendToUser(userId: string, payload: PushPayload): Promise<boolean> {
    console.log(`[Push] Mock → User ${userId}: ${payload.title} - ${payload.body}`);
    return true;
  }

  async sendToMultiple(userIds: string[], payload: PushPayload): Promise<PushResult> {
    console.log(`[Push] Mock → ${userIds.length} users: ${payload.title}`);
    return { success: true, successCount: userIds.length, failureCount: 0 };
  }

  async sendToTopic(topic: string, payload: PushPayload): Promise<boolean> {
    console.log(`[Push] Mock → Topic ${topic}: ${payload.title}`);
    return true;
  }
}

/**
 * Firebase Cloud Messaging provider.
 * Requires FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY env vars.
 * Also requires a `fcm_tokens` table in the database.
 */
export class FCMProvider implements PushNotificationProvider {
  private projectId: string;
  private clientEmail: string;
  private privateKey: string;
  private accessToken: string | null = null;
  private tokenExpiry = 0;

  constructor(projectId: string, clientEmail: string, privateKey: string) {
    this.projectId = projectId;
    this.clientEmail = clientEmail;
    this.privateKey = privateKey;
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    // JWT-based auth for FCM
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      iss: this.clientEmail,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })).toString('base64url');

    const crypto = await import('crypto');
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(`${header}.${payload}`);
    const signature = sign.sign(this.privateKey, 'base64url');

    const jwt = `${header}.${payload}.${signature}`;

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    if (!response.ok) {
      throw new Error(`FCM token error: ${response.status}`);
    }

    const data = await response.json() as { access_token: string; expires_in: number };
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
    return this.accessToken;
  }

  async sendToUser(userId: string, payload: PushPayload): Promise<boolean> {
    const { getSupabaseAdmin } = await import('../config/database.js');
    const supabase = getSupabaseAdmin();

    const { data: tokens } = await supabase
      .from('fcm_tokens')
      .select('token')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(5);

    if (!tokens || tokens.length === 0) return false;

    const accessToken = await this.getAccessToken();
    let success = false;

    for (const t of tokens) {
      try {
        const response = await fetch(
          `https://fcm.googleapis.com/v1/projects/${this.projectId}/messages:send`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: {
                token: t.token,
                notification: {
                  title: payload.title,
                  body: payload.body,
                  ...(payload.imageUrl ? { image: payload.imageUrl } : {}),
                },
                data: payload.data || {},
                android: {
                  priority: 'high',
                  notification: { channel_id: 'enviazo_updates' },
                },
                apns: {
                  payload: {
                    aps: {
                      alert: { title: payload.title, body: payload.body },
                      sound: 'default',
                      badge: 1,
                    },
                  },
                },
              },
            }),
          }
        );

        if (response.ok) success = true;
      } catch (err) {
        console.error('[FCM] Send error:', err);
      }
    }

    return success;
  }

  async sendToMultiple(userIds: string[], payload: PushPayload): Promise<PushResult> {
    const results = await Promise.allSettled(
      userIds.map(id => this.sendToUser(id, payload))
    );

    return {
      success: true,
      successCount: results.filter(r => r.status === 'fulfilled' && r.value).length,
      failureCount: results.filter(r => r.status === 'rejected' || !r.value).length,
    };
  }

  async sendToTopic(topic: string, payload: PushPayload): Promise<boolean> {
    const accessToken = await this.getAccessToken();

    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${this.projectId}/messages:send`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            topic,
            notification: {
              title: payload.title,
              body: payload.body,
            },
            data: payload.data || {},
          },
        }),
      }
    );

    return response.ok;
  }
}

/**
 * Factory: creates the appropriate push provider.
 */
export function createPushProvider(): PushNotificationProvider {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (projectId && clientEmail && privateKey) {
    console.log('[Push] Using Firebase Cloud Messaging');
    return new FCMProvider(projectId, clientEmail, privateKey);
  }

  console.log('[Push] Using mock provider (no Firebase configured)');
  return new MockPushProvider();
}
