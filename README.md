# Kelly & Cover Probability Platform

This repository now hosts both the React frontend and a production-ready Node.js/Express backend for the Kelly & Cover Probability calculator and token system.

## Project Structure

```
.
├── index.html               # React entry point (existing frontend)
├── index.tsx                # React bootstrap file
├── components/              # React UI components
├── api/                     # Frontend API helpers
├── src/                     # Backend TypeScript source code
├── dist/                    # Backend build output (generated)
├── openapi.yaml             # OpenAPI specification for the backend
├── tsconfig.json            # Frontend TypeScript configuration
├── tsconfig.server.json     # Backend TypeScript configuration
└── package.json             # Shared package manifest for frontend + backend
```

## Backend Overview

The backend exposes four authenticated endpoints under `/api`:

- `POST /api/kelly` – Compute the Kelly Criterion bet sizing.
- `POST /api/cover` – Estimate the probability of covering a spread using a normal distribution model.
- `POST /api/token/add` – Add tokens to the authenticated user.
- `GET /api/user` – Retrieve the user profile, token balance, and historical calculations.

Every calculation request consumes one token. Token and user data are stored in MongoDB. See [`openapi.yaml`](openapi.yaml) for detailed request/response schemas.

### Authentication Stub

The current implementation expects a bearer token containing the user email address (e.g. `Authorization: Bearer user@example.com`). The middleware will create the user with default tokens on the first request. Replace this logic with real authentication (JWT, Firebase, etc.) when ready.

## Getting Started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Set up environment variables**

   Copy `.env.example` to `.env` and update the values:

   ```bash
   cp .env.example .env
   ```

3. **Run the backend in development mode**

   ```bash
   npm run dev
   ```

   The server will start on `http://localhost:5000` by default. Hot reload is provided via `ts-node-dev`.

4. **Run the frontend**

   ```bash
   npm run client:dev
   ```

   The Vite development server will start on `http://localhost:5173`.

5. **Build for production**

   ```bash
   npm run build       # Builds the backend into ./dist
   npm run client:build
   ```

6. **Start the production backend**

   ```bash
   npm start
   ```

## MongoDB

Ensure that your MongoDB instance is reachable via the `MONGO_URI` environment variable. The default token allocation per user is 100 and is configurable by editing `src/models/User.ts`.

## API Documentation

The `openapi.yaml` file documents all routes and schema definitions. It can be imported into tools such as Postman, Swagger UI, or the OpenAI Actions console.

## Testing the API Quickly

After running `npm run dev`, you can issue a request with `curl`:

```bash
curl -X POST http://localhost:5000/api/kelly \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer user@example.com" \
  -d '{"winProb":0.55,"odds":1.91,"bankroll":1000}'
```

The response will contain the Kelly fraction, suggested bet size, and remaining tokens.

## Deployment Notes

- Configure `CORS_ORIGIN` with a comma-separated list of allowed frontend origins.
- Use a process manager such as PM2 or Docker to run the compiled JavaScript in `dist/server.js`.
- Ensure environment variables are provided in your hosting environment.
- Replace the stub authentication middleware with production-grade auth before exposing publicly.

## Contributing

1. Fork the repository.
2. Create a feature branch.
3. Commit your changes with descriptive messages.
4. Open a pull request that references this repository's guidelines.

