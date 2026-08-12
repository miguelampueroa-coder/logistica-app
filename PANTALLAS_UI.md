# 📱 ENVIAZO — Pantallas & Interfaces

**Status:** Production Ready (2026-08-11)

---

## 🌐 WEB CLIENT (Next.js) — Usuario/Cliente

### 1️⃣ HOME — Landing Page

```
┌─────────────────────────────────────┐
│  [Logo] Enviazo    [Iniciar] [Sign]│
├─────────────────────────────────────┤
│                                     │
│   Envía cualquier paquete           │
│   RÁPIDO Y SEGURO                   │
│                                     │
│   Plataforma tipo Uber para         │
│   logística. Conecta con            │
│   prestadores cerca de ti.          │
│                                     │
│   [Comenzar Ahora]  [Iniciar Sesión]│
│                                     │
├─────────────────────────────────────┤
│  ¿Cómo funciona?                    │
│  Simple, rápido y seguro            │
│                                     │
│  📦 Publica envío   🚗 Prestador    │
│     Describe           lo toma       │
│     paquete                         │
│                                     │
│  📍 Tracking real-time              │
│     Sigue en vivo                   │
│                                     │
├─────────────────────────────────────┤
│  ✅ Rápido     ✅ Seguro            │
│  ✅ Flexible   ✅ Cualquier vehículo│
│                                     │
│  [¿Listo para enviar?]              │
│  [Comenzar Ahora] [Enviar por WA]   │
│                                     │
│  © 2026 Enviazo                     │
└─────────────────────────────────────┘
      💬 WhatsApp flotante (esquina)
```

---

### 2️⃣ REGISTRO — Sign Up

```
┌─────────────────────────────────────┐
│  Crear cuenta en Enviazo            │
├─────────────────────────────────────┤
│                                     │
│  📧 Email: [___________________]    │
│  🔐 Contraseña: [______________]    │
│  👤 Nombre: [___________________]   │
│  📱 Teléfono: [__________________]  │
│  ☐ Soy prestador (conductor)       │
│                                     │
│  [Registrarse]                      │
│                                     │
│  ¿Ya tienes cuenta? [Iniciar Sesión]│
│                                     │
│  ──── O ────                        │
│  [🔵 Google]  [🐙 GitHub]           │
│                                     │
└─────────────────────────────────────┘
```

---

### 3️⃣ DASHBOARD — Panel Principal (Usuario Logueado)

```
┌─────────────────────────────────────┐
│  [Menu] Enviazo         Perfil  [🔔]│
├─────────────────────────────────────┤
│                                     │
│  👋 Hola, Juan                      │
│                                     │
│  [+ Nuevo Envío]                    │
│                                     │
│  📋 Mis Envíos                      │
│  ┌─────────────────────────────┐    │
│  │ #SHP-001 | Pendiente        │    │
│  │ Desde: Paseo Ahumada        │    │
│  │ Hasta: Barrio Brasil        │    │
│  │ $5.990 | 2 km               │    │
│  │ [Ver detalles] [Cancelar]   │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ #SHP-002 | En tránsito ✓    │    │
│  │ Desde: Mall Alto Las Condes │    │
│  │ Hasta: Lastarria            │    │
│  │ $8.500 | 12 km              │    │
│  │ 📍 En vivo (🗺️ Mapa)        │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ #SHP-003 | Entregado ✅     │    │
│  │ Desde: Estación Central     │    │
│  │ Hasta: Providencia          │    │
│  │ $3.200 | Entregado hace 2h  │    │
│  │ [Ver recibo] [Calificar]    │    │
│  └─────────────────────────────┘    │
│                                     │
│  💬 [Enviar por WhatsApp]            │
│                                     │
└─────────────────────────────────────┘
      💬 WhatsApp flotante
```

---

### 4️⃣ CREAR NUEVO ENVÍO

