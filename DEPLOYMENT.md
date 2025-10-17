# Deployment Checklist

This guide walks through deploying the Kelly Calculator backend to Render while keeping the Vite/React frontend on Vercel.

## 1. Prerequisites
- A GitHub repository containing this project.
- Access to a MongoDB Atlas cluster (free tier is sufficient).
- Render Starter ($7/month) plan for the backend.
- Vercel account for the frontend.

## 2. Configure MongoDB Atlas
1. Create or sign in to your MongoDB Atlas account.
2. Create a **Project** and a **Shared Cluster** (M0 is free).
3. In *Database Access*, add a database user with a strong password. Note the username and password.
4. In *Network Access*, allow connections from Render:
   - Preferably select **Allow Access from Anywhere** (0.0.0.0/0) and restrict via credentials, or add Render's outbound IP ranges.
5. Grab the connection string (e.g. `mongodb+srv://<user>:<password>@cluster0.mongodb.net/kelly-calculator`).
   - Replace `<user>`/`<password>` with the credentials you created.
   - Add a database name at the end (e.g. `/kelly-calculator`).

## 3. Set up Environment Variables
### Backend (Render Dashboard)
| Key        | Required | Description |
|------------|----------|-------------|
| `MONGO_URI` | ✅ | MongoDB Atlas connection string copied above. |
| `CORS_ORIGIN` | ✅ | Comma-separated list of allowed origins (e.g. `https://your-frontend-domain.vercel.app,https://your-frontend-staging.vercel.app`). |
| `JWT_SECRET` | ✅ | Placeholder secret for future JWT implementation. Keep a random, strong value even if unused today. |
| `NODE_ENV` | optional | Automatically set to `production` by the Render blueprint. Override if needed. |

> Render injects the `PORT` variable automatically; the server reads `process.env.PORT` so no action is required.

### Frontend (Vercel Project Settings)
| Key | Description |
|-----|-------------|
| `VITE_API_URL` | The public HTTPS URL of the Render backend (e.g. `https://kelly-calculator-backend.onrender.com`). |

For local development copy `.env.local` and customise values as needed.

## 4. Deploy the Backend to Render
1. Push the latest code (including `render.yaml`) to the default branch.
2. In Render, click **New + → Blueprint** and select your repository.
3. Render reads `render.yaml` and suggests creating the `kelly-calculator-backend` web service.
4. Confirm the Starter plan and auto-deploy settings.
5. When prompted, add the environment variables listed above.
6. Deploy. Render executes:
   - `npm install && npm run build` (compiles TypeScript to `dist/`).
   - `npm run start` (runs the compiled `dist/server.js`).
7. Wait for the deploy to finish. Verify the logs for `Server listening on port` and `MongoDB connected`.

## 5. Keep the Frontend on Vercel
1. Update the frontend configuration:
   - In local `.env.local`, set `VITE_API_URL` to the Render URL.
   - Commit and push any frontend changes (the build reads `import.meta.env.VITE_API_URL`).
2. In Vercel project settings → **Environment Variables**, add the same `VITE_API_URL` under Production/Preview.
3. Trigger a redeploy on Vercel. The frontend now calls the Render backend.

## 6. Verification Checklist
- [ ] Render deployment finishes without errors.
- [ ] API endpoint `https://<render-app>.onrender.com/api/health` (if implemented) or `/api/calculate` responds successfully.
- [ ] MongoDB Atlas shows incoming connections.
- [ ] Frontend fetches data without CORS errors (check browser console).
- [ ] Authentication via bearer email header still works end-to-end.

## 7. Troubleshooting
- **Build fails**: ensure `tsconfig.server.json` is present and dependencies are installed. Re-run the deploy after fixing TypeScript errors locally with `npm run build`.
- **Database connection timeout**: confirm `MONGO_URI` credentials and network rules in Atlas allow Render's IPs.
- **CORS errors**: double-check `CORS_ORIGIN` includes the exact protocol + domain for Vercel (and localhost during testing if desired).
- **401 Unauthorized**: remember the API expects a bearer token containing the user's email address (`Authorization: Bearer user@example.com`).
- **Stale environment variable**: redeploy the Render service after editing secrets; they are not hot-reloaded.

With these steps the backend runs on Render while the existing Vercel frontend communicates through the configurable API URL.
