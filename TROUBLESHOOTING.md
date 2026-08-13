# 🔧 ENVIAZO — TROUBLESHOOTING GUIDE

## 🚀 ANTES DE REPORTAR UN BUG

```bash
# 1. Limpia cache y node_modules
rm -rf node_modules package-lock.json
npm install

# 2. TypeScript check
npm run typecheck

# 3. Tests
npm test

# 4. Logs
tail -f logs/error.log
```

---

## 🔴 PROBLEMAS COMUNES

### "Token expired" — Usuario kickeado de sesión

**Síntoma:** Móvil muestra "Session expired. Please log in again."

**Causa:** Token refresh falló (servidor no responde o JWT inválido)

**Solución:**
```bash
# Backend:
1. Verifica /api/auth/refresh endpoint está activo
   curl -X POST http://localhost:3002/api/auth/refresh \
     -H "Authorization: Bearer YOUR_TOKEN"

2. Verifica JWT_SECRET es igual en backend + móvil
   grep JWT_SECRET apps/backend/.env

3. Verifica base de datos está accesible
   psql $DATABASE_URL -c "SELECT 1"

# Móvil:
1. Borra token viejo
   iOS: Settings > General > iPhone Storage > [App] > Offload App
   Android: Settings > Apps > [App] > Storage > Clear Data

2. Reinicia app y login nuevamente
```

---

### "Payment confirmation failed" — Pago no se captura

**Síntoma:** Envío entregado pero payment_status='pending'

**Causa:** 
- Stripe key inválido
- Network timeout
- Payment ya capturado

**Solución:**
```bash
# 1. Verifica Stripe key
echo $STRIPE_API_KEY
# Debe empezar con sk_live_ (no sk_test_)

# 2. Revisa logs de backend
grep "Payment" logs/error.log | tail -20

# 3. Manual retry (si es 1-2 casos)
SELECT * FROM payments WHERE shipment_id = 'xxx' AND status = 'pending';
UPDATE payments SET status = 'completed' WHERE shipment_id = 'xxx';

# 4. O triggers automático:
# El backend reintenta cada 10 min (Bull job)
```

---

### "GPS no se reporta" — Tracking vacío

**Síntoma:** Prestador acepta envío pero no hay ubicación en mapa

**Causa:**
- Permisos de ubicación denegados en móvil
- API endpoint no responde

**Solución:**
```bash
# Móvil (iOS):
Settings > Privacy > Location > [App] > Always Allow

# Móvil (Android):
Settings > Apps > [App] > Permissions > Location > Allow all the time

# Backend:
curl http://localhost:3002/api/tracking/SHIPMENT_ID \
  -H "Authorization: Bearer TOKEN"
# Debe devolver tracking state con currentLocation

# Database:
SELECT * FROM location_history WHERE shipment_id = 'xxx';
```

---

### "Notifications no llegan" — Push silencioso

**Síntoma:** App en background pero no recibe push de nuevos envíos

**Causa:**
- FCM key no configurado
- Push permission denegado
- Token no registrado

**Solución:**
```bash
# Backend:
1. Verifica Firebase config
   ls apps/backend/firebase-key.json

2. Revisa registros de token
   SELECT * FROM fcm_tokens WHERE user_id = 'xxx';

3. Manual test:
   curl -X POST http://localhost:3002/api/push/test \
     -H "Content-Type: application/json" \
     -d '{"user_id": "xxx", "title": "Test"}'

# Móvil:
1. Verifica permisos
   iOS: Settings > Notifications > [App] > Allow Notifications ✅
   Android: Settings > Apps > [App] > Notifications ✅

2. FCM token se registra en startup
   Logs should show: "Push token registered: exponent..."
```

---

### "Deep link no abre" — Notificación → app no navega

**Síntoma:** Click en push pero app no abre la pantalla de tracking

**Causa:**
- Deep linking config no activada
- Shipment ID no válido en URL

**Solución:**
```bash
# Manual test deep link:
adb shell am start -W -a android.intent.action.VIEW \
  -d "enviazo://shipments/SHIPMENT_ID" com.enviazo.provider

# iOS:
xcrun simctl openurl booted "enviazo://shipments/SHIPMENT_ID"

# Verifica config en AppNavigator.tsx:
# Debe tener: prefixes: ['enviazo://', 'https://enviazo.app/']
```

---

### "WebSocket tracking desconecta" — Mapa se pausa

**Síntoma:** Mapa carga pero deja de actualizar después de 2 min

**Causa:**
- Connection timeout (firewall/proxy)
- Server reinicia sin reconectar clientes

**Solución:**
```bash
# Backend:
1. Verifica WebSocket activo
   curl http://localhost:3002/health
   # Debe incluir "websocket": "healthy"

2. Logs:
   grep -i "websocket\|connection" logs/info.log

# Cliente Web:
1. Developer Tools > Network > WS
2. Debe ver wss://api.com/ws/tracking conectado
3. Si desconecta cada 2 min: firewall/proxy blocking
   - Usar polling fallback en cliente
   - O configurar keep-alive

# Solución temporal:
# En tracking page, refresh cada 15s si WS desconecta
```

---

### "Role validation fails" — "Only providers can..."

**Síntoma:** Cliente intenta aceptar envío, error 403

**Causa:**
- Usuario autenticado como 'client' no 'provider'
- Role cambió en DB

**Solución:**
```bash
# Verifica rol en DB:
SELECT id, email, role FROM users WHERE id = 'xxx';

# Actualiza si es necesario:
UPDATE users SET role = 'provider' WHERE id = 'xxx';

# Relogin para que caché se actualice
```

---

### "500 Internal Server Error" — Generic backend error

**Síntoma:** Endpoint devuelve 500

**Solución:**
```bash
# 1. Revisa logs inmediatamente
tail -50 logs/error.log

# 2. Identifica línea de error
grep "500\|Internal server error" logs/error.log | tail -1

# 3. Categoriza:
# - "Cannot read property 'X' of null" → null check falta
# - "ECONNREFUSED" → Supabase/Redis no conecta
# - "TypeError" → Type mismatch
# - "ValidationError" → Input schema violation

# 4. Si es null check:
# a. Revisa middleware auth
# b. Verifica select() en query
# c. Agrega ? optional chaining

# 5. Si es DB:
# a. Verifica env vars
# b. ping base de datos
# c. Revisa RLS policies
```

---

## 📊 MONITORING CHECKLIST

```bash
# Cron health checks (ejecutar cada 15 min):
curl http://localhost:3002/health > /tmp/health.json
jq '.checks' /tmp/health.json

# Should show:
{
  "database": {"status": "healthy", "latencyMs": 45},
  "redis": {"status": "healthy", "latencyMs": 12},
  "disk": {"status": "healthy"}
}

# Si alguno DEGRADED: investiga inmediatamente
```

---

## 🆘 ESCALATION PATH

1. **Local dev:** Logs + typecheck + test
2. **Staging:** Reproduce con datos reales
3. **Production:** Check sentry/datadog
4. **Last resort:** Rollback + debug offline

---

## 📞 DEBUGGING TOOLS

```bash
# Real-time logs
tail -f logs/error.log | grep "ERROR"

# JSON logs (para parsear)
cat logs/error.log | jq '.'

# Performance
grep "latency" logs/info.log | tail -20

# Database queries (si hay query logging)
grep "SELECT\|UPDATE" logs/debug.log | tail -30

# Network issues
tcpdump -i any port 3002

# Memory leaks
node --inspect dist/index.js
# Chrome devtools://devtools/bundled/js_app.html
```

---

**Versionado: 2026-07-31**
**Para: Enviazo Team**
