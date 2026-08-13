# Enviazo — CLAUDE.md

Plataforma de envíos tipo Uber, base Puerto Montt, Chile. Cualquiera publica
un envío; cualquier prestador con vehículo lo toma. Monorepo npm workspaces
(`enviazo-app`), fuera de Shopify y sin relación con Café Puerto Varas.

Ubicación: `/Users/spaun/logistica-app` (NO en el Escritorio, a diferencia de
los otros proyectos de Miguel).

## Historia del proyecto

Construido en su mayoría con **opencode** (otra herramienta de IA) hasta el
2026-07-28. Ese día se retomó con Claude Code. El handoff que dejó opencode
está en `PROMPT_CLAUDE_CODE.md` — es un documento de estado, no una orden de
trabajo; el rumbo lo fija Miguel.

## Stack

| Componente | Tecnología |
|---|---|
| Backend | Express 4 + TypeScript 5 (ESM, imports con `.js`) |
| DB | Supabase (PostgreSQL) + RLS |
| Web cliente | Next.js App Router + Tailwind |
| Móvil prestador | Expo / React Native |
| Colas | BullMQ + ioredis (6 colas) |
| Pagos | Stripe + Webpay + efectivo |
| Push / Email | Firebase Admin (FCM) + Resend/SMTP |
| Tests | Vitest |
| Validación | Zod (controllers y `env.ts`) |
| Logs | Pino |
| Realtime | `ws` (tracking WebSocket) |
| Infra | Docker + docker-compose + Nginx + Swagger (OpenAPI 3.0) |

## Estado verificado (2026-07-31, medido tras refactorización)

- **89 tests pasando** (5 suites, `npm test` en `apps/backend`)
- **0 errores de tipo** (`tsc --noEmit` limpio en backend + móvil)
- **10.950 líneas TS** en backend, 1.791 en web, 2.450 en móvil
- 116 archivos versionables

### Hecho (acumulativo)
- **Backend completo**: auth JWT + roles, CRUD envíos, pagos, tracking GPS + WebSocket, uploads con Sharp, admin
- **Refactorización arquitectónica** (2026-07-31):
  - ✅ Token refresh automático (endpoint `/api/auth/refresh` + móvil interceptor 401)
  - ✅ Event-driven notifications (EventBus desacopla operaciones de notificaciones)
  - ✅ Centralizado auth middleware (`authenticateV2` con caché de perfil + estado)
  - ✅ Payment resilience (withRetry con backoff exponencial)
  - ✅ WebSocket real-time tracking (reemplaza polling manual de 15s)
  - ✅ Role validation en accept/pickup/deliver
  - ✅ Deep linking en móvil (`enviazo://shipments/:id`)
  - ✅ Background notifications (setupNotificationHandler en startup)
  - ✅ Error handling en pantallas críticas (ActiveScreen + VehiclesScreen)
- **Módulo WhatsApp con IA**: engine de conversación, clasificador de intención, geocoding, verificación de firma
- **Webhooks validados**: Stripe (stripe.webhooks.constructEvent) + Meta (timingSafeEqual HMAC-SHA256)
- **Caché Redis** con fallback en memoria, graceful shutdown, health check real

