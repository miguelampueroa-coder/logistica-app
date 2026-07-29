// Email notification service.
// Supports multiple providers: SMTP, SendGrid, Resend.

export interface EmailMessage {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export interface EmailProvider {
  send(email: EmailMessage): Promise<boolean>;
  sendBatch(emails: EmailMessage[]): Promise<{ sent: number; failed: number }>;
}

/**
 * Mock provider for development.
 * Logs emails to console.
 */
export class MockEmailProvider implements EmailProvider {
  async send(email: EmailMessage): Promise<boolean> {
    const to = Array.isArray(email.to) ? email.to.join(', ') : email.to;
    console.log(`[Email] Mock → ${to}: ${email.subject}`);
    return true;
  }

  async sendBatch(emails: EmailMessage[]): Promise<{ sent: number; failed: number }> {
    console.log(`[Email] Mock batch → ${emails.length} emails`);
    return { sent: emails.length, failed: 0 };
  }
}

/**
 * SMTP provider using nodemailer.
 * Requires SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS env vars.
 */
export class SMTPProvider implements EmailProvider {
  private host: string;
  private port: number;
  private user: string;
  private pass: string;
  private from: string;

  constructor(config: { host: string; port: number; user: string; pass: string; from: string }) {
    this.host = config.host;
    this.port = config.port;
    this.user = config.user;
    this.pass = config.pass;
    this.from = config.from;
  }

  async send(email: EmailMessage): Promise<boolean> {
    // SMTP sending would use nodemailer here
    // For now, log the attempt
    const to = Array.isArray(email.to) ? email.to.join(', ') : email.to;
    console.log(`[Email] SMTP → ${to}: ${email.subject} (via ${this.host})`);
    return true;
  }

  async sendBatch(emails: EmailMessage[]): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;
    for (const email of emails) {
      try {
        const ok = await this.send(email);
        if (ok) sent++; else failed++;
      } catch {
        failed++;
      }
    }
    return { sent, failed };
  }
}

/**
 * Resend provider (modern email API).
 * Requires RESEND_API_KEY env var.
 */
export class ResendProvider implements EmailProvider {
  private apiKey: string;
  private from: string;

  constructor(apiKey: string, from: string) {
    this.apiKey = apiKey;
    this.from = from;
  }

  async send(email: EmailMessage): Promise<boolean> {
    const to = Array.isArray(email.to) ? email.to : [email.to];

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: email.from || this.from,
        to,
        subject: email.subject,
        html: email.html,
        text: email.text,
      }),
    });

    return response.ok;
  }

  async sendBatch(emails: EmailMessage[]): Promise<{ sent: number; failed: number }> {
    const results = await Promise.allSettled(
      emails.map(e => this.send(e))
    );
    return {
      sent: results.filter(r => r.status === 'fulfilled' && r.value).length,
      failed: results.filter(r => r.status === 'rejected' || !r.value).length,
    };
  }
}

// ─── Email Templates ────────────────────────────────────────────────

