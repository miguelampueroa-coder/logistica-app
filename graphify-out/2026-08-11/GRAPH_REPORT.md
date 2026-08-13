# Graph Report - .  (2026-07-30)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 956 nodes · 1657 edges · 51 communities (44 shown, 7 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 10 edges (avg confidence: 0.74)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `714a79f9`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- UnifiedNotificationService
- useAuth
- devDependencies
- devDependencies
- dependencies
- ConversationEngine
- useAuth
- dependencies
- payment.service.ts
- UploadService
- compilerOptions
- order.controller.ts
- index.ts
- maps.service.ts
- expo
- index.ts
- compilerOptions
- package.json
- order.service.ts
- background-jobs.ts
- MessagingProvider
- index.ts
- express
- auth.ts
- TrackingWebSocket
- EntityExtractor
- getSupabaseAdmin
- .constructor
- CacheService
- WhatsAppCloudProvider
- audio-transcription.service.ts
- tracking.routes.ts
- index.ts
- cache.service.ts
- health.ts
- graceful-shutdown.ts
- image-analysis.service.ts
- auth.controller.ts
- NotificationEngine
- rate-limiter.ts
- database.ts
- OrderService
- tsconfig.json
- webhook.routes.ts
- supabase.ts
- next.config.js
- next-env.d.ts

## God Nodes (most connected - your core abstractions)
1. `getSupabaseAdmin()` - 72 edges
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

## Communities (51 total, 7 thin omitted)

### Community 0 - "UnifiedNotificationService"
Cohesion: 0.07
Nodes (15): startWorkers(), EMAIL_TEMPLATES, EmailMessage, EmailProvider, MockEmailProvider, ResendProvider, SMTPProvider, FCMProvider (+7 more)

### Community 1 - "useAuth"
Cohesion: 0.08
Nodes (30): AuthContext, AuthContextType, AuthProvider(), useAuth(), AppNavigator(), Stack, Tab, ActiveScreen() (+22 more)

### Community 2 - "devDependencies"
Cohesion: 0.04
Nodes (48): dependencies, leaflet, lucide-react, next, react, react-dom, react-leaflet, @supabase/ssr (+40 more)

### Community 3 - "devDependencies"
Cohesion: 0.04
Nodes (47): description, devDependencies, eslint, pino-pretty, supertest, tsx, @types/cors, @types/express (+39 more)

### Community 4 - "dependencies"
Cohesion: 0.04
Nodes (46): dependencies, expo, expo-location, expo-status-bar, @expo/vector-icons, react, react-native, @react-native-async-storage/async-storage (+38 more)

### Community 5 - "ConversationEngine"
Cohesion: 0.11
Nodes (4): ConversationEngine, ResponseBuilder, ConversationContext, ConversationRecord

### Community 6 - "useAuth"
Cohesion: 0.09
Nodes (26): DashboardLayout(), NewShipmentPage(), DashboardPage(), ProfilePage(), mapUrl(), ShipmentDetailPage(), STATUS_FLOW, statusConfig (+18 more)

### Community 7 - "dependencies"
Cohesion: 0.05
Nodes (41): dependencies, bullmq, cors, dotenv, express, express-rate-limit, firebase-admin, helmet (+33 more)

### Community 8 - "payment.service.ts"
Cohesion: 0.06
Nodes (12): paymentService, router, CashPaymentProvider, PaymentConfirmation, PaymentIntent, PaymentProvider, PaymentProviderType, PaymentService (+4 more)

### Community 9 - "UploadService"
Cohesion: 0.10
Nodes (7): createUploadService(), FileStorageProvider, LocalStorageProvider, S3StorageProvider, UploadConfig, UploadedFile, UploadService

### Community 10 - "compilerOptions"
Cohesion: 0.07
Nodes (26): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+18 more)

### Community 11 - "order.controller.ts"
Cohesion: 0.19
Nodes (21): acceptShipment(), cancelShipment(), createShipment(), createShipmentSchema, deliverShipment(), getAvailableShipments(), getMyShipments(), getNotificationService() (+13 more)

### Community 12 - "index.ts"
Cohesion: 0.12
Nodes (19): INTENT_PATTERNS, IntentClassifier, IntentPattern, ResolvedAddress, ChannelType, ConversationStatus, ConversationStep, CrmInteractionType (+11 more)

### Community 13 - "maps.service.ts"
Cohesion: 0.09
Nodes (8): createMapsService(), DistanceMatrixElement, GoogleMapsService, MapLocation, MapsService, NominatimMapsService, RouteResult, RouteStep

### Community 14 - "expo"
Cohesion: 0.08
Nodes (23): backgroundColor, foregroundImage, adaptiveIcon, package, expo, android, assetBundlePatterns, icon (+15 more)

### Community 15 - "index.ts"
Cohesion: 0.18
Nodes (7): setNotificationEngine(), ChannelManager, WhatsAppModule, WhatsAppModuleConfig, IncomingMessage, log, WebhookGateway

### Community 16 - "compilerOptions"
Cohesion: 0.09
Nodes (21): compilerOptions, declaration, declarationMap, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution (+13 more)

### Community 17 - "package.json"
Cohesion: 0.10
Nodes (20): author, description, keywords, license, name, private, scripts, build (+12 more)

### Community 18 - "order.service.ts"
Cohesion: 0.23
Nodes (13): OrderCreationResult, QuoteService, DispatchOrderData, PriceBreakdown, getCacheService(), buildQuoteCacheKey(), calculateDistance(), calculatePrice() (+5 more)