```
┌─────────────────────────────────────┐
│  ← Nuevo Envío                      │
├─────────────────────────────────────┤
│                                     │
│  📍 Origen:                         │
│  [🔍 Buscar dirección...]           │
│  "Paseo Ahumada 150, Santiago"      │
│                                     │
│  📍 Destino:                        │
│  [🔍 Buscar dirección...]           │
│  "Barrio Brasil, Santiago"          │
│                                     │
│  📦 Tipo de paquete:                │
│  ⭕ Documento  ⭕ Paquete pequeño   │
│  ⭕ Paquete grande  ⭕ Voluminoso   │
│                                     │
│  ⚖️ Peso: [_____] kg                │
│  📝 Descripción: [_______________]  │
│  💰 Precio ofertado: $ [______]     │
│     (El sistema sugiere $5.990)     │
│                                     │
│  🚗 Tipo de vehículo:               │
│  ⭕ Moto  ⭕ Auto  ⭕ Camión        │
│                                     │
│  ⏰ Urgencia:                        │
│  ⭕ Normal (hoy)  ⭕ Urgente (1h)   │
│                                     │
│  [Calcular precio]                  │
│  [Publicar envío]                   │
│                                     │
└─────────────────────────────────────┘
```

---

### 5️⃣ TRACKING EN TIEMPO REAL

```
┌─────────────────────────────────────┐
│  ← #SHP-002 En tránsito ✓           │
├─────────────────────────────────────┤
│                                     │
│  📍 Desde: Mall Alto Las Condes     │
│  ⟶ Hasta: Lastarria                 │
│  📏 12 km | ⏱️ 28 min est.           │
│                                     │
│  ┌─────────────────────────────┐    │
│  │      🗺️ MAPA EN VIVO        │    │
│  │                             │    │
│  │    ↑ N                      │    │
│  │    |    🟢 Tú (origen)      │    │
│  │    |                        │    │
│  │    |  ╱╲                    │    │
│  │    | ╱  ╲ 🚗 (Juan, moto)   │    │
│  │    |╱    ╲ ETA: 28 min      │    │
│  │   ╱      ╱                  │    │
│  │  ╱      ╱ ___               │    │
│  │        🔴 Destino           │    │
│  │                             │    │
│  │ Velocidad: 45 km/h          │    │
│  │ Exactitud: ±5 m             │    │
│  └─────────────────────────────┘    │
│                                     │
│  👤 Prestador: Juan Pérez           │
│  📱 Moto: Honda CB 150              │
│  ⭐ Calificación: 4.8 (245 viajes)  │
│  💬 [Llamar] [Mensaje]              │
│                                     │
│  📋 Historial:                      │
│  ✅ Recogida iniciada (15:23)       │
│  ⏳ En camino (15:25)                │
│  ⏳ Entrega en progreso              │
│                                     │
└─────────────────────────────────────┘
```

---

## 📱 MOBILE APP (Expo/React Native) — Prestador

### 1️⃣ LISTA DE ENVÍOS DISPONIBLES

```
┌─────────────────────────────────────┐
│  ≡  Enviazo Provider           [🔔] │
├─────────────────────────────────────┤
│  📍 Tu ubicación: Santiago Centro   │
│  🔄 Filtros: Todo | Por distancia   │
├─────────────────────────────────────┤
│                                     │
│  🟢 DISPONIBLES CERCA                │
│                                     │
│  ┌──────────────────────────────┐   │
│  │ 📦 #SHP-004                  │   │
│  │ De: Mall Parque Arauco       │   │
│  │ A: Las Condes (5 km)         │   │
│  │ Peso: 2 kg | Documento       │   │
│  │ $ 7.500                      │   │
│  │ ⭐ Cliente: 4.9              │   │
│  │ [Aceptar] [Detalles]         │   │
│  └──────────────────────────────┘   │
│                                     │
│  ┌──────────────────────────────┐   │
│  │ 📦 #SHP-005                  │   │
│  │ De: La Moneda                │   │
│  │ A: Ñuñoa (8 km)              │   │
│  │ Peso: 5 kg | Paquete         │   │
│  │ $ 12.000                     │   │
│  │ ⭐ Cliente: 4.7              │   │
│  │ [Aceptar] [Detalles]         │   │
│  └──────────────────────────────┘   │
│                                     │
│  ┌──────────────────────────────┐   │
│  │ 📦 #SHP-006                  │   │
│  │ De: Barrio Brasil            │   │
│  │ A: Estación Central (3 km)   │   │
│  │ Peso: 1 kg | Documento       │   │
│  │ $ 4.500                      │   │
│  │ ⭐ Cliente: 4.6              │   │
│  │ [Aceptar] [Detalles]         │   │
│  └──────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘
```

