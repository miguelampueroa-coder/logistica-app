import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default('24h'),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:3001'),
  MAX_FILE_SIZE: z.coerce.number().default(10485760),
  SERVER_URL: z.string().optional(),

  // Payments
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  WEBPAY_COMMERCE_CODE: z.string().optional(),
  WEBPAY_API_KEY: z.string().optional(),
  WEBPAY_ENVIRONMENT: z.enum(['development', 'production']).default('development'),

  // Maps
  GOOGLE_MAPS_API_KEY: z.string().optional(),

  // Firebase (Push Notifications)
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),

  // Redis (Background Jobs)
  REDIS_URL: z.string().default('redis://localhost:6379'),
  LOCATION_HISTORY_RETENTION_DAYS: z.coerce.number().default(90),

  // Bucket privado de Supabase Storage para evidencias y documentos. En
  // produccion es obligatorio: sin el, los archivos irian al disco del
  // servidor, que Vercel borra en cada despliegue.
  SUPABASE_STORAGE_BUCKET: z.string().optional(),

  // Bloquea a los prestadores sin documento aprobado. Viene apagado: si se
  // enciende antes de tener prestadores verificados, nadie puede trabajar.
  REQUIRE_PROVIDER_VERIFICATION: z.enum(['true', 'false']).default('false'),

  // A donde manda el enlace del correo de recuperacion de contrasena. Tiene que
  // estar en la lista de redirects permitidos del proyecto Supabase, si no
  // Supabase ignora el enlace y manda al sitio por defecto.
  PASSWORD_RESET_REDIRECT_URL: z.string().url().optional(),

  // Email
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('noreply@enviazo.cl'),

  // File Uploads
  UPLOAD_DIR: z.string().default('./uploads'),

  // WhatsApp Logistics AI
  WHATSAPP_ENABLED: z.coerce.boolean().default(false),
  WHATSAPP_WEBHOOK_SECRET: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_API_VERSION: z.string().default('v18.0'),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().optional(),
  WHATSAPP_DEFAULT_COMPANY_ID: z.string().optional(),
  WHATSAPP_VERIFY_SIGNATURE: z.coerce.boolean().default(true),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
