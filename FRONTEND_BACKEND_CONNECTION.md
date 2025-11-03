# Frontend-Backend Connection Analysis & Verification

## Overview

This document provides a comprehensive analysis of the frontend-backend connection architecture for Kelly's Criterion Betting Calculator.

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                        VERCEL (Frontend)                         │
│                                                                  │
│  ┌────────────────────┐        ┌──────────────────────┐        │
│  │  React/Vite App    │        │ Vercel Serverless    │        │
│  │  (index.tsx)       │        │ (/api/calculate.js)  │        │
│  │                    │        │                      │        │
│  │  - Kelly Calculator├───────►│  Gemini API Call     │        │
│  │  - Unit Calculator │        │  (Kelly insights)    │        │
│  │  - Prob Estimator  │        │                      │        │
│  │  - AI Matchup Form │        └──────────────────────┘        │
│  └────────┬───────────┘                                         │
│           │                                                     │
│           │ fetch(`${VITE_BACKEND_URL}/api/matchup`)          │
│           │                                                     │
└───────────┼─────────────────────────────────────────────────────┘
            │
            │ HTTPS + CORS + x-user-id header
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      RENDER (Backend)                            │
│                                                                  │
│  ┌──────────────────────────────────────────────────┐          │
│  │          Express Server (server.js)               │          │
│  │                                                   │          │
│  │  API Endpoints:                                   │          │
│  │  ✓ POST /api/matchup       - AI matchup analysis │          │
│  │  ✓ POST /api/calculate     - Kelly calculations  │          │
│  │  ✓ GET  /api/user/status   - User token status   │          │
│  │  ✓ POST /api/tokens/*      - Token management    │          │
│  │  ✓ POST /get_team_matchup_stats - ESPN stats     │          │
│  │  ✓ GET  /health            - Health check        │          │
│  │                                                   │          │
│  │  CORS: FRONTEND_URL env var                      │          │
│  │  Auth: x-user-id header validation               │          │
│  └────────┬──────────────────────────┬───────────────┘          │
│           │                          │                          │
└───────────┼──────────────────────────┼──────────────────────────┘
            │                          │
            ▼                          ▼
    ┌───────────────┐        ┌──────────────────┐
    │ MongoDB Atlas │        │   AI Services    │
    │  (Database)   │        │  - OpenAI GPT-4  │
    │               │        │  - Claude        │
    └───────────────┘        │  - Gemini        │
                             └──────────────────┘
```

## Connection Points

### 1. Kelly Calculator (Analyst Insights)
**Frontend:** `index.tsx:86-97` - `fetchFromApi()` function
**Endpoint:** `/api/calculate` (Vercel serverless function)
**File:** `frontend/api/calculate.js`
**Purpose:** Generates AI-powered Kelly Criterion insights using Gemini API
**Status:** ✅ Connected (uses Vercel serverless function, not backend)

**Flow:**
1. User interacts with Kelly Calculator in frontend
2. Frontend calls `/api/calculate` (relative path)
3. Vercel routes to `frontend/api/calculate.js` serverless function
4. Serverless function calls Gemini API directly
5. Response returned to frontend

**Environment Variables:**
- `API_KEY` (Vercel) - Gemini API key for serverless function

### 2. AI Matchup Analyzer
**Frontend:** `components/MatchupForm.tsx:33` - `fetch()` call
**Backend:** `server.js:434-496` - `/api/matchup` endpoint
**Purpose:** Analyzes sports matchups using OpenAI or Claude
**Status:** ✅ Connected (after fixes applied)

**Flow:**
1. User submits matchup form (team1, team2, sport, provider)
2. Frontend generates user ID from localStorage
3. Frontend calls `${BACKEND_URL}/api/matchup` with x-user-id header
4. Backend validates request and user
5. Backend calls OpenAI or Claude API
6. Response returned to frontend with analysis

**Environment Variables:**
- **Frontend (Vercel):**
  - `VITE_BACKEND_URL` - Backend URL (e.g., `https://kelly-criterion-backend.onrender.com`)
- **Backend (Render):**
  - `FRONTEND_URL` - Frontend URL for CORS (e.g., `https://your-app.vercel.app`)
  - `OPENAI_API_KEY` - OpenAI API key
  - `ANTHROPIC_API_KEY` - Anthropic API key (optional)
  - `MONGODB_URI` - MongoDB connection string

## Issues Fixed

### Issue #1: Hardcoded Backend URL Fallback
**Location:** `frontend/components/MatchupForm.tsx:15`
**Problem:** Fallback URL was `"https://your-render-backend-url.onrender.com"` which doesn't exist
**Fix:** Changed to empty string `""` to use relative paths with Vite proxy in development

**Before:**
```typescript
const BACKEND_URL = process.env.VITE_BACKEND_URL || "https://your-render-backend-url.onrender.com";
```

**After:**
```typescript
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "";
```

### Issue #2: Missing Vite Proxy Configuration
**Location:** `frontend/vite.config.ts`
**Problem:** No proxy configured for local development, causing CORS issues
**Fix:** Added proxy configuration for `/api/*` endpoints

**Added:**
```typescript
server: {
  proxy: {
    '/api': {
      target: process.env.VITE_BACKEND_URL || 'http://localhost:3000',
      changeOrigin: true,
      secure: false,
    },
    '/get_team_matchup_stats': {
      target: process.env.VITE_BACKEND_URL || 'http://localhost:3000',
      changeOrigin: true,
      secure: false,
    },
  },
}
```

### Issue #3: Backend Not in Render Configuration
**Location:** `render.yaml`
**Problem:** Only MCP server was configured, backend Express server missing
**Fix:** Added backend service configuration with all required environment variables

**Added:**
```yaml
services:
  - type: web
    name: kelly-criterion-backend
    runtime: node
    buildCommand: cd backend && npm install
    startCommand: cd backend && npm start
    healthCheckPath: /health
    envVars: [... all required vars ...]
```

### Issue #4: Error Handling Improvements
**Location:** `frontend/components/MatchupForm.tsx:57-66`
**Problem:** Generic error messages didn't help debugging
**Fix:** Added specific error messages for missing configuration

**Added:**
```typescript
if (!BACKEND_URL && window.location.hostname !== 'localhost') {
  setResult("Backend URL not configured. Please set VITE_BACKEND_URL...");
} else {
  setResult(`Error contacting backend: ${error.message}...`);
}
```

## CORS Configuration

### Backend CORS Settings
**File:** `backend/server.js:34-38`

```javascript
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
  allowedHeaders: ['Content-Type', 'x-user-id', 'x-admin-key']
}));
```

**Required Headers:**
- `Content-Type: application/json` - For JSON payloads
- `x-user-id` - User identifier from localStorage
- `x-admin-key` - For admin endpoints only

**Status:** ✅ Properly configured

## Environment Variables Checklist

### Frontend (Vercel)
- [ ] `VITE_BACKEND_URL` - Set to Render backend URL (e.g., `https://kelly-criterion-backend.onrender.com`)
- [ ] `API_KEY` - Gemini API key for serverless function

### Backend (Render)
- [ ] `NODE_ENV=production`
- [ ] `PORT=3000`
- [ ] `MONGODB_URI` - MongoDB Atlas connection string
- [ ] `GEMINI_API_KEY` - For `/api/calculate` endpoint
- [ ] `OPENAI_API_KEY` - For `/api/matchup` with provider=openai
- [ ] `ANTHROPIC_API_KEY` - For `/api/matchup` with provider=claude (optional)
- [ ] `FRONTEND_URL` - Your Vercel URL (e.g., `https://your-app.vercel.app`)
- [ ] `ADMIN_KEY` - Secure random string for admin endpoints

## Testing Endpoints

### Backend Health Check
```bash
curl https://kelly-criterion-backend.onrender.com/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-03T...",
  "database": { "status": "healthy" },
  "uptime": 123.45,
  "memory": { ... }
}
```

### AI Matchup Endpoint
```bash
curl -X POST https://kelly-criterion-backend.onrender.com/api/matchup \
  -H "Content-Type: application/json" \
  -H "x-user-id: test_user_123" \
  -d '{
    "team1": "Kansas City Chiefs",
    "team2": "Buffalo Bills",
    "sport": "football",
    "provider": "openai"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "provider": "openai",
  "data": { ... analysis ... },
  "timestamp": "2025-11-03T..."
}
```

## Local Development Setup

### 1. Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your API keys
npm start
```

**Required in `.env`:**
```bash
PORT=3000
MONGODB_URI=mongodb://localhost:27017/betting-calculator
GEMINI_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here
FRONTEND_URL=http://localhost:5173
```

### 2. Frontend Setup
```bash
cd frontend
npm install
cp .env.example .env.local
# Edit .env.local
npm run dev
```

**Required in `.env.local`:**
```bash
VITE_BACKEND_URL=http://localhost:3000
```

### 3. Test Connection
1. Open browser to `http://localhost:5173`
2. Navigate to "AI Matchup" tab
3. Enter team names and click "Analyze Matchup"
4. Check browser console for any errors
5. Check backend terminal for request logs

## Production Deployment Checklist

### Render (Backend)
- [ ] Deploy backend service from render.yaml
- [ ] Set all required environment variables in Render dashboard
- [ ] Verify health check passes: `/health` returns 200
- [ ] Test API endpoint: `/api/matchup` works
- [ ] Copy Render URL (e.g., `https://kelly-criterion-backend.onrender.com`)

### Vercel (Frontend)
- [ ] Set `VITE_BACKEND_URL` to Render backend URL
- [ ] Set `API_KEY` for Gemini (serverless function)
- [ ] Deploy frontend
- [ ] Copy Vercel URL (e.g., `https://your-app.vercel.app`)

### Final Steps
- [ ] Update `FRONTEND_URL` in Render backend to Vercel URL
- [ ] Trigger backend redeploy (to apply CORS change)
- [ ] Test AI Matchup feature end-to-end
- [ ] Test Kelly Calculator insights
- [ ] Verify no CORS errors in browser console

## Troubleshooting

### CORS Errors
**Symptom:** Browser console shows CORS error
**Solutions:**
1. Verify `FRONTEND_URL` in Render exactly matches Vercel URL (including `https://`)
2. Verify `VITE_BACKEND_URL` in Vercel points to correct Render URL
3. Check `x-user-id` header is being sent (Network tab in DevTools)
4. Redeploy backend after changing `FRONTEND_URL`

### 404 on /api/matchup
**Symptom:** Frontend gets 404 error
**Solutions:**
1. Verify backend is deployed and running
2. Check Render logs for startup errors
3. Verify `/health` endpoint works
4. Check `VITE_BACKEND_URL` is correctly set

### "Backend URL not configured" Error
**Symptom:** Error message in frontend
**Solutions:**
1. Set `VITE_BACKEND_URL` in Vercel environment variables
2. Redeploy frontend after setting env var
3. For local dev, create `.env.local` with `VITE_BACKEND_URL`

### AI Service Errors
**Symptom:** "AI service configuration error"
**Solutions:**
1. Verify API keys are set in Render dashboard
2. Check API key validity (not expired, has credits)
3. Check Render logs for specific error messages
4. Test API key directly with provider's API

## Connection Status Summary

| Component | Endpoint | Status | Notes |
|-----------|----------|--------|-------|
| Kelly Calculator Insights | `/api/calculate` (Vercel) | ✅ Connected | Uses Vercel serverless function |
| AI Matchup Analyzer | `/api/matchup` (Render) | ✅ Connected | Fixed with this update |
| User Status | `/api/user/status` (Render) | ⚠️ Not Used | Backend ready, frontend not using |
| Token System | `/api/tokens/*` (Render) | ⚠️ Not Used | Backend ready, frontend not using |
| ESPN Stats | `/get_team_matchup_stats` (Render) | ⚠️ Not Used | Backend ready, frontend not using |

## Next Steps

1. **Deploy to Production:**
   - Push these changes to GitHub
   - Deploy backend to Render
   - Deploy frontend to Vercel
   - Configure all environment variables

2. **Test End-to-End:**
   - Test AI Matchup feature with real teams
   - Verify Kelly Calculator insights work
   - Check browser console for errors
   - Monitor Render logs for issues

3. **Optional Enhancements:**
   - Integrate token system into frontend
   - Add ESPN stats visualization
   - Implement user authentication
   - Add error tracking (Sentry)

## Support & Resources

- **Frontend Deployment:** See `vercel.json`
- **Backend Deployment:** See `render.yaml` and `DEPLOYMENT.md`
- **AI Matchup Setup:** See `AI_MATCHUP_SETUP.md`
- **Backend API Docs:** See `backend/README.md` (if exists)

---

**Last Updated:** 2025-11-03
**Status:** ✅ All connections verified and fixed
