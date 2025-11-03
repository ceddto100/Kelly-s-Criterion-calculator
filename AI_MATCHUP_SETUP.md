# AI Matchup Analyzer - Setup Guide

This guide explains how to set up and configure the AI Matchup Analyzer feature that integrates your Vercel frontend with your Render backend.

## Architecture

- **Frontend**: Deployed on Vercel (React/Vite)
- **Backend**: Deployed on Render (Node.js/Express)
- **AI Providers**: OpenAI (GPT-4) or Anthropic Claude

## Frontend Setup (Vercel)

### 1. Environment Variables

You need to configure the backend URL in your Vercel project:

**Option A: Using Vercel Dashboard (Recommended)**
1. Go to your Vercel project settings
2. Navigate to "Environment Variables"
3. Add the following variable:
   - **Name**: `VITE_BACKEND_URL`
   - **Value**: `https://your-backend.onrender.com` (your actual Render URL)
   - **Environment**: Production, Preview, Development (select all)
4. Click "Save"
5. Redeploy your application

**Option B: Using Vercel CLI**
```bash
vercel env add VITE_BACKEND_URL
# Enter your Render backend URL when prompted
```

**Option C: For Local Development**
```bash
# In the frontend/ directory:
cp .env.example .env.local

# Edit .env.local:
VITE_BACKEND_URL=http://localhost:3000
```

### 2. Component Integration

The `MatchupForm` component is already configured in `frontend/components/MatchupForm.tsx` with:
- ✅ Automatic user ID generation and localStorage management
- ✅ Proper headers (`x-user-id`) sent with API requests
- ✅ Environment variable support for backend URL
- ✅ Error handling for CORS and network issues

## Backend Setup (Render)

### 1. Environment Variables

Configure these environment variables in your Render dashboard:

**Required Variables:**
```bash
# Server
PORT=3000
NODE_ENV=production

# Database (MongoDB Atlas recommended)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/betting-calculator

# AI Services
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here

# CORS (IMPORTANT!)
FRONTEND_URL=https://your-app.vercel.app

# Security
ADMIN_KEY=your_secure_random_admin_key
```

**Optional Variables:**
```bash
# Anthropic Claude (optional, for claude provider)
ANTHROPIC_API_KEY=your_anthropic_api_key_here
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# Rate Limiting (optional)
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 2. Getting API Keys

**OpenAI API Key:**
1. Go to https://platform.openai.com/api-keys
2. Create a new secret key
3. Copy and save it (you won't be able to see it again)
4. Add to Render environment variables as `OPENAI_API_KEY`

**Anthropic API Key (Optional):**
1. Go to https://console.anthropic.com/settings/keys
2. Create a new API key
3. Copy and save it
4. Add to Render environment variables as `ANTHROPIC_API_KEY`

**Gemini API Key:**
1. Go to https://aistudio.google.com/app/apikey
2. Create a new API key
3. Copy and save it
4. Add to Render environment variables as `GEMINI_API_KEY`

### 3. CORS Configuration

The backend is already configured to accept the `x-user-id` header:

```javascript
// backend/server.js:34-38
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
  allowedHeaders: ['Content-Type', 'x-user-id', 'x-admin-key']
}));
```

**Important**: Make sure `FRONTEND_URL` in Render matches your exact Vercel deployment URL (including `https://`).

## API Endpoints

### POST /api/matchup

Analyzes a sports matchup using AI.

**Request:**
```json
{
  "team1": "Kansas City Chiefs",
  "team2": "Buffalo Bills",
  "sport": "football",
  "provider": "openai"  // or "claude"
}
```

**Headers:**
- `Content-Type: application/json`
- `x-user-id: user_123456` (automatically sent by frontend)

**Response:**
```json
{
  "success": true,
  "provider": "openai",
  "data": {
    "team1_stats": { ... },
    "team2_stats": { ... },
    "analysis": "...",
    "recommendation": "..."
  },
  "timestamp": "2025-11-03T12:00:00.000Z"
}
```

## Testing

### Local Development Testing