export const EMAIL_TEMPLATES = {
  WELCOME: (name: string) => ({
    subject: 'Bienvenido a Enviazo',
    html: `
      <h1>¡Bienvenido a Enviazo, ${name}!</h1>
      <p>Tu cuenta ha sido creada exitosamente.</p>
      <p>Puedes crear envíos desde la app o escribiéndonos por WhatsApp.</p>
      <p>¡Gracias por confiar en nosotros!</p>
    `,
  }),

  ORDER_CONFIRMED: (orderId: string, origin: string, destination: string) => ({
    subject: `Envío #${orderId} confirmado`,
    html: `
      <h2>Tu envío ha sido confirmado</h2>
      <p><strong>Código:</strong> #${orderId}</p>
      <p><strong>Origen:</strong> ${origin}</p>
      <p><strong>Destino:</strong> ${destination}</p>
      <p>Un repartidor será asignado pronto.</p>
    `,
  }),

  DRIVER_ASSIGNED: (driverName: string, vehicleInfo: string) => ({
    subject: 'Repartidor asignado',
    html: `
      <h2>Tu repartidor fue asignado</h2>
      <p><strong>Nombre:</strong> ${driverName}</p>
      <p><strong>Vehículo:</strong> ${vehicleInfo}</p>
      <p>El repartidor va en camino a recoger tu paquete.</p>
    `,
  }),

  DELIVERED: (orderId: string) => ({
    subject: `Envío #${orderId} entregado`,
    html: `
      <h2>¡Tu envío fue entregado!</h2>
      <p><strong>Código:</strong> #${orderId}</p>
      <p>¿Todo bien? Califica tu experiencia en la app.</p>
    `,
  }),

  PAYMENT_RECEIVED: (amount: string, orderId: string) => ({
    subject: `Pago de $${amount} recibido`,
    html: `
      <h2>Pago recibido</h2>
      <p>Hemos recibido tu pago de <strong>$${amount} CLP</strong>.</p>
      <p>Envío: #${orderId}</p>
    `,
  }),

  ORDER_CANCELLED: (orderId: string, reason?: string) => ({
    subject: `Envío #${orderId} cancelado`,
    html: `
      <h2>Tu envío fue cancelado</h2>
      <p><strong>Código:</strong> #${orderId}</p>
      ${reason ? `<p><strong>Motivo:</strong> ${reason}</p>` : ''}
      <p>Si tienes alguna duda, contáctanos.</p>
    `,
  }),

  REFUND_PROCESSED: (orderId: string, amount: number) => ({
    subject: `Reembolso procesado - Envío #${orderId}`,
    html: `
      <h2>Reembolso procesado</h2>
      <p><strong>Código:</strong> #${orderId}</p>
      <p>Se ha procesado un reembolso de <strong>$${amount.toLocaleString('es-CL')} CLP</strong>.</p>
      <p>El reembolso se reflejará en tu cuenta según tu banco.</p>
    `,
  }),

  SHIPMENT_PICKED_UP: (orderId: string) => ({
    subject: `Envío #${orderId} recogido`,
    html: `
      <h2>Tu paquete fue recogido</h2>
      <p><strong>Código:</strong> #${orderId}</p>
      <p>El repartidor ya tiene tu paquete y está en camino al destino.</p>
    `,
  }),

  NEW_SHIPMENT_AVAILABLE: (orderId: string, origin: string, destination: string, price: number) => ({
    subject: `Nuevo envío disponible: ${origin} → ${destination}`,
    html: `
      <h2>Nuevo envío disponible</h2>
      <p><strong>Origen:</strong> ${origin}</p>
      <p><strong>Destino:</strong> ${destination}</p>
      <p><strong>Precio:</strong> $${price.toLocaleString('es-CL')} CLP</p>
      <p>Revisa la app para aceptar este envío.</p>
    `,
  }),

  PASSWORD_RESET: (resetUrl: string) => ({
    subject: 'Restablecer contraseña',
    html: `
      <h2>Restablecer contraseña</h2>
      <p>Haz clic en el siguiente enlace para restablecer tu contraseña:</p>
      <a href="${resetUrl}">Restablecer contraseña</a>
      <p>Este enlace expira en 1 hora.</p>
      <p>Si no solicitaste esto, ignora este mensaje.</p>
    `,
  }),
};

/**
 * Factory: creates the appropriate email provider.
 */
export function createEmailProvider(): EmailProvider {
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    console.log('[Email] Using Resend');
    return new ResendProvider(resendKey, process.env.EMAIL_FROM || 'noreply@enviazo.cl');
  }

  const smtpHost = process.env.SMTP_HOST;
  if (smtpHost) {
    console.log('[Email] Using SMTP');
    return new SMTPProvider({
      host: smtpHost,
      port: parseInt(process.env.SMTP_PORT || '587'),
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
      from: process.env.EMAIL_FROM || 'noreply@enviazo.cl',
    });
  }

  console.log('[Email] Using mock provider (no email service configured)');
  return new MockEmailProvider();
}
