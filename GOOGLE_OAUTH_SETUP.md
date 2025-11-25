# Google OAuth 2.0 Authentication Setup Guide

This guide will walk you through setting up "Sign in with Google" authentication for the Kelly's Criterion Betting Calculator.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Google Cloud Console Setup](#google-cloud-console-setup)
- [Environment Configuration](#environment-configuration)
- [Local Development Setup](#local-development-setup)
- [Testing the Authentication Flow](#testing-the-authentication-flow)
- [Production Deployment](#production-deployment)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

- A Google account
- Node.js 18+ installed
- The application backend and frontend code

## Google Cloud Console Setup

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Select a project** → **New Project**
3. Enter a project name (e.g., "Kelly Criterion Calculator")
4. Click **Create**

### Step 2: Enable Required APIs

1. In your project, navigate to **APIs & Services** → **Library**
2. Search for **Google+ API** (or **People API**)
3. Click on it and press **Enable**

### Step 3: Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. If prompted, configure the OAuth consent screen:
   - Choose **External** (unless you have a Google Workspace)
   - Fill in required fields:
     - App name: "Kelly Criterion Calculator"
     - User support email: Your email
     - Developer contact: Your email
   - Click **Save and Continue**
   - Skip adding scopes (defaults are fine)
   - Add test users if needed (your email)
   - Click **Save and Continue**

4. Back to **Create OAuth client ID**:
   - Application type: **Web application**
   - Name: "Kelly Criterion Web Client"
   - **Authorized JavaScript origins**:
     - For local development: `http://localhost:3000`
     - For production: `https://your-domain.com`
   - **Authorized redirect URIs**:
     - For local development: `http://localhost:3000/auth/google/callback`
     - For production: `https://your-domain.com/auth/google/callback`
   - Click **Create**

5. **Copy your credentials**:
   - Client ID: `xxxxxxxxxx.apps.googleusercontent.com`
   - Client Secret: `GOCSPX-xxxxxxxxxxxxxxxxxxxx`
   - **Save these safely!**

---

## Environment Configuration

### Backend Configuration

1. Navigate to the `backend` folder
2. Copy the example environment file:
   ```bash
   cd backend
   cp .env.example .env
   ```

3. Edit `.env` and add your Google OAuth credentials:
   ```env
   # Google OAuth 2.0 Configuration
   GOOGLE_CLIENT_ID=your_actual_client_id_here.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your_actual_client_secret_here

   # Session Secret (generate a strong random string)
   SESSION_SECRET=your_session_secret_here_change_in_production

   # Other required variables
   PORT=3000
   NODE_ENV=development
   FRONTEND_URL=http://localhost:5173
   MONGODB_URI=mongodb://localhost:27017/betting-calculator
   ```

4. Generate a strong session secret:
   ```bash
   # Option 1: Using OpenSSL
   openssl rand -base64 32

   # Option 2: Using Node.js
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

### Frontend Configuration

1. Navigate to the `frontend` folder
2. Copy the example environment file:
   ```bash
   cd frontend
   cp .env.example .env.local
   ```

3. Edit `.env.local`:
   ```env
   # For local development, point to local backend
   VITE_BACKEND_URL=http://localhost:3000
   ```

---

## Local Development Setup

### 1. Install Dependencies

**Backend:**
```bash
cd backend
npm install
```

**Frontend:**
```bash
cd frontend
npm install
```

### 2. Start MongoDB (if using local database)

```bash
# Start MongoDB service
mongod

# Or if using Docker
docker run -d -p 27017:27017 --name mongodb mongo
```

### 3. Start the Backend Server

```bash
cd backend
npm run dev
# Server should start on http://localhost:3000
```

### 4. Start the Frontend Development Server

```bash
cd frontend
npm run dev
# Vite should start on http://localhost:5173
```

---

## Testing the Authentication Flow

### Complete OAuth Flow Test

1. **Open your browser** and navigate to `http://localhost:5173`

2. **Click "Sign in with Google"** button in the top-right corner

3. **Google Login Screen** should appear:
   - If you're already logged in to Google, you'll see account selection
   - If not, enter your Google credentials
   - Click **Allow** to grant permissions

4. **After successful authentication**:
   - You should be redirected back to the application
   - The top-right should show your:
     - Profile picture
     - Name
     - Email address
     - Logout button

5. **Test the dashboard API** (optional):
   - Open browser DevTools (F12)
   - In console, run:
     ```javascript
     fetch('http://localhost:3000/dashboard', {credentials: 'include'})
       .then(r => r.json())
       .then(console.log)
     ```
   - You should see your user information

6. **Test logout**:
   - Click the **Logout** button
   - You should be logged out and redirected to the home page
   - The "Sign in with Google" button should reappear

### API Endpoints Available

- `GET /auth/google` - Initiates Google OAuth flow
- `GET /auth/google/callback` - OAuth callback (handles Google redirect)
- `GET /auth/logout` - Logs out user and destroys session
- `GET /auth/status` - Returns current authentication status (JSON)
- `GET /dashboard` - Protected route (requires authentication)

---

## Production Deployment

### Backend Deployment (e.g., Render, Heroku, Railway)

1. Set environment variables in your hosting platform:
   ```
   GOOGLE_CLIENT_ID=your_client_id
   GOOGLE_CLIENT_SECRET=your_client_secret
   SESSION_SECRET=your_strong_random_secret
   NODE_ENV=production
   FRONTEND_URL=https://your-frontend-domain.com
   MONGODB_URI=your_mongodb_atlas_connection_string
   ```

2. **Update Google Cloud Console**:
   - Add production redirect URI: `https://your-backend-domain.com/auth/google/callback`
   - Add production JavaScript origin: `https://your-backend-domain.com`

### Frontend Deployment (e.g., Vercel, Netlify)

1. Set environment variable:
   ```
   VITE_BACKEND_URL=https://your-backend-domain.com
   ```

2. Deploy the frontend

### Important Production Notes

- **HTTPS is required** for OAuth in production
- **Session cookies** will use `secure: true` in production
- **CORS** is configured to allow your frontend domain
- Store all secrets securely (never commit to Git)

---

## Troubleshooting

### "redirect_uri_mismatch" Error

**Problem:** Google shows an error about redirect URI mismatch

**Solution:**
1. Check that your redirect URI in Google Cloud Console **exactly matches** the one in the error message
2. Common issues:
   - Missing `/auth/google/callback` path
   - `http` vs `https` mismatch
   - Port number differences
   - Trailing slashes

### "Invalid Client" Error

**Problem:** Error says the OAuth client is invalid

**Solution:**
- Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correct
- Check for extra spaces or quotes in `.env` file
- Ensure the OAuth client is enabled in Google Cloud Console

### Session Not Persisting

**Problem:** User gets logged out immediately after login

**Solution:**
- Check that `SESSION_SECRET` is set in backend `.env`
- Verify CORS is configured with `credentials: true`
- Frontend must send requests with `credentials: 'include'`
- Check browser console for cookie errors

### "Cannot GET /auth/google/callback" Error

**Problem:** 404 error on callback

**Solution:**
- Ensure backend server is running on correct port
- Check that auth routes are properly mounted in `server.js`
- Verify `app.use('/auth', authRoutes)` is present

### CORS Errors

**Problem:** Browser blocks requests with CORS error

**Solution:**
- Set `FRONTEND_URL` in backend `.env` to match your frontend URL
- Ensure `credentials: true` in CORS config
- Frontend must use `credentials: 'include'` in fetch requests

---

## File Structure

```
backend/
├── config/
│   └── passport.js          # Passport Google OAuth configuration
├── routes/
│   └── auth.js             # Authentication routes
├── middleware/
│   └── auth.js             # Authentication middleware (ensureAuthenticated)
├── server.js               # Main server file (Passport integration)
└── .env                    # Environment variables (not in Git)

frontend/
├── index.tsx               # Main React app with auth UI
└── .env.local              # Frontend environment (not in Git)
```

---

## Security Best Practices

1. **Never commit** `.env` files to Git (already in `.gitignore`)
2. **Use strong session secrets** (minimum 32 random characters)
3. **Enable HTTPS** in production (required for secure cookies)
4. **Regularly rotate** OAuth client secrets
5. **Limit OAuth scopes** to only what's needed (profile, email)
6. **Add rate limiting** to auth endpoints (already configured)
7. **Monitor for suspicious activity** in auth logs

---

## Next Steps

### Database Integration (Optional but Recommended)

Currently, user data is stored in memory (session only). For production:

1. Create a User model in MongoDB
2. Update `config/passport.js` to:
   - Save new users to database
   - Update existing users on login
   - Store only user ID in session
3. Update `deserializeUser` to fetch user from database

### Additional Features

- Add user profile page
- Implement role-based access control
- Add social login for other providers (Facebook, Twitter, etc.)
- Track user calculation history per account
- Premium features for authenticated users

---

## Support

If you encounter issues:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review Google Cloud Console setup
3. Verify all environment variables are set correctly
4. Check browser console and backend logs for errors

For more help:
- Google OAuth Documentation: https://developers.google.com/identity/protocols/oauth2
- Passport.js Documentation: http://www.passportjs.org/
- Express Session Documentation: https://github.com/expressjs/session

---

**Happy Coding! 🚀**