### Pendiente (en orden)
1. **API keys reales** (Solo Miguel las tiene):
   - Stripe: `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET`
   - Google Maps: `GOOGLE_MAPS_API_KEY`
   - Firebase: `FIREBASE_PROJECT_ID`, credenciales JSON
   - WhatsApp: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`
2. **Frontend web**: mapa de tracking, flujo de pago conectado a la API real
3. **Móvil**: EAS build config (eas.json creado), build para iOS/Android
4. **Tests unitarios**: para token refresh e interceptor 401

## Base de datos (`supabase/migrations`, 20 tablas, ninguna aplicada aún)

- `001_initial_schema.sql` (260 líneas) — `users`, `vehicles`, `packages`,
  `shipments`, `payments`, `ratings`
- `002_whatsapp_logistics_ai.sql` (239) — `companies`, `company_members`,
  `conversations`, `messages`, `dispatch_orders`, `company_memory`,
  `operator_assignments`, `webhook_events`, `crm_interactions`,
  `crm_daily_metrics`
- `003_maps_tracking_uploads.sql` (139) — `location_history`,
  `delivery_evidence`, `package_photos`, `fcm_tokens`
- `004_fix_schema_gaps.sql` — corrige 3 desajustes hallados al auditar los
  56 insert/update del backend contra 001-003 (ver abajo)
- `005_rls_whatsapp.sql` — habilita RLS en las 10 tablas de 002, que no lo
  tenían
- `006_grants.sql` — otorga privilegios a `service_role`; sin esto PostgREST
  respondía 42501 a todo

### Auditoría de esquema (2026-07-28, antes de conectar la DB real)

Se compararon por script las 56 operaciones insert/update del backend contra
las columnas declaradas en las migraciones. Tres hallazgos, corregidos en 004:

1. **`shipments.payment_id` no existía.** `order.controller.ts` lo escribe al
   crear el pago y lo lee al entregar para capturar el cobro. El update fallaba
   en silencio (supabase-js devuelve `error`, no lanza, y ahí no se revisaba),
   así que **la captura del pago al entregar nunca se habría disparado**.
   Además del ALTER, ahora el update revisa y loguea su error.
2. **`users.is_active` no existía.** `admin.routes.ts` lo pide en dos
   `select`; `users` solo tenía `is_available`, que es otra cosa
   (disponibilidad del prestador ≠ cuenta habilitada). `GET /api/admin/users`
   habría devuelto error.
3. **Insert abierto en `payments`.** La policy `WITH CHECK (true)` de 001
   dejaba a cualquier rol —incluido `anon`, cuya key es pública por diseño—
   insertar pagos con monto libre y `status: 'completed'`. Policy eliminada;
   el backend inserta con service role, que salta RLS.

Ninguno era visible antes porque los 89 tests corren con mocks.

### 🔴 RLS ausente en todo el módulo WhatsApp (corregido en 005)

Conteo por migración: 001 → RLS en 6 tablas, 16 policies. 003 → 4 tablas,
7 policies. **002 → 0 y 0.** Sus 10 tablas quedaron sin `ENABLE ROW LEVEL
SECURITY`, violando la regla del proyecto. Con la anon key —pública por
diseño— quedaban legibles y escribibles el contenido completo de las
conversaciones (`messages`), las direcciones y teléfonos guardados
(`company_memory`), los pedidos por chat (`dispatch_orders`) y los ingresos
diarios (`crm_daily_metrics`), de todas las empresas a la vez.

005 habilita RLS en las 10 sin agregar policies: el módulo accede solo con
service role, que salta RLS. Al exponer estas tablas al navegador habrá que
escribir policies filtrando por `company_id` vía `company_members`.

### 🔴 Cuatro fallas que impedían que el proyecto funcionara (2026-07-28)

Aparecieron al levantar el backend contra Postgres real por primera vez.
Ninguna la detectaban los 89 tests, porque corren con mocks y nunca arrancan
el servidor.

1. **Sin GRANTs → nada funcionaba.** Ninguna migración otorgaba privilegios.
   Las 20 tablas tenían `has_table_privilege = false` para `service_role`,
   así que PostgREST respondía `42501 permission denied` a **toda** operación,
   health check incluido. Con las migraciones tal como estaban, la plataforma
   completa era inoperable contra una base real. Corregido en 006.
2. **`pino-pretty` faltaba.** `logger.ts:16` lo usa como transport cuando
   `NODE_ENV=development` y no estaba declarado ni instalado: el servidor
   crasheaba al arrancar. Agregado a devDependencies.
3. **`ws` v6 con `@types/ws` v8.** El código importa `WebSocketServer`, export
   que solo existe desde v8; en runtime había 6.2.6. `tsc` pasaba limpio por
   los tipos y el servidor moría con `WebSocketServer is not a constructor`.
   Subido a ^8.21.1.
4. **El login envenenaba el cliente admin.** `login()` ejecutaba
   `signInWithPassword` sobre el singleton de `getSupabaseAdmin()`.
   supabase-js deja la sesión adherida al cliente que la ejecuta, así que
   tras un login **todo el proceso** pasaba a consultar como `authenticated`
   con el token del último usuario que entró — para todos los usuarios, no
   solo para él. Además de romper el login, era un problema de aislamiento
   entre usuarios. Ahora usa `createAuthClient()`, un cliente efímero.

### 🔴 Cinco fallas más, encontradas al usar el frontend (2026-07-29)

1. **`GET /api/orders/:id` devolvía 404 siempre.** El select pedía dos veces
   la relación `users` (cliente y repartidor) sin alias, y PostgREST lo
   rechaza con `42712 table name "shipments_users_1" specified more than once`.
   Ver el detalle de un envío nunca funcionó. Mismo patrón en
   `admin.routes.ts:241`. Corregido con alias `client:` y `provider:`.
2. **El tracking estaba roto de raíz.** `tracking.service.ts` pedía
   `vehicles.license_plate`; la columna se llama `plate`. El select fallaba,
   `getTrackingState` devolvía null y el endpoint respondía 404 siempre.
   Mismo error en `admin.routes.ts:139`.
3. **`/api/tracking/active` era inalcanzable.** Estaba declarado después de
   `/:shipmentId`, que capturaba "active" como si fuera un id.
4. **Las notificaciones de WhatsApp no se enviaban.** Tres selects pedían
   `shipments.customer_phone`, columna que no existe: el teléfono del cliente
   vive en `dispatch_orders`. Fallaban en silencio (data null → el `if` no
   entraba → ningún mensaje). Resuelto con un helper `getCustomerPhone`.
5. **El login del frontend estaba roto.** `useAuth` hacía un segundo login
   contra Supabase con credenciales placeholder, y `onAuthStateChange`
   sobrescribía el JWT del backend con el access token de Supabase — que el
   backend rechaza, porque valida con su propio `JWT_SECRET`. Reescrito: el
   backend es la única fuente de verdad y el token se persiste en
   localStorage.

El verificador de esquema vive en el scratchpad de la sesión; la idea vale
más que el archivo: comparar los `.select()` / `.insert()` del código contra
las columnas de las migraciones encuentra en segundos lo que los tests con
mocks no ven.

### Nuevo en el frontend

`app/dashboard/shipments/[id]/page.tsx` — detalle del envío: línea de tiempo
de estados, mapa (OpenStreetMap embebido, sin API key), datos del repartidor,
desglose de precio y cancelación. Refresca cada 15 s mientras el estado es
`in_transit`. El WebSocket `/ws/tracking` existe en el backend y queda como
mejora sobre este refresco por consulta.

⚠️ El frontend todavía se llama **LogiApp** en la interfaz; el proyecto se
renombró a Enviazo. Falta decidir y aplicar el cambio.

### Verificado end-to-end contra Postgres real

Registro → login → envío Puerto Montt–Puerto Varas, con los datos escritos
en la base. El precio calculado cuadra con `pricing.service.ts`:
17,04 km × 700 = 11.928 base, +200 (2 kg sobre el umbral de 10),
+0 volumen (0,03 m³), +300 urgencia = 12.428, × 1,5 furgoneta = **18.642 CLP**.

Entorno local: Colima (Docker sin privilegios de admin) + `supabase start`
con `[analytics] enabled = false` en `config.toml` — el contenedor `vector`
monta el docker.sock del host y Colima no lo soporta.

⚠️ **Las migraciones no son idempotentes**: los `CREATE INDEX`, `CREATE POLICY`
y `CREATE TRIGGER` de 001 y 003 no llevan `IF NOT EXISTS`. Si una aplicación
falla a medio camino, reintentarla aborta. Aplicarlas en orden y de una sola vez.

## Modelo de precios (fuente: `apps/backend/src/services/pricing.service.ts`)

```
subtotal = ceil(km × 700) + recargoPeso + recargoVolumen + urgencia
total    = ceil(subtotal × multiplicadorVehículo)
```

| Concepto | Valor |
|---|---|
| Tarifa base | 700 CLP/km |
| Urgencia | +300 CLP |
| Peso sobre 10 kg | +100 CLP por kg excedente |
| Volumen sobre 0,5 m³ | +500 CLP por m³ excedente |
| Multiplicadores | moto 1,0 · auto 1,2 · furgoneta 1,5 · camioneta 1,8 · microbús 2,2 · camión 2,5 |

⚠️ El README dice `Precio = (Distancia × 700) + recargos` y omite que el
multiplicador de vehículo se aplica al subtotal **completo, urgencia
incluida**. La fuente de verdad es el código, no el README.

## Estados de envío

```
pending → accepted → in_transit → delivered
   ↓          ↓
cancelled  cancelled
```

## Reglas del proyecto

- RLS en toda tabla nueva, sin excepción
- Migraciones aditivas (004+); **nunca** modificar 001-003
- Service role salta RLS → en el módulo WhatsApp filtrar SIEMPRE por `company_id`
- Zod para validar entrada en controllers y variables de entorno
- TypeScript estricto, tipos explícitos
- Servicios singleton: `PaymentService`, `getCacheService()`, `getNotificationService()`
- Prefijo de caché: `enviazo`
- WhatsApp es solo un canal: la lógica vive en los servicios internos, no en el canal
- Código auto-documentado, sin comentarios explicativos
- Antes de editar: leer el archivo y respetar el patrón existente
- Después de editar: `npm run typecheck && npm test`

## Comandos

```bash
cd /Users/spaun/logistica-app/apps/backend
npm run dev          # hot-reload
npm test             # 89 tests
npm run typecheck    # 0 errores
docker compose up    # backend + Redis + Nginx (desde la raíz)
```

Swagger: `http://localhost:3000/api-docs` · Health: `http://localhost:3000/health`