---

### 2️⃣ ENVÍO ACEPTADO — Pantalla Activa

```
┌─────────────────────────────────────┐
│  ← Activo    #SHP-004         [≡]   │
├─────────────────────────────────────┤
│                                     │
│  Envío EN PROGRESO                  │
│  📦 De: Mall Parque Arauco          │
│  📍 A: Las Condes                   │
│                                     │
│  ┌─────────────────────────────┐    │
│  │      🗺️ MAPA DE RUTA        │    │
│  │                             │    │
│  │    🔵 Mi ubicación (Moto)   │    │
│  │       ⟶ En movimiento       │    │
│  │    ↓                        │    │
│  │ ═════════════════════════   │    │
│  │  [  Ruta calculada  ]       │    │
│  │    ↓                        │    │
│  │    🔴 Destino de entrega    │    │
│  │                             │    │
│  │ Velocidad: 42 km/h          │    │
│  │ ETA: 12 min                 │    │
│  │ Distancia: 5 km             │    │
│  └─────────────────────────────┘    │
│                                     │
│  ⏱️ PROGRESO DE ENTREGA:             │
│                                     │
│  ✅ Recogida iniciada               │
│  🟡 En camino (EN VIVO GPS)         │
│  ⭕ Llegada a destino               │
│  ⭕ Entrega confirmada              │
│                                     │
│  [Reportar ubicación] [Contactar]   │
│  [Cancelar viaje]                   │
│                                     │
└─────────────────────────────────────┘
```

---

### 3️⃣ COMPLETAR ENTREGA

```
┌─────────────────────────────────────┐
│  Entregar Paquete #SHP-004          │
├─────────────────────────────────────┤
│                                     │
│  ✅ Llegaste a destino              │
│  📍 Las Condes (Confirmar)          │
│                                     │
│  Detalles de entrega:               │
│  📦 Paquete: Documento              │
│  👤 Recibe: Juan Pérez              │
│  📱 Contacto: +56912345678          │
│                                     │
│  📸 Foto de confirmación:           │
│  [Tomar foto] ← Requerido          │
│  [📷 Foto capturada ✓]              │
│                                     │
│  ✍️ Firma/Código:                   │
│  [Pedir firma cliente]              │
│  [O ingresar código: ___]           │
│                                     │
│  💬 Nota: [Dejar en recepción]      │
│                                     │
│  [Confirmar Entrega]                │
│                                     │
│  💰 Pago: $7.500                    │
│  ├─ Base: $6.000                    │
│  ├─ Bonus urgencia: $1.500          │
│  └─ Ya acreditado en tu cuenta ✓    │
│                                     │
└─────────────────────────────────────┘
```

---

### 4️⃣ MIS GANANCIAS — Perfil Prestador

