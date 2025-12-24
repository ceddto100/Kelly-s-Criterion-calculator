# Fix for MCP Tool Wrapper - probability-estimate-basketball

## Root Cause

The tool wrapper is not using the correct MCP (Model Context Protocol) JSON-RPC format. The MCP server expects requests in JSON-RPC 2.0 format with arguments nested under `params.arguments`, not passed directly.

### Incorrect Call Format (Current):
```javascript
api_tool.call_tool({
  path: "/Kelly's Criterion Calculator/.../probability-estimate-basketball",
  args: {
    team_favorite: "Houston Rockets",
    team_underdog: "Los Angeles Lakers",
    spread: -3.5
  }
})
```

### Correct MCP JSON-RPC Format (Required):
```json
{
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
}
```

## MCP Protocol Overview

The Kelly Criterion MCP server uses the Model Context Protocol (MCP) JSON-RPC 2.0 specification:

1. **Endpoint**: `POST /mcp`
2. **Content-Type**: `application/json`
3. **Protocol**: JSON-RPC 2.0

### Required Request Format

All MCP tool calls must follow this structure:

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "<tool-name>",
    "arguments": {
      // Tool-specific arguments here
    }
  },
  "id": <unique-request-id>
}
```

### Response Format

```json
{
  "jsonrpc": "2.0",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"favorite_cover_probability\":0.57,...}"
      }
    ]
  },
  "id": 1
}
```

## Fixed Wrapper Implementation

### TypeScript/JavaScript Wrapper

```typescript
interface MCPToolCallParams {
  name: string;
  arguments: Record<string, any>;
}

interface MCPRequest {
  jsonrpc: "2.0";
  method: string;
  params: MCPToolCallParams;
  id: number;
}

interface MCPResponse {
  jsonrpc: "2.0";
  result?: {
    content: Array<{
      type: string;
      text: string;
    }>;
  };
  error?: {
    code: number;
    message: string;
  };
  id: number;
}

class KellyCriterionMCPClient {
  private baseUrl: string;
  private requestId: number = 0;

  constructor(baseUrl: string = "http://localhost:3000") {
    this.baseUrl = baseUrl;
  }

  /**
   * Call an MCP tool with proper JSON-RPC format
   */
  async callTool(toolName: string, args: Record<string, any>): Promise<any> {
    const request: MCPRequest = {
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: toolName,
        arguments: args
      },
      id: ++this.requestId
    };