1. **Start Backend:**
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your API keys
npm start
```

2. **Start Frontend:**
```bash
cd frontend
npm install
cp .env.example .env.local
# Edit .env.local: VITE_BACKEND_URL=http://localhost:3000
npm run dev
```

3. **Test the Integration:**
   - Open http://localhost:5173
   - Navigate to "AI Matchup" tab
   - Enter two teams (e.g., "Kansas City Chiefs" vs "Buffalo Bills")
   - Select sport and AI provider
   - Click "Analyze Matchup"

### Production Testing

1. **Deploy Backend to Render:**
   - Push your code to GitHub
   - Render will auto-deploy
   - Verify environment variables are set

2. **Deploy Frontend to Vercel:**
   - Push your code to GitHub
   - Vercel will auto-deploy
   - Verify `VITE_BACKEND_URL` is set

3. **Test Live:**
   - Visit your Vercel deployment URL
   - Navigate to "AI Matchup" tab
   - Test with real team names

### Testing with cURL

```bash
# Test backend directly (replace with your Render URL)
curl -X POST https://your-backend.onrender.com/api/matchup \
  -H "Content-Type: application/json" \
  -H "x-user-id: test_user_123" \
  -d '{
    "team1": "Kansas City Chiefs",
    "team2": "Buffalo Bills",
    "sport": "football",
    "provider": "openai"
  }'
```

## Troubleshooting

### CORS Errors

**Symptom:** Frontend shows CORS error in browser console

**Solutions:**
1. Verify `FRONTEND_URL` in Render matches your exact Vercel URL
2. Ensure Vercel URL includes `https://` protocol
3. Check that `x-user-id` header is being sent by frontend
4. Verify backend CORS configuration includes `x-user-id` in `allowedHeaders`

### API Key Errors

**Symptom:** "AI service configuration error" or "Invalid API key"

**Solutions:**
1. Verify API key is correctly set in Render environment variables
2. Check for typos in environment variable names
3. Ensure API key has proper permissions
4. Test API key directly with provider's API

### Backend Not Responding

**Symptom:** Frontend shows "Error contacting backend"

**Solutions:**
1. Check Render logs for errors
2. Verify backend is deployed and running
3. Test backend health: `curl https://your-backend.onrender.com/health`
4. Check MongoDB connection is working
5. Verify all required environment variables are set

### User ID Issues

**Symptom:** Backend returns 400 or validation errors

**Solutions:**
1. Clear browser localStorage and refresh
2. Verify `x-user-id` header is being sent (check Network tab in DevTools)
3. Check backend validation middleware accepts the header

### Rate Limiting

**Symptom:** "Too many requests" error

**Solutions:**
1. Wait for rate limit window to reset (default: 15 minutes)
2. Adjust `RATE_LIMIT_MAX_REQUESTS` in backend environment variables
3. For development, set a higher limit or disable rate limiting

## Security Notes

1. **Never commit API keys** to version control
2. **Use environment variables** for all sensitive data
3. **Rotate API keys** periodically
4. **Monitor API usage** to avoid unexpected costs
5. **Set appropriate rate limits** to prevent abuse
6. **Use HTTPS** for all production deployments

## Architecture Diagram

```
┌─────────────────┐
│   Vercel        │
│   (Frontend)    │
│                 │
│  - React/Vite   │
│  - MatchupForm  │
│  - User ID Gen  │
└────────┬────────┘
         │
         │ HTTPS + x-user-id header
         │
         ▼
┌─────────────────┐
│   Render        │
│   (Backend)     │
│                 │
│  - Express API  │
│  - CORS Config  │
│  - Validation   │
└────────┬────────┘
         │
         ├──────────► OpenAI API (GPT-4)
         │
         ├──────────► Anthropic API (Claude)
         │
         ├──────────► Gemini API (Calculations)
         │
         └──────────► MongoDB Atlas (Data)
```

## Next Steps

After setup is complete:

1. ✅ Test the integration end-to-end
2. ✅ Monitor API usage and costs
3. ✅ Set up error tracking (e.g., Sentry)
4. ✅ Configure CI/CD pipelines
5. ✅ Set up monitoring and alerts
6. ✅ Document any custom configurations

## Support

For issues or questions:
- Check Render logs for backend errors
- Check Vercel logs for frontend errors
- Review browser console for client-side errors
- Verify all environment variables are correctly set
