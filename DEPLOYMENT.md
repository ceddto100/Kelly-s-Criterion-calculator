# Deployment Guide - Render

This guide will help you deploy the Kelly Criterion MCP Server to Render.

## Overview

This project is a monorepo with multiple components:
- **mcp-server** - Primary application (Node.js/Express with Model Context Protocol)
- component - React widgets for ChatGPT
- frontend - Legacy React app
- backend - Legacy Node.js API

The Render deployment is configured to deploy the **mcp-server** as the primary service.

## Prerequisites

1. A [Render account](https://render.com) (free tier available)
2. This repository connected to your GitHub account
3. Optional: Gemini API key if you want AI-powered insights

## Automatic Deployment (Recommended)

Render will automatically detect the `render.yaml` file in the root of your repository.

### Steps:

1. **Connect Repository to Render**
   - Go to [Render Dashboard](https://dashboard.render.com/)
   - Click "New +" → "Blueprint"
   - Connect your GitHub repository
   - Select this repository

2. **Configure Environment Variables**

   Render will prompt you to set environment variables defined in `render.yaml`. You need to configure:

   **Required:**
   - `NODE_ENV` - Already set to `production`
   - `PORT` - Already set to `10000` (Render default)

   **Important:**
   - `ALLOWED_ORIGINS` - **CRITICAL for CORS**
     - After deployment, update this to include your Render URL
     - Format: `https://chatgpt.com,https://your-app-name.onrender.com`
     - Example: `https://chatgpt.com,https://kelly-criterion-mcp-server.onrender.com`

   **Optional:**
   - `GEMINI_API_KEY` - Only needed if using AI-powered insights
     - Get your key from [Google AI Studio](https://makersuite.google.com/app/apikey)

3. **Deploy**
   - Click "Apply" to create the service
   - Render will automatically build and deploy your application
   - First deployment takes 3-5 minutes

4. **Update ALLOWED_ORIGINS (Important!)**
   - Once deployed, copy your Render URL (e.g., `https://your-app.onrender.com`)
   - Go to your service → Environment
   - Update `ALLOWED_ORIGINS` to: `https://chatgpt.com,https://your-app.onrender.com`
   - Save changes (this will trigger a redeploy)

## Manual Deployment

If you prefer manual setup:

1. **Create New Web Service**
   - Go to Render Dashboard
   - Click "New +" → "Web Service"
   - Connect your repository

2. **Configure Service**
   - **Name:** kelly-criterion-mcp-server
   - **Runtime:** Node
   - **Build Command:** `cd mcp-server && npm install && npm run build`
   - **Start Command:** `cd mcp-server && npm start`
   - **Plan:** Free (or choose your preferred plan)

3. **Add Environment Variables** (see above section)

4. **Deploy**

## Verifying Deployment

Once deployed, test your endpoints:

### Health Check
```bash
curl https://your-app.onrender.com/health
```

Expected response:
```json
{
  "status": "ok",
  "name": "kelly-criterion-calculator",
  "version": "1.0.0",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Server Discovery
```bash
curl https://your-app.onrender.com/
```

Expected response:
```json
{
  "name": "Kelly Criterion MCP Server",
  "version": "1.0.0",
  "description": "Custom MCP server for Kelly Criterion calculations and probability estimation.",
  "mcp_endpoint": "/mcp",
  "capabilities": {
    "tools": [
      "kelly-calculate",
      "probability-estimate-football",
      "probability-estimate-basketball",
      "unit-calculate"
    ],
    "supports_streaming": true
  }
}
```

### MCP Endpoint (SSE)
The MCP endpoint at `/mcp` uses Server-Sent Events (SSE) for real-time communication.

Test with curl (will establish SSE connection):
```bash
curl -N https://your-app.onrender.com/mcp
```

## Connecting to ChatGPT

Once deployed, you can connect this MCP server to ChatGPT:

1. Go to [ChatGPT](https://chatgpt.com)
2. Open GPT Builder or Custom GPT settings
3. Add your Render URL as an action endpoint: `https://your-app.onrender.com/mcp`
4. Configure authentication (if required)

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | 10000 | Server port (Render sets this automatically) |
| `NODE_ENV` | Yes | production | Node environment |
| `ALLOWED_ORIGINS` | Yes | https://chatgpt.com | Comma-separated CORS origins |
| `GEMINI_API_KEY` | No | - | Google Gemini API key for AI insights |

## Troubleshooting

### Build Failures

**Issue:** Build fails with "Cannot find module"
- **Solution:** Ensure all dependencies are in `mcp-server/package.json`
- Run locally: `cd mcp-server && npm install && npm run build`

**Issue:** TypeScript compilation errors
- **Solution:** Fix type errors locally first
- Run: `cd mcp-server && npm run type-check`

### Runtime Errors

**Issue:** 502 Bad Gateway
- **Solution:** Check Render logs for startup errors
- Verify `dist/server.js` exists after build
- Ensure `PORT` environment variable is respected

**Issue:** CORS errors in browser
- **Solution:** Update `ALLOWED_ORIGINS` to include your Render URL
- Format: `https://chatgpt.com,https://your-app.onrender.com`
- Remember to redeploy after updating environment variables

**Issue:** Health check failing
- **Solution:** Ensure `/health` endpoint is accessible
- Check that server is listening on the correct PORT
- Review application logs in Render dashboard

### Connection Issues

**Issue:** MCP connection not establishing
- **Solution:**
  - Verify SSE transport is working (curl the `/mcp` endpoint)
  - Check browser console for connection errors
  - Ensure CORS is properly configured

## Free Tier Limitations

Render's free tier includes:
- ✅ 750 hours per month
- ✅ Automatic SSL certificates
- ✅ Custom domains
- ⚠️ Services spin down after 15 minutes of inactivity
- ⚠️ Cold starts take ~30 seconds

### Handling Cold Starts

When using the free tier, your service will spin down after inactivity. The first request after spin-down will take longer (~30s).

**Solutions:**
1. Upgrade to paid plan ($7/month) for always-on service
2. Use a service like [UptimeRobot](https://uptimerobot.com/) to ping your health endpoint
3. Accept cold starts for development/testing

## Updating Deployment

Render automatically deploys when you push to your main branch (if auto-deploy is enabled).

To manually trigger a deployment:
1. Go to your service in Render Dashboard
2. Click "Manual Deploy" → "Deploy latest commit"

## Logs and Monitoring

View logs in real-time:
1. Go to Render Dashboard
2. Select your service
3. Click "Logs" tab

Logs include:
- Build output
- Application console logs
- Error messages
- Request logs

## Custom Domain (Optional)

To use a custom domain:
1. Go to your service settings
2. Click "Custom Domain"
3. Add your domain
4. Update DNS records as instructed
5. Update `ALLOWED_ORIGINS` to include your custom domain

## Production Checklist

Before going to production:

- [ ] All environment variables configured
- [ ] `ALLOWED_ORIGINS` includes your Render URL
- [ ] Health check endpoint returns 200 OK
- [ ] Server discovery endpoint returns correct data
- [ ] MCP endpoint establishes SSE connection
- [ ] CORS properly configured for your client origins
- [ ] Error handling tested
- [ ] Logs reviewed for warnings/errors
- [ ] Consider upgrading to paid plan for always-on service

## Support

- **Render Documentation:** https://render.com/docs
- **MCP Protocol:** https://modelcontextprotocol.io/
- **Project Issues:** Create an issue in this repository

## Next Steps

1. ✅ Deploy to Render using this guide
2. Test all endpoints and verify functionality
3. Connect to ChatGPT or your preferred MCP client
4. Monitor logs and performance
5. Consider deploying frontend separately (optional)

---

**Deployed successfully?** Don't forget to update `ALLOWED_ORIGINS` with your Render URL! 🚀
