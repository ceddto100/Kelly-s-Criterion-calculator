# Quick Start - MCP Tool Wrapper

## Problem Description

The probability estimation tools (`probability-estimate-basketball`, `probability-estimate-football`) use the **Model Context Protocol (MCP)** which follows JSON-RPC 2.0 specification. The tools **must be called using the correct MCP format**, not with direct arguments.

## Correct Call Format

### ❌ Incorrect (Won't Work)

```javascript
// This format is WRONG
api_tool.call_tool({
  path: "/probability-estimate-basketball",
  args: {
    team_favorite: "Houston Rockets",
    team_underdog: "Los Angeles Lakers",
    spread: -3.5
  }
})
```

### ✅ Correct (MCP JSON-RPC Format)

```javascript
// This format is CORRECT
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

## Curl Example

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

Expected Response:
```json
{
  "jsonrpc": "2.0",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"favorite_cover_probability\":0.59,\"underdog_cover_probability\":0.41,...}"
      }
    ]
  },
  "id": 1
}
```

## Tool Schema (From tools/list)

The canonical field names are:
- `team_favorite` (string, optional in schema because aliases are supported)
- `team_underdog` (string, optional in schema because aliases are supported)
- `spread` (number, required)

**Note:** Fields are marked `.optional()` in the Zod schema because the tool accepts multiple alias names. The actual validation happens in the handler function after alias normalization.

Supported aliases:
- `team_favorite`: can also be `favorite_team`, `favorite`, or `fav`
- `team_underdog`: can also be `underdog_team`, `underdog`, or `dog`

## Why Fields Appear Optional

The input schema shows fields as optional:
```json
{
  "team_favorite": { "type": "string" },  // optional
  "team_underdog": { "type": "string" },  // optional
  "favorite_team": { "type": "string" },  // optional
  "underdog_team": { "type": "string" },  // optional
  ...
}
```

This is intentional because:
1. The tool accepts multiple field name variants (aliases)
2. Users can provide EITHER `team_favorite` OR `favorite_team` OR `favorite` OR `fav`
3. The handler validates that at least one variant is provided
4. Making them required in the schema would force users to provide all variants

The validation error message will list all acceptable field names if you miss a required field:
```json
{
  "error": "invalid_input",
  "message": "Missing required field(s): team_favorite (or favorite_team, favorite, fav)"
}
```

## Working Example (Node.js)

```javascript
import fetch from 'node-fetch';

async function estimateBasketballProbability(favorite, underdog, spread) {
  const response = await fetch('http://localhost:3000/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'probability-estimate-basketball',
        arguments: {
          team_favorite: favorite,
          team_underdog: underdog,
          spread: spread
        }
      },
      id: 1
    })
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message);
  }

  // Parse the result from the text content
  const result = JSON.parse(data.result.content[0].text);
  return result;
}

// Usage
const result = await estimateBasketballProbability(
  'Houston Rockets',
  'Los Angeles Lakers',
  -3.5
);

console.log(result);
// {
//   favorite_cover_probability: 0.59,
//   underdog_cover_probability: 0.41,
//   inputs: { team_favorite: 'Houston Rockets', ... },
//   normalized: { team_favorite: 'Houston Rockets', ... }
// }
```

## Working Example (Python)

```python
import requests
import json

def estimate_basketball_probability(favorite, underdog, spread):
    response = requests.post(
        'http://localhost:3000/mcp',
        json={
            'jsonrpc': '2.0',
            'method': 'tools/call',
            'params': {
                'name': 'probability-estimate-basketball',
                'arguments': {
                    'team_favorite': favorite,
                    'team_underdog': underdog,
                    'spread': spread
                }
            },
            'id': 1
        },
        headers={'Content-Type': 'application/json'}
    )

    data = response.json()

    if 'error' in data:
        raise Exception(data['error']['message'])

    # Parse the result from text content
    result = json.loads(data['result']['content'][0]['text'])
    return result

# Usage
result = estimate_basketball_probability(
    'Houston Rockets',
    'Los Angeles Lakers',
    -3.5
)

print(result)
```

## Required vs Optional Parameters

**In the JSON-RPC request `arguments`:**

| Parameter | Required | Type | Description |
|-----------|----------|------|-------------|
| `team_favorite` (or aliases) | **YES** | string | Name of favored team |
| `team_underdog` (or aliases) | **YES** | string | Name of underdog team |
| `spread` | **YES** | number | Point spread (must be negative) |

Even though the schema shows fields as optional (to support aliases), **you must provide values** for team names and spread. The tool will return a clear error if any are missing.

## See Also

- `FIX_MCP_WRAPPER.md` - Complete wrapper implementation guide
- `docs/PROBABILITY_API.md` - Full API documentation
- `docs/PROBABILITY_FIX_SUMMARY.md` - Technical details of the implementation

## Summary

1. **Always use MCP JSON-RPC 2.0 format** with `method: "tools/call"`
2. **Arguments go in `params.arguments`**, not at the top level
3. **Fields appear optional** in schema but are **validated in the handler**
4. **Use aliases freely** - `team_favorite` or `favorite_team` or `favorite` or `fav`
5. **Error messages** will guide you to the correct field names
