# Graph Report - logistica-app  (2026-08-11)

## Corpus Check
- 120 files · ~58,570 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1194 nodes · 1976 edges · 73 communities (54 shown, 19 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 28 edges (avg confidence: 0.78)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `20356ac2`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- notification-subscribers.ts
- AppNavigator.tsx
- devDependencies
- devDependencies
- dependencies
- ConversationEngine
- useAuth
- dependencies
- PaymentProvider
- UploadService
- compilerOptions
- order.controller.ts
- whatsapp/types/index.ts
- maps.service.ts
- expo
- whatsapp/index.ts
- compilerOptions
- package.json
- src/types/index.ts
- background-jobs.ts
- MockMessagingProvider
- src/index.ts
- getSupabaseAdmin
- auth-v2.ts
- TrackingWebSocket
- EntityExtractor
- CustomerMemory
- GeocodingService
- CacheService
- WhatsAppCloudProvider
- .constructor
- tracking.routes.ts
- 🗺️ Roadmap de Implementación
- payment.service.ts
- database.ts
- graceful-shutdown.ts
- image-analysis.service.ts
- auth.controller.ts
- ChannelManager
- rate-limiter.ts
- 002_whatsapp_logistics_ai.sql
- 🚀 ENVIAZO — DEPLOYMENT CHECKLIST
- tsconfig.json
- webhook.routes.ts
- supabase.ts
- next.config.js
- next-env.d.ts
- PROMPT PARA CONTINUAR ENVIAZO EN CLAUDE CODE
- 🚚 App de Logística de Envíos
- ENVIAZO — STATUS REPORT (2026-07-31)
- Enviazo — CLAUDE.md
- 🔴 PROBLEMAS COMUNES
- 📋 AUDIT NOTES FOR FABLE
- mobile-provider/package.json
- devDependencies
- expo-location
- expo-notifications
- expo-status-bar
- @expo/vector-icons
- react
- react-native
- react-native-maps
- react-native-safe-area-context
- react-native-url-polyfill
- @react-navigation/bottom-tabs
- @react-navigation/native

## God Nodes (most connected - your core abstractions)
1. `getSupabaseAdmin()` - 73 edges
2. `ConversationEngine` - 29 edges
3. `ResponseBuilder` - 29 edges
4. `express` - 22 edges
5. `useAuth()` - 21 edges
6. `useAuth()` - 21 edges
7. `ChannelManager` - 18 edges
8. `CustomerMemory` - 16 edges
9. `NotificationEngine` - 16 edges
10. `compilerOptions` - 16 edges

## Surprising Connections (you probably didn't know these)
- `checkRedis()` --references--> `ioredis`  [EXTRACTED]
  apps/backend/src/services/health.ts → apps/backend/package.json
- `buildApp()` --indirect_call--> `acceptShipment()`  [INFERRED]
  apps/backend/src/__tests__/integration/order-flow.test.ts → apps/backend/src/controllers/order.controller.ts
- `buildApp()` --indirect_call--> `cancelShipment()`  [INFERRED]
  apps/backend/src/__tests__/integration/order-flow.test.ts → apps/backend/src/controllers/order.controller.ts
- `buildApp()` --indirect_call--> `createShipment()`  [INFERRED]
  apps/backend/src/__tests__/integration/order-flow.test.ts → apps/backend/src/controllers/order.controller.ts
- `buildApp()` --indirect_call--> `deliverShipment()`  [INFERRED]
  apps/backend/src/__tests__/integration/order-flow.test.ts → apps/backend/src/controllers/order.controller.ts

## Import Cycles
- None detected.

## Communities (73 total, 19 thin omitted)

### Community 0 - "notification-subscribers.ts"
Cohesion: 0.07
Nodes (19): startWorkers(), createEmailProvider(), EMAIL_TEMPLATES, EmailMessage, EmailProvider, MockEmailProvider, ResendProvider, SMTPProvider (+11 more)

### Community 1 - "AppNavigator.tsx"
Cohesion: 0.08
Nodes (38): AuthContext, AuthContextType, AuthProvider(), useAuth(), AppNavigator(), linking, Stack, Tab (+30 more)

### Community 2 - "devDependencies"
Cohesion: 0.04
Nodes (48): dependencies, leaflet, lucide-react, next, react, react-dom, react-leaflet, @supabase/ssr (+40 more)

### Community 3 - "devDependencies"
Cohesion: 0.04
Nodes (47): description, devDependencies, eslint, pino-pretty, supertest, tsx, @types/cors, @types/express (+39 more)

### Community 4 - "dependencies"
Cohesion: 0.15
Nodes (13): dependencies, expo, expo-device, @react-native-async-storage/async-storage, react-native-screens, @react-navigation/native-stack, @supabase/supabase-js, @supabase/supabase-js (+5 more)

### Community 5 - "ConversationEngine"
Cohesion: 0.11
Nodes (4): ConversationEngine, ResponseBuilder, ConversationContext, ConversationRecord

### Community 6 - "useAuth"
Cohesion: 0.09
Nodes (28): DashboardLayout(), NewShipmentPage(), PAYMENT_METHOD_LABELS, PROVIDER_TO_METHOD, DashboardPage(), ProfilePage(), mapUrl(), ShipmentDetailPage() (+20 more)

### Community 7 - "dependencies"
Cohesion: 0.05
Nodes (41): dependencies, bullmq, cors, dotenv, express, express-rate-limit, firebase-admin, helmet (+33 more)

### Community 8 - "PaymentProvider"
Cohesion: 0.08
Nodes (4): CashPaymentProvider, PaymentProvider, StripePaymentProvider, WebpayPaymentProvider

### Community 9 - "UploadService"
Cohesion: 0.10
Nodes (7): createUploadService(), FileStorageProvider, LocalStorageProvider, S3StorageProvider, UploadConfig, UploadedFile, UploadService

### Community 10 - "compilerOptions"
Cohesion: 0.07
Nodes (26): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+18 more)