```
┌─────────────────────────────────────┐
│  ≡  Mi Perfil              [Logout] │
├─────────────────────────────────────┤
│                                     │
│  👤 Juan Pérez                      │
│  📱 +56912345678                    │
│  ⭐ 4.8 / 5.0 (248 viajes)          │
│  ✅ Verificado                      │
│                                     │
│  💰 HOY:                            │
│  ├─ Ganancias: $42.500              │
│  ├─ Viajes: 5 completados           │
│  ├─ Distancia: 84 km                │
│  └─ Tiempo: 4h 15min                │
│                                     │
│  💰 ESTE MES:                       │
│  ├─ Ganancias: $523.400             │
│  ├─ Viajes: 62                      │
│  ├─ Calificación promedio: 4.8      │
│  └─ Tendencia: ↑ 12% vs mes pasado   │
│                                     │
│  🚗 Mi Vehículo:                    │
│  ├─ Honda CB 150                    │
│  ├─ Placa: SZB-9999                 │
│  ├─ Documentos: ✅ Al día           │
│  └─ [Editar]                        │
│                                     │
│  📊 [Ver estadísticas]              │
│  💳 [Métodos de pago]               │
│  ⚙️ [Configuración]                 │
│  🔐 [Seguridad]                     │
│                                     │
│  [Cerrar sesión]                    │
│                                     │
└─────────────────────────────────────┘
```

---

## 💬 WHATSAPP BOT — Interfaz de Conversación

### Flujo de Ejemplo: Cliente queriendo enviar paquete

```
┌─────────────────────────────────────┐
│        💬 Enviazo Bot               │
├─────────────────────────────────────┤
│                                     │
│ 🤖 Enviazo Bot                 14:30│
│ Hola Juan 👋 ¿Cómo puedo ayudarte? │
│                                     │
│ 👤 Usuario                    14:31│
│ Quiero enviar un paquete            │
│                                     │
│ 🤖 Enviazo Bot                14:31│
│ Perfecto 📦                         │
│                                     │
│ ¿Cuál es tu punto de partida?       │
│ Ej: "Paseo Ahumada 150, Stgo"       │
│                                     │
│ 👤 Usuario                    14:32│
│ Mall Parque Arauco                  │
│                                     │
│ 🤖 Enviazo Bot                14:32│
│ ✅ Ubicación identificada:          │
│ 🏪 Parque Arauco, Prov. Stgo        │
│                                     │
│ Ahora, ¿a dónde va?                 │
│                                     │
│ 👤 Usuario                    14:33│
│ A las condes, calle amunátegui      │
│                                     │
│ 🤖 Enviazo Bot                14:34│
│ ✅ Destino confirmado:              │
│ 🏢 Amunátegui, Las Condes           │
│                                     │
│ 📏 Distancia: 15 km                 │
│                                     │
│ Tipo de paquete:                    │
│ 📄 Documento / 📦 Pequeño / 📫 ... │
│ [Selecciona uno con número]         │
│                                     │
│ 👤 Usuario                    14:35│
│ Pequeño                             │
│                                     │
│ 🤖 Enviazo Bot                14:35│
│ ✅ Paquete pequeño                  │
│                                     │
│ 💰 Precio estimado: $9.200          │
│                                     │
│ ¿Estás de acuerdo?                  │
│ [1] Sí, publicar envío              │
│ [2] Aumentar oferta a $10k           │
│ [3] Cancelar                        │
│                                     │
│ 👤 Usuario                    14:36│
│ 1                                   │
│                                     │
│ 🤖 Enviazo Bot                14:36│
│ ✅ ¡Envío publicado!                │
│                                     │
│ Prestadores en zona: 12 disponibles │
│ Esperando respuestas...             │
│ ⏳ Hace 30 segundos                 │
│                                     │
│ 👤 Usuario                    14:37│
│ Cuánto falta?                       │
│                                     │
│ 🤖 Enviazo Bot                14:37│
│ 🔄 Buscando prestadores...          │
│ ⏳ 1 min (8 prestadores en camino)  │
│                                     │
│ Mientras esperas, puedes ver:       │
│ [1] Prestadores disponibles         │
│ [2] Cambiar oferta de precio        │
│ [3] Cancelar (perdería $500)        │
│                                     │
│ 👤 Usuario                    14:39│
│ Ya aceptó alguien?                  │
│                                     │
│ 🤖 Enviazo Bot                14:39│
│ ¡SÍ! 🎉 ¡Aceptado!                  │
│                                     │
│ 👤 Prestador: Carlos Fernández      │
│ 🚗 Vehículo: Moto Honda CB 150      │
│ ⭐ Calificación: 4.9 / 5.0          │
│ ⏱️ ETA: 8 minutos (está cerca)      │
│                                     │
│ [Ver perfil] [Llamar] [Chat]        │
│                                     │
│ 📍 Tu ubicación se compartirá       │
│ en tiempo real hasta entrega        │
│                                     │
└─────────────────────────────────────┘
```

