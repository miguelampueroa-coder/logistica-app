# 🚚 App de Logística de Envíos

Plataforma tipo Uber para envíos de paquetes. Cualquier persona puede publicar un envío y cualquier prestador con vehículo puede tomarlo.

## 📋 Descripción

Esta aplicación permite a los clientes publicar paquetes con detalles completos (dimensiones, peso, fotos) y a los prestadores de servicios de transporte aceptar y entregar los envíos usando cualquier tipo de vehículo compatible.

## 🏗️ Arquitectura

```
logistica-app/
├── apps/
│   ├── backend/          # API Express.js
│   ├── web-client/       # Next.js (clientes)
│   └── mobile-provider/  # React Native (prestadores)
├── supabase/
│   └── migrations/       # SQL migrations
└── docs/                 # Documentación
```

## 🛠️ Tech Stack

| Componente | Tecnología |
|------------|------------|
| Backend | Express.js + TypeScript |
| Base de datos | Supabase (PostgreSQL) |
| Auth | JWT + Supabase Auth |
| Validaciones | Zod |
| Seguridad | Helmet, Rate Limiting, RLS |

## 🚀 Inicio Rápido

### Prerrequisitos

- Node.js 18+
- npm o yarn
- Supabase account (https://supabase.com)

### Instalación

```bash
# Clonar repositorio
git clone <repo-url>
cd logistica-app

# Instalar dependencias del backend
cd apps/backend
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales de Supabase

# Ejecutar migración SQL en Supabase Dashboard
# Copiar contenido de supabase/migrations/001_initial_schema.sql

# Iniciar servidor de desarrollo
npm run dev
```

### Variables de Entorno

```env
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
JWT_SECRET=tu-secreto-jwt-minimo-16-caracteres
JWT_EXPIRES_IN=24h
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3001
```

## 📡 API Endpoints

### Autenticación

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| POST | `/api/auth/register` | Registro de usuario | No |
| POST | `/api/auth/login` | Inicio de sesión | No |

### Usuarios

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| GET | `/api/user/profile` | Ver perfil | Sí |
| PUT | `/api/user/profile` | Actualizar perfil | Sí |
| POST | `/api/user/vehicles` | Agregar vehículo | Sí (provider) |
| GET | `/api/user/vehicles` | Ver mis vehículos | Sí (provider) |
| GET | `/api/user/earnings` | Ver ganancias | Sí (provider) |

### Envíos

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| POST | `/api/orders` | Crear envío | Sí (client) |
| GET | `/api/orders` | Ver mis envíos | Sí |
| GET | `/api/orders/available` | Envíos disponibles | Sí (provider) |
| GET | `/api/orders/:id` | Detalle envío | Sí |
| POST | `/api/orders/:id/accept` | Aceptar envío | Sí (provider) |
| POST | `/api/orders/:id/pickup` | Recoger paquete | Sí (provider) |
| POST | `/api/orders/:id/deliver` | Marcar entregado | Sí (provider) |

## 💰 Algoritmo de Tarifas

```
Precio = (Distancia × 700) + RecargoPeso + RecargoVolumen + RecargoUrgencia
```

| Concepto | Valor |
|----------|-------|
| Tarifa base | 700 CLP/km |
| Urgencia | +300 CLP |
| Peso extra (>10kg) | +100 CLP/kg |
| Volumen extra (>0.5m³) | +500 CLP/m³ |

**Multiplicador por vehículo:**
- Moto: 1.0x
- Auto: 1.2x
- Furgoneta: 1.5x
- Camioneta: 1.8x
- Microbús: 2.2x
- Camión: 2.5x

## 🔐 Seguridad

- **JWT**: Tokens con expiración de 24 horas
- **RLS**: Row Level Security en todas las tablas
- **Rate Limiting**: 100 requests por 15 minutos
- **Helmet**: Headers de seguridad HTTP
- **Validaciones**: Zod para todos los inputs

## 📊 Roadmap

| Fase | Descripción | Estado |
|------|-------------|--------|
| Fase 1 | Backend + Base de datos | ✅ Completado |
| Fase 2 | Auth + CRUD Básico | ✅ Completado |
| Fase 3 | Algoritmo tarifas | ✅ Completado |
| Fase 4 | Web Client (Next.js) | 🔄 Pendiente |
| Fase 5 | Mobile Provider (React Native) | 🔄 Pendiente |
| Fase 6 | Tracking en tiempo real | 🔄 Pendiente |
| Fase 7 | Sistema de pagos | 🔄 Pendiente |

## 📁 Estructura del Backend

```
apps/backend/
├── src/
│   ├── config/
│   │   ├── database.ts      # Cliente Supabase
│   │   └── env.ts           # Variables de entorno
│   ├── middleware/
│   │   ├── auth.ts          # JWT verification
│   │   ├── validate.ts      # Input validation
│   │   └── errorHandler.ts  # Error handling
│   ├── routes/
│   │   ├── auth.routes.ts   # Rutas de autenticación
│   │   ├── order.routes.ts  # Rutas de envíos
│   │   └── user.routes.ts   # Rutas de usuario
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   ├── order.controller.ts
│   │   └── user.controller.ts
│   ├── services/
│   │   └── pricing.service.ts
│   ├── types/
│   │   └── index.ts
│   └── index.ts
├── .env.example
├── package.json
└── tsconfig.json
```

## 🤝 Contribuir

1. Fork el proyecto
2. Crear branch (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -m 'Agregar nueva funcionalidad'`)
4. Push a la branch (`git push origin feature/nueva-funcionalidad`)
5. Abrir Pull Request

## 📄 Licencia

MIT License

## 📞 Contacto

- Email: tu-email@ejemplo.com
- GitHub: tu-usuario