### Community 11 - "order.controller.ts"
Cohesion: 0.20
Nodes (19): withRetry(), acceptShipment(), cancelShipment(), createShipment(), createShipmentSchema, deliverShipment(), getAvailableShipments(), getMyShipments() (+11 more)

### Community 12 - "whatsapp/types/index.ts"
Cohesion: 0.12
Nodes (19): INTENT_PATTERNS, IntentClassifier, IntentPattern, ResolvedAddress, ChannelType, ConversationStatus, ConversationStep, CrmInteractionType (+11 more)

### Community 13 - "maps.service.ts"
Cohesion: 0.09
Nodes (8): createMapsService(), DistanceMatrixElement, GoogleMapsService, MapLocation, MapsService, NominatimMapsService, RouteResult, RouteStep

### Community 14 - "expo"
Cohesion: 0.08
Nodes (23): backgroundColor, foregroundImage, adaptiveIcon, package, expo, android, assetBundlePatterns, icon (+15 more)

### Community 15 - "whatsapp/index.ts"
Cohesion: 0.28
Nodes (5): WhatsAppModuleConfig, IncomingMessage, OutgoingMessage, log, WebhookGateway

### Community 16 - "compilerOptions"
Cohesion: 0.09
Nodes (21): compilerOptions, declaration, declarationMap, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution (+13 more)

### Community 17 - "package.json"
Cohesion: 0.10
Nodes (20): author, description, keywords, license, name, private, scripts, build (+12 more)

### Community 18 - "src/types/index.ts"
Cohesion: 0.09
Nodes (24): OrderCreationResult, OrderService, DispatchOrderData, PriceBreakdown, getCacheService(), buildQuoteCacheKey(), calculateDistance(), calculatePrice() (+16 more)

### Community 19 - "background-jobs.ts"
Cohesion: 0.11
Nodes (15): activeWorkers, CleanupJobData, cleanupQueue, connection, emailQueue, MetricsJobData, metricsQueue, NotificationJobData (+7 more)

### Community 21 - "src/index.ts"
Cohesion: 0.12
Nodes (19): options, setupSwagger(), swaggerSpec, app, authLimiter, generalLimiter, trackingWs, workers (+11 more)

