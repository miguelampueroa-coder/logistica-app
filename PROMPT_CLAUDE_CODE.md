# PROMPT PARA CONTINUAR ENVIAZO EN CLAUDE CODE

Eres un ingeniero full-stack trabajando en **Enviazo** — plataforma de envíos tipo Uber desde Puerto Montt, Chile. Backend Express/TypeScript, Supabase (PostgreSQL), Next.js web, Expo React Native mobile.

## Estado actual del proyecto

### ✅ Completado
- Backend completo: auth, CRUD shipments, payments, tracking, uploads, admin
- WhatsApp Logistics AI: 19 archivos (Fase 1 + 2), 77 tests unitarios
- Pagos: Stripe + Webpay + Cash, integrados en order flow
- Notificaciones: Push (FCM) + Email (Resend/SMTP), integradas en order flow
- Tracking GPS + WebSocket en tiempo real
- Background jobs: BullMQ + Redis (6 colas)
- Mapas: Google Maps + Nominatim/OSRM fallback
- File uploads: Multer + Sharp (thumbnails)
- Cache Redis + fallback in-memory
- Logging Pino + HTTP logger
- Graceful shutdown (SIGTERM, SIGINT, workers, Redis)
- Health check real (DB, Redis, disco, sistema)
- Rate limiting por company en WhatsApp
- Verificación firma webhooks WhatsApp
- CI/CD GitHub Actions (lint + typecheck + test + build + docker)
- Push registration endpoint
- 12 tests de integración del flow completo (create → accept → pickup → deliver → cancel)
- Docker + docker-compose + Nginx + Swagger
- 25 fixes de seguridad
- Renombrado a "enviazo" en todos los package.json y configs
- **Total: 89 tests pasando, 0 errores de tipo, 10,855 líneas TS**

### Directorio del proyecto
```
/Users/spaun/logistica-app/
├── apps/
│   ├── backend/          ← Express API (todo el código)
│   ├── web-client/       ← Next.js (Login, Register, Dashboard layout)
│   └── mobile-provider/  ← Expo (App.tsx + config)
├── supabase/migrations/  ← 001, 002, 003
├── docker-compose.yml
├── nginx.conf
├── .github/workflows/ci.yml
└── package.json          ← "enviazo-app"
```

### Stack técnico
```
Express 4 + TypeScript 5     → apps/backend/src/
Supabase (PostgreSQL)         → supabase/migrations/
BullMQ + ioredis              → background-jobs.ts
Stripe SDK                    → payment.service.ts
Firebase Admin                → push-notification.service.ts
Pino                          → logger.ts
Vitest                        → __tests__/ (5 suites, 89 tests)
Zod                           → validación en controllers y env.ts
ws                            → tracking-websocket.ts
Sharp                         → upload.service.ts
Swagger (OpenAPI 3.0)         → /api-docs
```

### Arquitectura backend
```
src/
├── index.ts               ← Entry point (Express + WS + workers + graceful shutdown)
├── config/                ← env.ts (28 vars), database.ts, swagger.ts
├── middleware/             ← auth.ts (JWT + roles), errorHandler, validate
├── controllers/            ← auth, order, user
├── routes/                 ← auth, orders, tracking, uploads, payments, admin, push
├── services/               ← pricing, payment, maps, tracking, push, email, notification,
│                             background-jobs, cache, upload, logger, health, graceful-shutdown
├── modules/whatsapp/      ← 19 archivos (engine, channels, services, webhook, api)
│   ├── engine/            ← conversation, intent, entity, response builder
│   ├── channels/          ← messaging provider, mock
│   ├── services/          ← quote, order, customer memory, geocoding, audio, image, notification
│   ├── webhook/           ← webhook gateway + signature verification
│   ├── middleware/        ← rate limiter per company
│   └── api/               ← webhook routes, admin routes
└── __tests__/
    ├── whatsapp/          ← 77 tests (intent, entity, response, geocoding)
    └── integration/       ← 12 tests (order lifecycle)
```

### Comandos útiles
```bash
cd /Users/spaun/logistica-app/apps/backend
npm run dev          # Desarrollo con hot-reload
npm test             # 89 tests
npm run typecheck    # 0 errores
npm run build        # Compilar a JS
docker compose up    # Levantar todo (backend + Redis + Nginx)
```

## LO QUE DEBES HACER AHORA

### 🔴 PRIORIDAD MÁXIMA — Producción

#### 1. Configurar Supabase real y correr migrations
- Crear proyecto en supabase.com
- Poner SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY en .env
- Ejecutar migrations 001, 002, 003 en orden
- Verificar que `npm test` sigue pasando con la DB real

