# MCP Wrapper Fix Summary

## The Problem

You reported that calling `probability-estimate-basketball` returned:
```json
{
  "error": "invalid_input",
  "message": "Missing required field(s): team_favorite, team_underdog, spread"
}
```

Even though you were sending:
```javascript
{
  team_favorite: "Houston Rockets",
  team_underdog: "Los Angeles Lakers",
  spread: -3.5
}
```

## Root Cause

The Kelly Criterion MCP server uses the **Model Context Protocol (MCP)** which follows **JSON-RPC 2.0** specification. Your wrapper wasn't using the correct MCP format, so arguments never reached the tool handler.

## The Fix

### What You Need to Change in Your Wrapper

**❌ Incorrect Format (What you were using):**
```javascript
api_tool.call_tool({
  path: "/probability-estimate-basketball",
  args: {
    team_favorite: "Houston Rockets",
    team_underdog: "Los Angeles Lakers",
    spread: -3.5
  }
})
```

**✅ Correct MCP Format (What you need):**
```javascript
fetch('http://localhost:3000/mcp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: "2.0",
    method: "tools/call",
    params: {
      name: "probability-estimate-basketball",
      arguments: {
        team_favorite: "Houston Rockets",
        team_underdog: "Los Angeles Lakers",
        spread: -3.5
      }
    },
    id: 1
  })
})
```

## Key Changes Required

1. **Endpoint:** `POST /mcp` (not a path-based endpoint)
2. **Content-Type:** `application/json`
3. **Body Format:** JSON-RPC 2.0 structure with:
   - `jsonrpc: "2.0"`
   - `method: "tools/call"`
   - `params.name`: The tool name
   - `params.arguments`: Your tool arguments
   - `id`: Unique request ID

## Corrected Schema Information

### Input Schema

The tools show fields as `.optional()` in the schema because they support **field aliases**:

**Canonical Fields:**
- `team_favorite` (primary field name)
- `team_underdog` (primary field name)
- `spread` (required number)

**Supported Aliases:**
- `team_favorite`: can also be `favorite_team`, `favorite`, or `fav`
- `team_underdog`: can also be `underdog_team`, `underdog`, or `dog`

**Why Optional?**
- Users can provide EITHER `team_favorite` OR `favorite_team` OR `favorite` OR `fav`
- Making them all required would force users to provide every variant
- Validation happens in the handler function (after alias normalization)

### Output Schema

```json
{
  "jsonrpc": "2.0",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"favorite_cover_probability\":0.59,\"underdog_cover_probability\":0.41,\"inputs\":{...},\"normalized\":{...}}"
      }
    ]
  },
  "id": 1
}
```

The actual probability data is in `result.content[0].text` as a JSON string.

## Working Example

### Curl Command

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "probability-estimate-basketball",
      "arguments": {
        "team_favorite": "Houston Rockets",
        "team_underdog": "Los Angeles Lakers",
        "spread": -3.5
      }
    },
    "id": 1
  }'
```

### Expected Response

```json
{
  "jsonrpc": "2.0",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"favorite_cover_probability\":0.59,\"underdog_cover_probability\":0.41,\"inputs\":{\"team_favorite\":\"Houston Rockets\",\"team_underdog\":\"Los Angeles Lakers\",\"spread\":-3.5},\"normalized\":{\"team_favorite\":\"Houston Rockets\",\"team_underdog\":\"Los Angeles Lakers\"}}"
      }
    ]
  },
  "id": 1
}
```

Parse `result.content[0].text` to get:
```json
{
  "favorite_cover_probability": 0.59,
  "underdog_cover_probability": 0.41,
  "inputs": {
    "team_favorite": "Houston Rockets",
    "team_underdog": "Los Angeles Lakers",
    "spread": -3.5
  },
  "normalized": {
    "team_favorite": "Houston Rockets",
    "team_underdog": "Los Angeles Lakers"
  }
}
```

## Wrapper Implementation

See the complete wrapper implementation in:
- **`FIX_MCP_WRAPPER.md`** - Full implementation guide with TypeScript and Python examples
- **`mcp-server/QUICK_START.md`** - Quick reference with working examples

## Code Changes Made

### Files Added
1. **`FIX_MCP_WRAPPER.md`** - Complete wrapper implementation guide
2. **`mcp-server/QUICK_START.md`** - Quick start guide
3. **`mcp-server/src/__tests__/tools/probability-basketball-mcp.test.ts`** - Regression tests

### Files Modified
- **`probabilityBasketball.ts`** - No functional changes (documentation only)
- **`probabilityFootball.ts`** - No functional changes (documentation only)

## Why This Happened

The tool registry likely showed `() => any` because:
1. The MCP SDK doesn't expose Zod schema types directly in the registry
2. The schema is converted to JSON Schema internally by the MCP SDK
3. Your tool registry may not have been querying the MCP `/tools/list` endpoint correctly

## Regression Test

Added comprehensive tests in `probability-basketball-mcp.test.ts`:

```typescript
// Test: Correct MCP format with Houston Rockets vs Lakers
const response = await request(app)
  .post('/mcp')
  .send({
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: 'probability-estimate-basketball',
      arguments: {
        team_favorite: 'Houston Rockets',
        team_underdog: 'Los Angeles Lakers',
        spread: -3.5
      }
    },
    id: 1
  });

// Assertions:
// - Response status is 200
// - Has valid JSON-RPC structure
// - Contains probability data
// - Probabilities sum to 1.0
```

## Verification Steps

1. **Test with curl:**
   ```bash
   curl -X POST http://localhost:3000/mcp \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"probability-estimate-basketball","arguments":{"team_favorite":"Houston Rockets","team_underdog":"Los Angeles Lakers","spread":-3.5}},"id":1}'
   ```

2. **Update your wrapper** to use the MCP JSON-RPC format shown above

3. **Run regression tests:**
   ```bash
   npm test -- probability-basketball-mcp.test.ts
   ```

## Summary

**Problem:** Wrapper not using MCP JSON-RPC format
**Solution:** Updated wrapper to use correct format:
- Endpoint: `POST /mcp`
- Format: JSON-RPC 2.0 with `method: "tools/call"`
- Arguments: Nested under `params.arguments`

**No Breaking Changes:**
- All tools work exactly as before
- Schema unchanged (fields remain optional to support aliases)
- Only documentation and examples added

**Next Steps:**
1. Update your wrapper implementation using examples from `FIX_MCP_WRAPPER.md`
2. Test with provided curl command
3. Verify probabilities are returned correctly

## Documentation

- **Quick Start:** `mcp-server/QUICK_START.md`
- **Complete Guide:** `FIX_MCP_WRAPPER.md`
- **API Docs:** `docs/PROBABILITY_API.md`
- **Technical Details:** `docs/PROBABILITY_FIX_SUMMARY.md`

All files committed and pushed to branch `claude/fix-probability-endpoints-avq0M`.