### Community 19 - "background-jobs.ts"
Cohesion: 0.11
Nodes (14): activeWorkers, CleanupJobData, cleanupQueue, emailQueue, MetricsJobData, metricsQueue, NotificationJobData, notificationQueue (+6 more)

### Community 20 - "MessagingProvider"
Cohesion: 0.14
Nodes (3): MockMessagingProvider, MessagingProvider, OutgoingMessage

### Community 21 - "index.ts"
Cohesion: 0.15
Nodes (13): options, setupSwagger(), swaggerSpec, app, authLimiter, generalLimiter, trackingWs, workers (+5 more)

### Community 22 - "express"
Cohesion: 0.23
Nodes (12): addVehicle(), addVehicleSchema, getMyVehicles(), getProfile(), getProviderEarnings(), updateProfile(), updateProfileSchema, validate() (+4 more)

### Community 23 - "auth.ts"
Cohesion: 0.16
Nodes (11): authenticate(), authenticateWithStatus(), authorize(), Express, Request, router, router, upload (+3 more)

### Community 24 - "TrackingWebSocket"
Cohesion: 0.19
Nodes (3): verifyToken(), TrackingSubscription, TrackingWebSocket

### Community 25 - "EntityExtractor"
Cohesion: 0.24
Nodes (6): EntityExtractor, SIZE_KEYWORDS, AddressEntity, ExtractedEntities, PackageEntity, RecipientEntity

### Community 26 - "getSupabaseAdmin"
Cohesion: 0.30
Nodes (3): getSupabaseAdmin(), CustomerMemory, MemoryType

### Community 27 - ".constructor"
Cohesion: 0.16
Nodes (5): GeocodeResult, GeocodingService, ReverseGeocodeResult, ImageAnalysisService, mockFetch

### Community 30 - "audio-transcription.service.ts"
Cohesion: 0.21
Nodes (5): AudioTranscriptionProvider, AudioTranscriptionService, MockAudioTranscriptionProvider, TranscriptionResult, WhisperAudioTranscriptionProvider

### Community 31 - "tracking.routes.ts"
Cohesion: 0.20
Nodes (6): mapsService, router, trackingService, LocationUpdate, TrackingService, TrackingState

### Community 32 - "index.ts"
Cohesion: 0.17
Nodes (11): JwtPayload, Package, Payment, PaymentMethod, PaymentStatusType, PriceBreakdown, Rating, Shipment (+3 more)

### Community 33 - "cache.service.ts"
Cohesion: 0.22
Nodes (8): envSchema, parsed, CacheEntry, CacheOptions, log, createChildLogger(), httpLogger, logger

### Community 34 - "health.ts"
Cohesion: 0.27
Nodes (10): checkDatabase(), checkDisk(), checkRedis(), getCpuUsagePercent(), getHealthStatus(), HealthStatus, HealthStatusLevel, log (+2 more)

### Community 35 - "graceful-shutdown.ts"
Cohesion: 0.20
Nodes (6): server, log, setupGracefulShutdown(), SHUTDOWN_SIGNALS, ShutdownOptions, waitForServerClose()

### Community 36 - "image-analysis.service.ts"
Cohesion: 0.24
Nodes (4): ImageAnalysisProvider, ImageAnalysisResult, MockImageAnalysisProvider, OpenAIImageAnalysisProvider

### Community 37 - "auth.controller.ts"
Cohesion: 0.42
Nodes (7): createAuthClient(), login(), loginSchema, register(), registerSchema, generateToken(), router

### Community 39 - "rate-limiter.ts"
Cohesion: 0.31
Nodes (8): checkLimit(), classifyRequest(), counters, DEFAULT_CONFIG, getCompanyId(), RateLimitConfig, whatsappRateLimiter(), WindowEntry

### Community 40 - "database.ts"
Cohesion: 0.38
Nodes (3): LOGISTICS_TEMPLATES, NotificationPayload, TemplateVariable

### Community 42 - "tsconfig.json"
Cohesion: 0.33
Nodes (5): compilerOptions, paths, strict, extends, expo/tsconfig.base

### Community 43 - "webhook.routes.ts"
Cohesion: 0.50
Nodes (4): captureRawBody(), createWebhookRoutes(), Express, Request

## Knowledge Gaps
- **296 isolated node(s):** `name`, `version`, `description`, `main`, `dev` (+291 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getSupabaseAdmin()` connect `getSupabaseAdmin` to `UnifiedNotificationService`, `health.ts`, `auth.controller.ts`, `ConversationEngine`, `NotificationEngine`, `database.ts`, `OrderService`, `payment.service.ts`, `order.controller.ts`, `index.ts`, `index.ts`, `order.service.ts`, `express`, `auth.ts`, `tracking.routes.ts`?**
  _High betweenness centrality (0.138) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `devDependencies`?**
  _High betweenness centrality (0.117) - this node is a cross-community bridge._
- **Why does `checkRedis()` connect `health.ts` to `dependencies`?**
  _High betweenness centrality (0.115) - this node is a cross-community bridge._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _296 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `UnifiedNotificationService` be split into smaller, more focused modules?**
  _Cohesion score 0.07183673469387755 - nodes in this community are weakly interconnected._
- **Should `useAuth` be split into smaller, more focused modules?**
  _Cohesion score 0.07993197278911565 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.04081632653061224 - nodes in this community are weakly interconnected._