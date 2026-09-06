# CSV prediction service and ChatGPT connection

## Local run

Run from a complete repository checkout; the frontend imports pure shared files under `mcp-server/src/utils` and `config`. Build systems must include those parent-directory files.

```powershell
cd mcp-server
npm ci
npm run build
npm start
# Default: http://localhost:3001/mcp
```

In another terminal:

```powershell
cd frontend
npm install --legacy-peer-deps
npm run dev
# http://localhost:5173
```

The prediction board itself reads static CSVs and runs the shared model in the browser. It works without the backend, MongoDB or an AI key. Existing account, authentication and external schedule features still use the separate backend on port 3000 and require their original service configuration. `MCP_SERVER_URL` connects the backend's prediction proxy to port 3001. Vite proxies `/api/predictions` and `/mcp` directly to the same service; `/api` and `/auth` go to the legacy backend.

## Routes and contracts

| Endpoint | Purpose |
| --- | --- |
| `POST /mcp` | Stateless Streamable HTTP, JSON-RPC initialization, tools/list and tools/call |
| `GET /mcp`, `DELETE /mcp` | 405 with `Allow: POST`; no persistent session/SSE |
| `GET /health` | Service and optional integration status |
| `GET /api/predictions/catalog?sport=NBA` | Available teams, CSV metrics, files and snapshot timestamp |
| `POST /api/predictions` | Same typed projection as `predict_game` |
| `POST /api/predictions/question` | Bounded direct natural-language questions |
| `GET /api/predictions/model` | Methods and limitations |

```json
{"sport":"NBA","away":"LAL","home":"BOS","line":-3.5}
```

Input schemas are defined in `mcp-server/src/tools/predictions.ts`. `predict_game` advertises an output schema as well as JSON text and structured results. Tool errors set `isError`. HTTP input validation returns 400; unavailable/ambiguous data returns 422. The server validates origins and supports the protocol-version preflight header.

## Environment

| Variable | Default / meaning |
| --- | --- |
| `PORT` | 3001 for MCP; keep separate from backend port 3000 |
| `STATS_DIR` | Absolute canonical CSV directory; defaults to the checkout's `frontend/public/stats` |
| `ALLOWED_ORIGINS` | `https://chatgpt.com`; comma-separated browser origins |
| `MCP_SERVER_URL` | Backend/Vite prediction proxy target, default `http://127.0.0.1:3001` |
| `ENABLE_LEGACY_TOOLS` | Off unless exactly `true`; enables the old account, AI and betting tools |
| `ENABLE_SCHEDULED_JOBS` | Off unless exactly `true`; enables existing refresh/daily jobs |
| `ADMIN_KEY` | Required to authorize the existing mutation HTTP endpoints |

The default prediction tools need no `MONGODB_URI` or `GEMINI_API_KEY`. Cached reads expire after one minute. CSV files are still updated by the repository's ingestion scripts; serving the model does not silently update stats. For hosted deployments, publish the same CSV snapshot to the frontend and `STATS_DIR` to keep answers aligned. CSV mutation jobs should write complete files atomically and publish the metadata last.

## ChatGPT

Expose this service through an existing HTTPS deployment or a development HTTPS tunnel you control. A cloud ChatGPT client cannot reach your machine's private localhost URL. In ChatGPT's developer/app connection workflow, enter the reachable `https://YOUR_HOST/mcp` endpoint and refresh the tool list. This implementation was verified with local protocol calls; connecting a real ChatGPT account and deploying a public endpoint are separate steps and were not performed.

Prompts to try:

- “Predict the Lakers at Celtics game using your available NBA stats.”
- “Why does the model favor Boston? Which statistics are driving that?”
- “Show the Chiefs' NFL statistics and tell me how old the snapshot is.”
- “For Toronto at Boston in the NHL, what is the chance of going over 6.5?”
- “Explain how you weight pitching and offense in MLB.”

The host assistant should call `get_sports_catalog` for identifiers and factual questions, `predict_game` for outcomes, and `explain_prediction_model` for methods. It may reason conversationally about returned data, but should not substitute invented stats or its own estimated probability. Unknown venue, ambiguous city names and unsupported requests should be clarified.

Official references: [OpenAI MCP server guidance](https://developers.openai.com/plugins/build/mcp-server), [MCP Streamable HTTP transport](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports).