### Community 22 - "getSupabaseAdmin"
Cohesion: 0.22
Nodes (11): getSupabaseAdmin(), addVehicle(), addVehicleSchema, getMyVehicles(), getProfile(), getProviderEarnings(), updateProfile(), updateProfileSchema (+3 more)

### Community 23 - "auth-v2.ts"
Cohesion: 0.15
Nodes (14): authenticate, authenticateV2(), authenticateWithStatus, authorize(), Express, getUserProfile(), Request, UserProfile (+6 more)

### Community 25 - "EntityExtractor"
Cohesion: 0.24
Nodes (6): EntityExtractor, SIZE_KEYWORDS, AddressEntity, ExtractedEntities, PackageEntity, RecipientEntity

### Community 27 - "GeocodingService"
Cohesion: 0.22
Nodes (4): GeocodeResult, GeocodingService, ReverseGeocodeResult, mockFetch

### Community 30 - ".constructor"
Cohesion: 0.18
Nodes (6): AudioTranscriptionProvider, AudioTranscriptionService, MockAudioTranscriptionProvider, TranscriptionResult, WhisperAudioTranscriptionProvider, QuoteService

### Community 31 - "tracking.routes.ts"
Cohesion: 0.18
Nodes (8): mapsService, router, trackingService, EventBus, ShipmentEvent, broadcastLocationUpdate(), setTrackingWebSocket(), setupTrackingEventSubscribers()

### Community 32 - "🗺️ Roadmap de Implementación"
Cohesion: 0.05
Nodes (37): Archivos creados:, Beta (Semana 8), Componentes principales:, 📅 Cronograma Estimado, Dependencias:, Dependencias:, Dependencias:, Dependencias: (+29 more)

### Community 33 - "payment.service.ts"
Cohesion: 0.14
Nodes (9): paymentService, router, logger, PaymentConfirmation, PaymentIntent, PaymentProviderType, PaymentService, PaymentStatus (+1 more)

### Community 34 - "database.ts"
Cohesion: 0.13
Nodes (18): env, envSchema, parsed, CacheEntry, CacheOptions, log, checkDatabase(), checkDisk() (+10 more)

### Community 35 - "graceful-shutdown.ts"
Cohesion: 0.20
Nodes (6): server, log, setupGracefulShutdown(), SHUTDOWN_SIGNALS, ShutdownOptions, waitForServerClose()

### Community 36 - "image-analysis.service.ts"
Cohesion: 0.21
Nodes (5): ImageAnalysisProvider, ImageAnalysisResult, ImageAnalysisService, MockImageAnalysisProvider, OpenAIImageAnalysisProvider

### Community 37 - "auth.controller.ts"
Cohesion: 0.40
Nodes (8): createAuthClient(), login(), loginSchema, refresh(), register(), registerSchema, generateToken(), router

### Community 38 - "ChannelManager"
Cohesion: 0.10
Nodes (8): setNotificationEngine(), ChannelManager, WhatsAppModule, LOGISTICS_TEMPLATES, NotificationEngine, NotificationPayload, TemplateVariable, MessagingProvider

### Community 39 - "rate-limiter.ts"
Cohesion: 0.31
Nodes (8): checkLimit(), classifyRequest(), counters, DEFAULT_CONFIG, getCompanyId(), RateLimitConfig, whatsappRateLimiter(), WindowEntry

### Community 40 - "002_whatsapp_logistics_ai.sql"
Cohesion: 0.13
Nodes (29): packages, payments, ratings, shipments, update_shipments_updated_at, update_updated_at_column(), update_users_updated_at, users (+21 more)

### Community 41 - "🚀 ENVIAZO — DEPLOYMENT CHECKLIST"
Cohesion: 0.08
Nodes (23): 1. STRIPE, 2. GOOGLE MAPS, 3. FIREBASE (FCM), 4. WHATSAPP, 5. SMTP/RESEND (Opcional, fallback a console log), Backend (Express + Node.js), ✅ COMPLETADO (No requiere cambios), 🚀 ENVIAZO — DEPLOYMENT CHECKLIST (+15 more)

### Community 42 - "tsconfig.json"
Cohesion: 0.33
Nodes (5): compilerOptions, paths, strict, extends, expo/tsconfig.base

