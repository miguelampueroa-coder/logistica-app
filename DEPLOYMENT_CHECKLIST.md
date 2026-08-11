# 🚀 ENVIAZO — DEPLOYMENT CHECKLIST

**Status: PRODUCTION-READY** (2026-08-11)
**Post-Audit: All 8 fixes applied, 89/89 tests passing**

---

## ✅ COMPLETADO (No requiere cambios)

### Backend (Express + Node.js) — POST-AUDIT FIXES (2026-08-11)
- ✅ Webhooks signature validation (Stripe raw body + Webpay header)
- ✅ Auth cache fix (double JSON.parse eliminated)
- ✅ Memory leaks fixed (EventBus teardown + WebSocket Map cleanup)
- ✅ Resilience improvements (withRetry fallback + null checks + error handling)
- ✅ Arquitectura event-driven (EventBus + subscribers)
- ✅ Auth centralizado (JWT + token refresh + caché 5min)
- ✅ Pagos resilientes (retry exponencial 100/200/400ms)
- ✅ Tracking real-time (WebSocket broadcast)
- ✅ WhatsApp AI (IA conversacional + webhook validation)
- ✅ 89/89 tests passing
- ✅ 0 TypeScript errors

### Móvil (Expo/React Native)
- ✅ GPS automático (cada 15s)
- ✅ Push notifications + background
- ✅ Deep linking (`enviazo://shipments/:id`)
- ✅ Todas las pantallas
- ✅ Error handling
- ✅ EAS build config
- ✅ 0 TypeScript errors

### Web Client (Next.js)
- ✅ Auth completo
- ✅ Dashboard + tracking
- ✅ Nuevo envío + pagos
- ✅ Mapa tiempo real
- ✅ 0 TypeScript errors

---

## 🔴 REQUIERE CREDENCIALES (Solo datos, no código)

### 1. STRIPE
Necesita:
- `STRIPE_API_KEY` (secret key)
- `STRIPE_WEBHOOK_SECRET`

Dónde: 
- Backend: `apps/backend/.env`
- Usado en: Pagos con tarjeta + webhook

### 2. GOOGLE MAPS
Necesita:
- `GOOGLE_MAPS_API_KEY`

Dónde:
- Backend: `apps/backend/.env`
- Usado en: Geocoding + rutas

### 3. FIREBASE (FCM)
Necesita:
- `FIREBASE_PROJECT_ID`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_CLIENT_EMAIL`

Dónde:
- Backend: `apps/backend/.env`
- Usado en: Push notifications

### 4. WHATSAPP
Necesita:
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_WEBHOOK_SECRET`

Dónde:
- Backend: `apps/backend/.env`
- Usado en: Módulo WhatsApp AI + webhook

### 5. SMTP/RESEND (Opcional, fallback a console log)
Necesita:
- `RESEND_API_KEY` O `SMTP_HOST`, `SMTP_PORT`, etc.

Dónde:
- Backend: `apps/backend/.env`
- Usado en: Email transaccionales

---

## 📋 PASOS PARA DEPLOYAR

### PASO 1: Completar .env files

**Backend** (`apps/backend/.env`):
```bash
# Supabase (ya configurado si lo conectaste)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=xxxxx
SUPABASE_SERVICE_ROLE_KEY=xxxxx
JWT_SECRET=tu-secret-aleatorio

# Payments
STRIPE_API_KEY=sk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# Google Maps
GOOGLE_MAPS_API_KEY=xxxxx

# Firebase (FCM)
FIREBASE_PROJECT_ID=xxxxx
FIREBASE_PRIVATE_KEY=xxxxx
FIREBASE_CLIENT_EMAIL=xxxxx@xxxxx.iam.gserviceaccount.com

# WhatsApp
WHATSAPP_ACCESS_TOKEN=xxxxx
WHATSAPP_PHONE_NUMBER_ID=xxxxx
WHATSAPP_VERIFY_TOKEN=xxxxx
WHATSAPP_WEBHOOK_SECRET=xxxxx

# Email
RESEND_API_KEY=xxxxx

# Redis (si usas cloud)
REDIS_URL=redis://xxxxx:6379

# Environment
NODE_ENV=production
PORT=3002
CORS_ORIGIN=https://tu-dominio.com
```

**Móvil** (`.env.local` ya está):
```bash
EXPO_PUBLIC_API_URL=https://api.tu-dominio.com
```

**Web Client** (`.env.local` ya está):
```bash
NEXT_PUBLIC_API_URL=https://api.tu-dominio.com
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxx
```