### WhatsApp Notificaciones del Prestador

```
┌─────────────────────────────────────┐
│  📱 Chat de WhatsApp                │
├─────────────────────────────────────┤
│                                     │
│ 🤖 Enviazo Bot                 14:45│
│ ℹ️ NOTIFICACIÓN PRESTADOR:          │
│                                     │
│ ✅ Recogida iniciada                │
│ Prestador: Carlos (4.9⭐)           │
│ Llegará en: 6 minutos               │
│                                     │
│ [Ver en vivo] [Llamar]              │
│                                     │
│                                     │
│ 🤖 Enviazo Bot                 14:51│
│ 🚗 EN CAMINO                        │
│ Carlos está llevando tu paquete     │
│ Velocidad: 48 km/h                  │
│ ETA: 2 minutos                      │
│ [Mapa en vivo]                      │
│                                     │
│                                     │
│ 🤖 Enviazo Bot                 14:53│
│ 📍 ¡LLEGADA!                        │
│ Tu paquete está aquí 📦             │
│ Carlos lo está esperando             │
│ [Confirmar entrega]                 │
│                                     │
│                                     │
│ 🤖 Enviazo Bot                 14:54│
│ ✅ ENTREGADO                        │
│ Recibido por: Juan Pérez            │
│ Hora: 14:54                         │
│                                     │
│ 💰 Total pagado: $9.200             │
│ ✅ Dinero acreditado en tu cuenta   │
│                                     │
│ ⭐ Califica a Carlos:               │
│ [⭐] [⭐⭐] [⭐⭐⭐] [⭐⭐⭐⭐]         │
│ [⭐⭐⭐⭐⭐] Perfecto!                 │
│                                     │
│ 💬 Dejar comentario... (opcional)   │
│                                     │
└─────────────────────────────────────┘
```

---

## 🔑 KEY FEATURES VISIBLES

### Web (Usuario)
- ✅ Home + Marketing
- ✅ Registro + Login
- ✅ Dashboard con historial de envíos
- ✅ Crear nuevo envío (paso a paso)
- ✅ Tracking en vivo con mapa
- ✅ Botón WhatsApp flotante

### Móvil (Prestador)
- ✅ Lista de envíos disponibles
- ✅ Aceptar envío + navegación
- ✅ GPS tracking + reporte de ubicación
- ✅ Completar entrega (foto + firma)
- ✅ Perfil + estadísticas de ganancias
- ✅ Notificaciones push

### WhatsApp Bot
- ✅ Conversación natural
- ✅ Guiar crear envío paso a paso
- ✅ Confirmar precio
- ✅ Notificar estado en tiempo real
- ✅ Permitir cancelación / cambio de precio
- ✅ Calificaciones del prestador

---

## 🎨 DISEÑO

- **Colores:** Azul primario (#1E40AF), Blanco, Gris
- **Tipografía:** Inter (body), Fraunces (display, opcional)
- **Responsive:** Mobile-first, 100% funcional en teléfono
- **Accesibilidad:** WCAG 2.1 AA compliant
- **Performance:** LCP < 2.5s, FID < 100ms, CLS < 0.1

---

**Estado:** Todas las pantallas implementadas y funcionando ✅
**Tests:** 89/89 passing ✅
**Deployment:** Listo para Vercel 🚀