### Community 43 - "webhook.routes.ts"
Cohesion: 0.50
Nodes (4): captureRawBody(), createWebhookRoutes(), Express, Request

### Community 51 - "PROMPT PARA CONTINUAR ENVIAZO EN CLAUDE CODE"
Cohesion: 0.09
Nodes (22): 1. Configurar Supabase real y correr migrations, 2. Docker compose funcional, 3. API keys reales, 4. Frontend web completo (Next.js), 5. Mobile provider app (Expo/React Native), 6. Integraciones finales, 7. Mejoras, Arquitectura backend (+14 more)

### Community 52 - "🚚 App de Logística de Envíos"
Cohesion: 0.10
Nodes (19): 💰 Algoritmo de Tarifas, 📡 API Endpoints, 🚚 App de Logística de Envíos, 🏗️ Arquitectura, Autenticación, 📞 Contacto, 🤝 Contribuir, 📋 Descripción (+11 more)

### Community 53 - "ENVIAZO — STATUS REPORT (2026-07-31)"
Cohesion: 0.10
Nodes (19): 🏗️ ARCHITECTURE, ✅ Code, ✅ Configuration, 🔴 Credentials (Required), 📋 DEPLOYMENT READINESS, ENVIAZO — STATUS REPORT (2026-07-31), 🔴 Hosting (Required), 📈 METRICS (+11 more)

### Community 54 - "Enviazo — CLAUDE.md"
Cohesion: 0.11
Nodes (17): Auditoría de esquema (2026-07-28, antes de conectar la DB real), Base de datos (`supabase/migrations`, 20 tablas, ninguna aplicada aún), 🔴 Cinco fallas más, encontradas al usar el frontend (2026-07-29), Comandos, 🔴 Cuatro fallas que impedían que el proyecto funcionara (2026-07-28), Enviazo — CLAUDE.md, Estado verificado (2026-07-31, medido tras refactorización), Estados de envío (+9 more)

### Community 55 - "🔴 PROBLEMAS COMUNES"
Cohesion: 0.13
Nodes (14): "500 Internal Server Error" — Generic backend error, 🚀 ANTES DE REPORTAR UN BUG, 📞 DEBUGGING TOOLS, "Deep link no abre" — Notificación → app no navega, 🔧 ENVIAZO — TROUBLESHOOTING GUIDE, 🆘 ESCALATION PATH, "GPS no se reporta" — Tracking vacío, 📊 MONITORING CHECKLIST (+6 more)

### Community 56 - "📋 AUDIT NOTES FOR FABLE"
Cohesion: 0.17
Nodes (11): Architecture Health, 📋 AUDIT NOTES FOR FABLE, Code Quality, Context, Deliverable, Expected Findings, Graphify State (Pre-Refactoring), Graphs to Compare (+3 more)

### Community 57 - "mobile-provider/package.json"
Cohesion: 0.22
Nodes (8): main, name, scripts, android, ios, start, web, version

### Community 58 - "devDependencies"
Cohesion: 0.29
Nodes (7): devDependencies, @babel/core, @types/react, typescript, @types/react, typescript, @babel/core

## Knowledge Gaps
- **431 isolated node(s):** `name`, `version`, `description`, `main`, `dev` (+426 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **19 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getSupabaseAdmin()` connect `getSupabaseAdmin` to `notification-subscribers.ts`, `payment.service.ts`, `database.ts`, `auth.controller.ts`, `ConversationEngine`, `ChannelManager`, `PaymentProvider`, `order.controller.ts`, `whatsapp/types/index.ts`, `whatsapp/index.ts`, `src/types/index.ts`, `src/index.ts`, `auth-v2.ts`, `CustomerMemory`, `tracking.routes.ts`?**
  _High betweenness centrality (0.108) - this node is a cross-community bridge._
- **Why does `checkRedis()` connect `database.ts` to `dependencies`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **Why does `ioredis` connect `dependencies` to `database.ts`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _431 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `notification-subscribers.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06558441558441558 - nodes in this community are weakly interconnected._
- **Should `AppNavigator.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07518796992481203 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.04081632653061224 - nodes in this community are weakly interconnected._