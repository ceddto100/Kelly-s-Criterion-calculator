# OpenAI MCP Scanner Compatibility Fix - Summary

## 🎯 Problem Solved

**Before:** OpenAI's MCP scanner could connect but timed out at "Scanning tools..." with 0 tools discovered.

**After:** Server now supports JSON-RPC over HTTP POST, which is what OpenAI's scanner expects.

## 🔧 Changes Made

### 1. **server.ts** - Added Streamable HTTP Transport (Lines 10, 176-223)

```typescript
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

// Create stateless transport for OpenAI compatibility
const httpTransport = new StreamableHTTPServerTransport({
  sessionIdGenerator: undefined, // Stateless
  enableJsonResponse: true // JSON responses for POST
});

await mcpServer.connect(httpTransport);

app.use('/mcp', async (req, res) => {
  await httpTransport.handleRequest(req, res, req.body);
});
```

**Key Points:**
- **Stateless mode** (`sessionIdGenerator: undefined`) - No session management required
- **JSON Response enabled** - Returns JSON instead of SSE for POST requests
- **Single transport instance** - Reused across all requests
- **Handles both GET and POST** - SSE streaming AND JSON-RPC

### 2. **Debug Logging** (Lines 34, 63-74)

```typescript
const DEBUG_MCP = process.env.DEBUG_MCP === '1' || process.env.DEBUG_MCP === 'true';

app.use('/mcp', (req, res, next) => {
  if (DEBUG_MCP) {
    console.log('[MCP DEBUG] Request received:', {
      method: req.method,
      contentType: req.get('content-type'),
      bodyPreview: JSON.stringify(req.body || {}).substring(0, 2048)
    });
  }
  next();
});
```

Enable with: `DEBUG_MCP=1 npm start`

### 3. **Test Prevention** (Line 232)

```typescript
// Only start server when run directly, not when imported for testing
if (import.meta.url === `file://${process.argv[1]}`) {
  app.listen(PORT, () => { /* ... */ });
}
```

### 4. **Updated Dependencies** (package.json)

Added for testing:
- `supertest@^6.3.4`
- `@types/supertest@^6.0.2`

## 📋 Why It Was Timing Out

1. **Wrong Transport**: Server only had SSE (GET /mcp), scanner needs JSON-RPC (POST /mcp)
2. **No POST Handler**: The previous implementation explicitly rejected POST with 405 error
3. **Protocol Mismatch**: SSEServerTransport doesn't implement the JSON-RPC methods OpenAI's scanner expects

## ✅ How It Works Now

The MCP SDK's `StreamableHTTPServerTransport` handles the protocol automatically:

1. **Initialize** (`POST /mcp` with `method: "initialize"`)
   - Returns server info and capabilities
   - No session ID needed (stateless mode)

2. **List Tools** (`POST /mcp` with `method: "tools/list"`)
   - Returns all 13 registered tools with schemas
   - Fast synchronous response

3. **Call Tool** (`POST /mcp` with `method: "tools/call"`)
   - Executes tool and returns results
   - Supports all tool parameters

4. **SSE Support** (`GET /mcp`)
   - Still works for streaming clients
   - Backward compatible

## 🧪 Manual Testing

After deployment, test with curl:

```bash
# 1. Initialize
curl -X POST https://kelly-criterion-mcp-server.onrender.com/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}},"id":1}'

# Expected: 200 OK with serverInfo

# 2. List Tools
curl -X POST https://kelly-criterion-mcp-server.onrender.com/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":2}'

# Expected: 200 OK with tools array containing 13 tools

# 3. Call Kelly Tool
curl -X POST https://kelly-criterion-mcp-server.onrender.com/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"kelly-calculate","arguments":{"bankroll":1000,"odds":-110,"probability":55,"fraction":"1"}},"id":3}'

# Expected: 200 OK with result content
```

Or use the provided script:
```bash
chmod +x test-mcp-endpoints.sh
./test-mcp-endpoints.sh https://kelly-criterion-mcp-server.onrender.com
```

## 📊 OpenAI Scanner Checklist

After deployment:

1. ✅ **URL**: `https://kelly-criterion-mcp-server.onrender.com/mcp`
2. ✅ **Authentication**: No Auth
3. ✅ **Click "Scan Tools"**
4. ✅ **Expected**: 13 tools discovered:
   - kelly-calculate
   - probability-estimate-football
   - probability-estimate-basketball
   - get-team-stats
   - get-matchup-stats
   - analyze-matchup
   - log-bet
   - get-bet-history
   - update-bet-outcome
   - get-bankroll
   - set-bankroll
   - adjust-bankroll
   - get-bankroll-history

## 🚀 Deployment

```bash
# Build
npm run build

# Deploy (Render auto-deploys from git)
git add .
git commit -m "Fix OpenAI MCP scanner compatibility with StreamableHTTPServerTransport"
git push origin claude/add-api-keys-tokens-EmQvZ
```

Optional: Set `DEBUG_MCP=1` in Render dashboard for detailed logging.

## 📝 Files Changed

1. `mcp-server/src/server.ts` - Main implementation
2. `mcp-server/src/__tests__/setup.ts` - Fixed mock to preserve app export
3. `mcp-server/src/__tests__/mcp-protocol.test.ts` - Comprehensive tests
4. `mcp-server/package.json` - Added supertest
5. `mcp-server/test-mcp-endpoints.sh` - Manual testing script
6. `mcp-server/MCP_SCANNER_FIX.md` - Detailed documentation
7. `mcp-server/OPENAI_SCANNER_FIX_SUMMARY.md` - This file

## 🔍 Troubleshooting

### Scanner still times out
- Check Render logs for "MCP DEBUG" output (if DEBUG_MCP=1)
- Verify domain verification endpoint works: `/.well-known/openai-apps-challenge`
- Test initialize manually with curl
- Check no WAF/firewall blocking POST requests

### Tools list is empty
- Should never happen - tools are registered at startup
- Check server logs for errors during startup
- Verify build succeeded without errors

### 406 Not Acceptable errors
- This can happen if protocol version doesn't match
- OpenAI expects `2024-11-05` - which we send
- Check request headers include `Content-Type: application/json`

## 🎓 Key Learnings

1. **MCP SDK has multiple transports:**
   - `SSEServerTransport` - SSE only (GET)
   - `StreamableHTTPServerTransport` - Both SSE and JSON-RPC (GET + POST)

2. **OpenAI scanner expects:**
   - JSON-RPC 2.0 over HTTP POST
   - Stateless operation (no session management)
   - Protocol version `2024-11-05`
   - Fast responses (<30s per request)

3. **Stateless vs Stateful:**
   - Stateless (`sessionIdGenerator: undefined`) = No session IDs, works with any client
   - Stateful (`sessionIdGenerator: () => randomUUID()`) = Session management, state preservation

4. **Transport reuse:**
   - Create ONE transport instance
   - Connect MCP server once
   - Reuse transport for all requests
   - Don't create new transport per request (causes connection issues)
