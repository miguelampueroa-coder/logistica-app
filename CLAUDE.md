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

## Estado verificado (2026-07-28, medido, no copiado)

- **89 tests pasando** (5 suites, `npm test` en `apps/backend`)
- **0 errores de tipo** (`tsc --noEmit` limpio)
- **10.855 líneas TS** en backend, 1.791 en web, 2.357 en móvil
- 116 archivos versionables

### Hecho
Backend completo (auth JWT + roles, CRUD envíos, pagos, tracking GPS +
WebSocket, uploads con Sharp, admin), módulo WhatsApp con IA (19 archivos:
engine de conversación, clasificador de intención, extractor de entidades,
constructor de respuesta, geocoding, memoria por empresa, rate limit por
company, verificación de firma de webhook), caché Redis con fallback en
memoria, graceful shutdown, health check real, CI GitHub Actions.

### Pendiente (en orden)
1. **Supabase real** — las 4 claves críticas de `apps/backend/.env`
   (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `JWT_SECRET`) son placeholders. Las migraciones 001-003 **no están
   aplicadas en ningún proyecto Supabase**. Los 89 tests pasan con mocks —
   el backend nunca ha corrido contra base de datos real.
2. API keys reales: Stripe, Google Maps, Firebase, SMTP/Resend, WhatsApp
   (token, phone number id, verify token).
3. Frontend web: faltan mapa de tracking, flujo de pago y lista de envíos
   conectados a la API real.
4. Móvil: reporte GPS automático por WebSocket, registro FCM, pantallas de
   disponibles / entrega activa / ganancias.
5. Webhook de Meta contra número real; firma de webhook Stripe.

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