### PASO 2: Verificar Supabase

```bash
# Si NO has conectado Supabase aún:
cd apps/backend
npx supabase db push  # Aplica todas las migraciones (001-006)

# Verify:
npm test  # Debe pasar 89/89 tests contra DB real
```

### PASO 3: Build Backend

```bash
cd apps/backend
npm run build       # Compila TypeScript → dist/
npm start           # Inicia en puerto 3002

# Verify:
curl http://localhost:3002/health
# Debe devolver: {"status":"healthy",...}
```

### PASO 4: Build Móvil

```bash
cd apps/mobile-provider

# Development:
eas build --platform ios --profile preview      # o android

# Production:
eas build --platform ios --profile production
eas build --platform android --profile production

# TestFlight/Play Store:
eas submit --platform ios
eas submit --platform android
```

### PASO 5: Build Web Client

```bash
cd apps/web-client
npm run build       # Next.js static export o SSG
npm start           # Dev server o production

# Verify:
curl http://localhost:3000/api/health (si existe)
# O simplemente abre en navegador
```

### PASO 6: Deploy

**Backend** (Node.js):
- Vercel: `vercel deploy --prod`
- Railway: Conecta repo, auto-deploy
- AWS EC2: `npm run build && pm2 start dist/index.js`

**Móvil**:
- Apple App Store (via TestFlight)
- Google Play Store (via Play Console)
- Ya está en EAS — solo hacer submit

**Web Client**:
- Vercel: `npm run build` auto en deploy
- Netlify: Conecta repo, auto-deploy
- Self-hosted: `npm run build && npm start`

---

## 🧪 TESTING PRE-DEPLOYMENT

```bash
# 1. Backend tests
cd apps/backend
npm test                    # 89/89 deben pasar

# 2. TypeScript
npm run typecheck          # 0 errors

# 3. Manual test de flujo end-to-end
# a. Registra cliente en web
# b. Crea envío nuevo
# c. Verifica en backend que payment_status='pending'
# d. Registra prestador en móvil
# e. Acepta envío en móvil
# f. Verifica GPS se reporta cada 15s
# g. Haz pickup en móvil
# h. Verifica tracking en web (mapa + ETA)
# i. Haz deliver en móvil
# j. Verifica en web que status='delivered'
```

---

## 🔐 SECURITY CHECKLIST

- ✅ RLS habilitado en 20 tablas Supabase
- ✅ JWT firmado con secret aleatorio
- ✅ Webhook Stripe validado con `stripe.webhooks.constructEvent()`
- ✅ Webhook Meta validado con HMAC-SHA256 + timing-safe compare
- ✅ API keys en `.env` (nunca en código)
- ✅ CORS restringido a dominio real
- ✅ Caché de profile + token refresh (sin re-query innecesario)
- ✅ Transactions atómicas en pagos (retry con idempotencia)

---

## 📱 URLS POST-DEPLOYMENT

```
Backend:        https://api.tu-dominio.com
Web Cliente:    https://tu-dominio.com
Móvil:          App Store + Play Store
WhatsApp:       https://api.tu-dominio.com/webhook
Stripe Webhook: https://api.tu-dominio.com/api/payments/webhook/stripe
```

---

## ❓ TROUBLESHOOTING

**"Payment capture failed"**
- Verifica `STRIPE_API_KEY` está en `.env`
- Revisa logs: `cat apps/backend/logs/error.log`

**"GPS no se reporta"**
- Verifica permisos en móvil (iOS/Android)
- Revisa `EXPO_PUBLIC_API_URL` apunta al backend real

**"Tracking mapa no carga"**
- Verifica `GOOGLE_MAPS_API_KEY` en web `.env`
- Revisa WebSocket conecta: `wss://api.tu-dominio.com/ws/tracking`

**"Push notifications no llegan"**
- Verifica `FIREBASE_*` keys en backend `.env`
- Revisa FCM token se registró: `SELECT * FROM fcm_tokens`

---

## 🎯 NEXT STEPS

1. ✅ Código: LISTO
2. ⏳ Credenciales: TU TURNO (Stripe, Google, Firebase, WhatsApp)
3. ⏳ Deploy: TU TURNO (Vercel, Railway, etc.)
4. ⏳ Testing: TU TURNO (flujo end-to-end en producción)
5. ⏳ Go-live: ¡Lanzar!

---

**Versionado: 2026-07-31**
**Estado: PRODUCTION-READY**
**Tests: 89/89 ✅**
**TypeScript: 0 errors ✅**
