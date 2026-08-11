# 🚀 ENVIAZO — DEPLOY STEP-BY-STEP

**Date:** 2026-08-11  
**Status:** Ready for production  
**Tests:** 89/89 passing ✅  
**TypeScript:** 0 errors ✅

---

## 📋 PRE-DEPLOYMENT CHECKLIST

Before starting, ensure you have:

```
✅ Git repo clean (git status)
✅ All tests passing (npm test)
✅ .env files filled (use .env.example as template)
✅ Supabase migrations applied (db push)
✅ Domain name acquired (or use ngrok for testing)
✅ Stripe account (or use cash-only mode for MVP)
✅ Firebase project created
✅ WhatsApp Business Account setup
✅ Google Maps API enabled
```

---

## 🔐 STEP 0: Secure Your Credentials

**CRITICAL: Never commit secrets to git**

```bash
# Backend
cd apps/backend
cp .env.example .env.local
# Edit .env.local with REAL credentials (keep it LOCAL ONLY)

# Web Client
cd ../web-client
cp .env.example .env.local
# Edit with NEXT_PUBLIC_* keys

# Mobile
cd ../mobile-provider
cp .env.example .env.local
# Edit with EXPO_PUBLIC_* keys

# Verify .gitignore has .env.local
grep -r "\.env\.local" .gitignore  # Should exist
```

---

## 🏗️ STEP 1: Local Testing

**Backend health check:**
```bash
cd apps/backend
npm run dev
# Wait for "Server running on port 3002"
curl http://localhost:3002/health
# Should return: {"status":"healthy",...}
```

**Database connection test:**
```bash
# In another terminal
cd apps/backend
npm test
# Must show: "Test Files 5 passed (5), Tests 89 passed (89)"
```

**Frontend + Backend integration:**
```bash
cd apps/web-client
npm run dev
# Wait for "Local: http://localhost:3000"
# Open in browser, test login → new shipment → payment
```

**Mobile app (local):**
```bash
cd apps/mobile-provider
npm run start
# Scan QR with Expo Go app
# Test: Login → Accept shipment → Report location
```

---

## 🌐 STEP 2: Deploy Backend (Node.js API)

### Option A: Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy from root
cd apps/backend
vercel deploy --prod

# Set environment variables in Vercel dashboard:
# Dashboard → Settings → Environment Variables
# Paste contents of apps/backend/.env (ALL variables)

# Verify
curl https://your-backend-vercel.app/health
```

### Option B: Railway.app

```bash
# 1. Push code to GitHub
git push origin main

# 2. Go to https://railway.app → New Project → GitHub Repo
# Select: cafe-puerto-varas/logistica-app

# 3. Configure:
#    - Select deployment directory: apps/backend
#    - Add environment variables (from .env)
#    - Set build: npm run build
#    - Set start: npm start

# 4. Deploy automatically on push
```

### Option C: AWS EC2 (Manual)

```bash
# 1. SSH into EC2 instance
ssh -i key.pem ubuntu@your-ec2-ip

# 2. Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Clone repo and install
git clone https://github.com/yourusername/cafe-puerto-varas.git
cd cafe-puerto-varas/apps/backend
npm install
npm run build

# 4. Use PM2 for process management
npm install -g pm2
pm2 start dist/index.js --name "enviazo-api"
pm2 save
pm2 startup

# 5. Configure Nginx as reverse proxy
sudo apt install -y nginx
# Create /etc/nginx/sites-available/default with:
# upstream api { server localhost:3002; }
# server { listen 80; server_name api.tu-dominio.com;
#   location / { proxy_pass http://api; } }
sudo systemctl restart nginx
```

**Verify backend is live:**
```bash
curl https://api.tu-dominio.com/health
```

---

## 🌐 STEP 3: Deploy Web Client (Next.js)

### Option A: Vercel (Recommended)

```bash
cd apps/web-client
vercel deploy --prod

# Set environment variables in Vercel dashboard:
NEXT_PUBLIC_API_URL=https://api.tu-dominio.com
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

### Option B: Netlify

```bash
# 1. Connect GitHub repo
# 2. Build settings:
#    - Base directory: apps/web-client
#    - Build command: npm run build
#    - Publish directory: .next
# 3. Deploy → Set env vars
```

**Verify web client is live:**
```bash
curl https://tu-dominio.com/ | grep "Enviazo"
```

---

## 📱 STEP 4: Deploy Mobile App

### iOS (App Store)

```bash
cd apps/mobile-provider

# Build
eas build --platform ios --profile production

# When build completes, submit to TestFlight
eas submit --platform ios
# → Choose the build from Step 1

# In App Store Connect:
# 1. Create new version
# 2. Add TestFlight testers
# 3. Submit for review
# 4. After approval, release
```

### Android (Google Play)