#### 2. Docker compose funcional
- Asegurar que `docker compose up` funciona sin errores
- Verificar health check endpoint: `curl http://localhost:3000/health`
- Verificar Redis conectado
- Verificar Swagger en http://localhost:3000/api-docs

#### 3. API keys reales
- Stripe: STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET
- Google Maps: GOOGLE_MAPS_API_KEY (para geocoding en prod)
- Firebase: FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY
- Email: configurar SMTP o Resend
- WhatsApp: WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID + WHATSAPP_VERIFY_TOKEN

### 🟡 PRIORIDAD MEDIA — Features faltantes

#### 4. Frontend web completo (Next.js)
- Completar pages: dashboard, tracking map, payment flow, shipments list, profile
- Conectar con API real
- Responsive design

#### 5. Mobile provider app (Expo/React Native)
- GPS tracking reporting automático al backend (WebSocket)
- Push notification registration (FCM)
- Pantallas: login, available orders, active delivery, earnings

#### 6. Integraciones finales
- Webhook de Meta/WhatsApp: conectar con número real y probar
- Firma de Stripe Webhook en payment.routes.ts
- Notificaciones push: probar que FCM llega al mobile

### 🟢 BAJA PRIORIDAD — Calidad

#### 7. Mejoras
- End-to-end tests con Playwright o Cypress
- Rate limiting configurable por endpoint
- Logs centralizados (opcional: Datadog, Logtail)
- Monitoreo (uptime, alerts)
- Documentación de API en Swagger completar todos los endpoints

## Reglas importantes

1. **NO agregues comentarios explicativos en el código** — el código debe ser auto-documentado
2. **NO cambies la arquitectura establecida** — WhatsApp es solo un canal, toda la lógica está en servicios internos
3. **NO modifiques migraciones existentes** — siempre crea migraciones aditivas (004+)
4. **Sigue el patrón de validación con Zod** — usado en controllers y env.ts
5. **TypeScript estricto** — siempre tipos explícitos
6. **Servicios singleton** — como PaymentService, getCacheService(), getNotificationService()
7. **Prefijo de caché**: 'enviazo' (ya configurado en cache.service.ts)
8. **Service role bypasses RLS** — siempre filtrar por company_id en módulo WhatsApp
9. **Mock providers para dev** — MockMessagingProvider, MockPushProvider existen
10. **Antes de hacer cambios**: lee el archivo, entiende el patrón, y respétalo
11. **Después de cambios**: corre `npm run typecheck && npm test`
12. **El usuario no quiere explicaciones extensas** — sé directo, código conciso

## Endpoints de la API

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | /api/auth/login | - | Login |
| POST | /api/auth/register | - | Register |
| POST | /api/orders | client | Crear envío |
| GET | /api/orders | client | Mis envíos |
| POST | /api/orders/:id/accept | provider | Aceptar envío |
| POST | /api/orders/:id/pickup | provider | Recoger paquete |
| POST | /api/orders/:id/deliver | provider | Entregar |
| POST | /api/orders/:id/cancel | client/provider | Cancelar |
| GET | /api/tracking/:shipmentId | auth | Tracking info |
| GET | /api/tracking/:shipmentId/location | auth | Ubicación actual |
| POST | /api/tracking/:shipmentId/location | provider | Reportar GPS |
| POST | /api/payments/create | auth | Crear pago |
| POST | /api/payments/confirm | auth | Confirmar pago |
| POST | /api/payments/webhook/stripe | - | Webhook Stripe |
| POST | /api/payments/webhook/webpay | - | Webhook Webpay |
| POST | /api/uploads/delivery-evidence | provider | Foto entrega |
| POST | /api/uploads/package-photo | auth | Foto paquete |
| POST | /api/push/register | auth | Registrar FCM token |
| DELETE | /api/push/deregister | auth | Eliminar FCM token |
| GET | /api/push/devices | auth | Listar dispositivos |
| GET | /api/admin/overview | admin | Dashboard stats |
| GET | /api/admin/users | admin | Listar usuarios |
| GET | /api/admin/finance/summary | admin | Reporte financiero |
| GET | /health | - | Health check real |
| GET | /api-docs | - | Swagger UI |
| WS | /ws/tracking?token= | auth | Tracking real-time |
| POST | /webhook/whatsapp | - | Webhook WhatsApp |
| GET | /webhook/whatsapp | - | Verify WhatsApp |

## Estados de Shipment
```
pending → accepted → in_transit → delivered
  ↓          ↓
cancelled  cancelled
```

## Modelo de pricing
- Base: 700 CLP/km
- Urgencia: +300 CLP
- Sobrepeso/volumen: recargos
- Vehículo: multiplicador según tipo