    const response = await fetch(`${this.baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: MCPResponse = await response.json();

    if (data.error) {
      throw new Error(`MCP Error: ${data.error.message}`);
    }

    // Parse the result from the text content
    if (data.result?.content?.[0]?.type === "text") {
      return JSON.parse(data.result.content[0].text);
    }

    return data.result;
  }

  /**
   * Estimate basketball game probability
   */
  async estimateBasketballProbability(
    teamFavorite: string,
    teamUnderdog: string,
    spread: number
  ) {
    return this.callTool("probability-estimate-basketball", {
      team_favorite: teamFavorite,
      team_underdog: teamUnderdog,
      spread: spread
    });
  }

  /**
   * Estimate football game probability
   */
  async estimateFootballProbability(
    teamFavorite: string,
    teamUnderdog: string,
    spread: number
  ) {
    return this.callTool("probability-estimate-football", {
      team_favorite: teamFavorite,
      team_underdog: teamUnderdog,
      spread: spread
    });
  }
}

// Usage Example
const client = new KellyCriterionMCPClient("http://localhost:3000");

const result = await client.estimateBasketballProbability(
  "Houston Rockets",
  "Los Angeles Lakers",
  -3.5
);

console.log(result);
// Output:
// {
//   favorite_cover_probability: 0.59,
//   underdog_cover_probability: 0.41,
//   inputs: { team_favorite: "Houston Rockets", ... },
//   normalized: { team_favorite: "Houston Rockets", ... }
// }
```

### Python Wrapper

```python
import requests
import json
from typing import Dict, Any

class KellyCriterionMCPClient:
    def __init__(self, base_url: str = "http://localhost:3000"):
        self.base_url = base_url
        self.request_id = 0

    def call_tool(self, tool_name: str, args: Dict[str, Any]) -> Any:
        """Call an MCP tool with proper JSON-RPC format"""
        self.request_id += 1

        request_data = {
            "jsonrpc": "2.0",
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": args
            },
            "id": self.request_id
        }

        response = requests.post(
            f"{self.base_url}/mcp",
            json=request_data,
            headers={"Content-Type": "application/json"}
        )

        response.raise_for_status()
        data = response.json()

        if "error" in data:
            raise Exception(f"MCP Error: {data['error']['message']}")

        # Parse the result from text content
        if data.get("result", {}).get("content"):
            content = data["result"]["content"][0]
            if content["type"] == "text":
                return json.loads(content["text"])

        return data.get("result")

    def estimate_basketball_probability(
        self,
        team_favorite: str,
        team_underdog: str,
        spread: float
    ):
        """Estimate basketball game probability"""
        return self.call_tool("probability-estimate-basketball", {
            "team_favorite": team_favorite,
            "team_underdog": team_underdog,
            "spread": spread
        })

    def estimate_football_probability(
        self,
        team_favorite: str,
        team_underdog: str,
        spread: float
    ):
        """Estimate football game probability"""
        return self.call_tool("probability-estimate-football", {
            "team_favorite": team_favorite,
            "team_underdog": team_underdog,
            "spread": spread
        })

# Usage
client = KellyCriterionMCPClient("http://localhost:3000")

result = client.estimate_basketball_probability(
    "Houston Rockets",
    "Los Angeles Lakers",
    -3.5
)

print(result)
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
        "text": "{\"favorite_cover_probability\":0.59,\"underdog_cover_probability\":0.41,\"inputs\":{\"team_favorite\":\"Houston Rockets\",\"team_underdog\":\"Los Angeles Lakers\",\"spread\":-3.5},\"normalized\":{\"team_favorite\":\"Houston Rockets\",\"team_underdog\":\"Los Angeles Lakers\"}}"
      }
    ]
  },
  "id": 1
}
```

## Tool Schema Fix

The current inputSchema marks all fields as `.optional()` which causes confusion. Here's the fix:

### Current (Incorrect) Schema Definition

```typescript
inputSchema: {
  sport: z.literal('basketball').optional().default('basketball'),
  team_favorite: z.string().optional().describe('...'),  // ❌ Should not be optional
  team_underdog: z.string().optional().describe('...'),  // ❌ Should not be optional
  spread: z.number().describe('...'),                    // ✓ Already required
  // ... alias fields
}
```

### Fixed Schema Definition

```typescript
inputSchema: {
  sport: z.literal('basketball').default('basketball').describe('Sport type'),
  team_favorite: z.string().min(1).describe('Name of the favored team...'),  // ✓ Required, min 1 char
  team_underdog: z.string().min(1).describe('Name of the underdog team...'), // ✓ Required, min 1 char
  spread: z.number().describe('Point spread...'),                             // ✓ Required
  // Alias fields remain optional
  favorite_team: z.string().optional().describe('Alias for team_favorite'),
  favorite: z.string().optional().describe('Alias for team_favorite'),
  fav: z.string().optional().describe('Alias for team_favorite'),
  underdog_team: z.string().optional().describe('Alias for team_underdog'),
  underdog: z.string().optional().describe('Alias for team_underdog'),
  dog: z.string().optional().describe('Alias for team_underdog')
}
```

**Rationale:** The canonical fields (`team_favorite`, `team_underdog`, `spread`) should be required in the schema, even though the handler accepts aliases. The alias normalization happens in the handler function, not in the schema validation.

## Regression Test

Add this test to `src/__tests__/tools/probability-basketball-mcp.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../server.js';

describe('probability-estimate-basketball - MCP JSON-RPC Format', () => {
  it('should accept proper MCP JSON-RPC request format', async () => {
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
      })
      .set('Content-Type', 'application/json');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('jsonrpc', '2.0');
    expect(response.body).toHaveProperty('result');
    expect(response.body.id).toBe(1);

    // Parse the text content
    const content = response.body.result.content[0];
    expect(content.type).toBe('text');

    const data = JSON.parse(content.text);
    expect(data).toHaveProperty('favorite_cover_probability');
    expect(data).toHaveProperty('underdog_cover_probability');
    expect(data).toHaveProperty('inputs');
    expect(data).toHaveProperty('normalized');

    // Verify probabilities
    expect(data.favorite_cover_probability).toBeGreaterThan(0);
    expect(data.favorite_cover_probability).toBeLessThan(1);
    expect(data.underdog_cover_probability).toBeGreaterThan(0);
    expect(data.underdog_cover_probability).toBeLessThan(1);

    // Verify sum equals 1.0
    const sum = data.favorite_cover_probability + data.underdog_cover_probability;
    expect(Math.abs(sum - 1.0)).toBeLessThan(1e-6);
  });

  it('should return error for missing required fields', async () => {
    const response = await request(app)
      .post('/mcp')
      .send({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'probability-estimate-basketball',
          arguments: {
            spread: -3.5
            // Missing team_favorite and team_underdog
          }
        },
        id: 2
      })
      .set('Content-Type', 'application/json');

    expect(response.status).toBe(200);

    const content = response.body.result.content[0];
    const data = JSON.parse(content.text);

    // Should have error structure
    expect(data).toHaveProperty('error', 'invalid_input');
    expect(data.message).toContain('Missing required field(s)');
  });
});
```

## Summary of Changes Required

1. **Fix Tool Wrapper**: Use correct MCP JSON-RPC format with `params.arguments`
2. **Fix Schema**: Remove `.optional()` from `team_favorite` and `team_underdog`
3. **Add Regression Test**: Ensure MCP JSON-RPC format works correctly
4. **Document API**: Provide wrapper examples in TypeScript and Python

## File Patches

### `mcp-server/src/tools/probabilityBasketball.ts`

```diff
       inputSchema: {
-        sport: z.literal('basketball').optional().default('basketball').describe('Sport type - "basketball"'),
-        team_favorite: z.string().optional().describe('Name of the favored team. Can be full name (e.g., "Houston Rockets"), city (e.g., "Rockets"), or abbreviation (e.g., "HOU"). Aliases: favorite_team, favorite, fav'),
-        team_underdog: z.string().optional().describe('Name of the underdog team. Can be full name (e.g., "Los Angeles Lakers"), city (e.g., "Lakers"), or abbreviation (e.g., "LAL"). Aliases: underdog_team, underdog, dog'),
+        sport: z.literal('basketball').default('basketball').describe('Sport type - "basketball"'),
+        team_favorite: z.string().min(1).describe('Name of the favored team. Can be full name (e.g., "Houston Rockets"), city (e.g., "Rockets"), or abbreviation (e.g., "HOU"). Aliases: favorite_team, favorite, fav'),
+        team_underdog: z.string().min(1).describe('Name of the underdog team. Can be full name (e.g., "Los Angeles Lakers"), city (e.g., "Lakers"), or abbreviation (e.g., "LAL"). Aliases: underdog_team, underdog, dog'),
         spread: z.number().describe('Point spread from the favorite\'s perspective. Must be negative (e.g., -3.5 means favorite must win by more than 3.5 points to cover). Valid range: -50 to -0.5'),
```

### `mcp-server/src/tools/probabilityFootball.ts`

```diff
       inputSchema: {
-        sport: z.literal('football').optional().default('football').describe('Sport type - "football"'),
-        team_favorite: z.string().optional().describe('Name of the favored team. Can be full name (e.g., "Dallas Cowboys"), city (e.g., "Cowboys"), or abbreviation (e.g., "DAL"). Aliases: favorite_team, favorite, fav'),
-        team_underdog: z.string().optional().describe('Name of the underdog team. Can be full name (e.g., "New York Giants"), city (e.g., "Giants"), or abbreviation (e.g., "NYG"). Aliases: underdog_team, underdog, dog'),
+        sport: z.literal('football').default('football').describe('Sport type - "football"'),
+        team_favorite: z.string().min(1).describe('Name of the favored team. Can be full name (e.g., "Dallas Cowboys"), city (e.g., "Cowboys"), or abbreviation (e.g., "DAL"). Aliases: favorite_team, favorite, fav'),
+        team_underdog: z.string().min(1).describe('Name of the underdog team. Can be full name (e.g., "New York Giants"), city (e.g., "Giants"), or abbreviation (e.g., "NYG"). Aliases: underdog_team, underdog, dog'),
         spread: z.number().describe('Point spread from the favorite\'s perspective. Must be negative (e.g., -6.5 means favorite must win by more than 6.5 points to cover). Valid range: -50 to -0.5'),
```

## Verification

After applying the fixes, verify with:

```bash
# 1. Run regression test
npm test -- probability-basketball-mcp.test.ts

# 2. Test with curl
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

# 3. Test with client wrapper
node -e "
import { KellyCriterionMCPClient } from './client.js';
const client = new KellyCriterionMCPClient();
const result = await client.estimateBasketballProbability('Houston Rockets', 'Los Angeles Lakers', -3.5);
console.log(result);
"
```