```bash
cd apps/mobile-provider

# Build
eas build --platform android --profile production

# Submit
eas submit --platform android
# → Choose Google Play Console service account

# In Google Play Console:
# 1. Create release
# 2. Add build
# 3. Roll out to testing → production
```

---

## 🔗 STEP 5: Configure Webhooks

### Stripe Webhook

```bash
# In Stripe Dashboard:
# 1. Developers → Webhooks → Add endpoint
# 2. URL: https://api.tu-dominio.com/api/payments/webhook/stripe
# 3. Events: payment_intent.succeeded, payment_intent.payment_failed
# 4. Get signing secret → Set STRIPE_WEBHOOK_SECRET in backend .env
```

### WhatsApp Webhook

```bash
# In Meta Business Platform:
# 1. WhatsApp Business → Configuration
# 2. Webhook URL: https://api.tu-dominio.com/webhook/whatsapp
# 3. Verify token: Set WHATSAPP_WEBHOOK_VERIFY_TOKEN in backend .env
# 4. Subscribe to: messages, message_status
```

---

## ✅ POST-DEPLOYMENT TESTS

### End-to-End Flow

```bash
# 1. Web: Register new customer
curl -X POST https://api.tu-dominio.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123","name":"Test User"}'

# 2. Web: Create shipment
curl -X POST https://api.tu-dominio.com/api/orders \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"origin":"...","destination":"...","weight":5}'

# 3. Mobile: Login as provider
# (via app)

# 4. Mobile: Accept shipment
# (via app)

# 5. Web: Verify tracking updates
curl https://api.tu-dominio.com/api/tracking/SHIPMENT_ID \
  -H "Authorization: Bearer YOUR_TOKEN"

# 6. Mobile: Report location
curl -X POST https://api.tu-dominio.com/api/tracking/SHIPMENT_ID/location \
  -H "Authorization: Bearer PROVIDER_TOKEN" \
  -d '{"lat":-33.8688,"lng":-51.2093}'

# 7. Web: Verify location appears on map
# (via browser)

# 8. Mobile: Deliver shipment
# (via app)

# 9. Web: Verify delivery status
curl https://api.tu-dominio.com/api/orders/SHIPMENT_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Monitoring

```bash
# Health checks (add to cron/monitoring)
curl https://api.tu-dominio.com/health

# Expected response:
{
  "status": "healthy",
  "checks": {
    "database": {"status": "healthy"},
    "redis": {"status": "healthy"},
    "disk": {"status": "healthy"}
  }
}
```

---

## 🆘 TROUBLESHOOTING

### "Connection refused" to backend

```bash
# 1. Check backend is running
curl http://localhost:3002/health

# 2. Check firewall allows port
sudo ufw allow 3002

# 3. Check CORS is configured
# CORS_ORIGIN should include your frontend domain
```

### "Payment webhook not triggering"

```bash
# 1. Verify webhook URL is accessible
curl -X POST https://api.tu-dominio.com/api/payments/webhook/stripe \
  -H "stripe-signature: test" \
  -d '{}'

# 2. Verify signing secret is set
grep STRIPE_WEBHOOK_SECRET .env

# 3. Check Stripe dashboard for failed events
# Developers → Events → View details
```

### "Mobile app can't reach backend"

```bash
# 1. Verify EXPO_PUBLIC_API_URL
grep EXPO_PUBLIC_API_URL .env.local

# 2. Test API connectivity from mobile
# (via app: Settings → Test Connection)

# 3. Check CORS from mobile origin
# Backend CORS_ORIGIN should include app's origin
```

### "GPS not reporting"

```bash
# 1. Check permissions in app
# Mobile → Settings → Permissions

# 2. Verify location tracking endpoint
curl -X POST https://api.tu-dominio.com/api/tracking/SHIPMENT/location \
  -H "Authorization: Bearer TOKEN" \
  -d '{"lat":0,"lng":0}'

# 3. Check DB has entries
# SELECT * FROM location_history WHERE shipment_id='...'
```

---

## 🎯 ROLLBACK PROCEDURE

If deployment fails:

```bash
### Vercel
vercel rollback enviazo-backend

### Railway
# In Dashboard: Deployments → Select previous → Redeploy

### Manual
git reset --hard HEAD~1
npm run build
pm2 restart enviazo-api
```

---

## 📞 ESCALATION

| Issue | Owner | Action |
|-------|-------|--------|
| Database down | Supabase | Check dashboard.supabase.com |
| API errors | Team | Check logs: `journalctl -u enviazo-api -f` |
| Payment issues | Stripe | Check Stripe Dashboard events |
| Mobile crashes | Team | Check Sentry dashboard |
| Performance | Team | Profile with Chrome DevTools |

---

**Last Updated:** 2026-08-11  
**Ready for deployment:** YES ✅  
**Estimated time to deploy:** 2-3 hours (mostly waiting for builds)
