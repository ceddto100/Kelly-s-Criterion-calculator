#!/bin/bash
# Test MCP JSON-RPC endpoints locally
# Usage: ./test-mcp-endpoints.sh [base_url]
# Example: ./test-mcp-endpoints.sh http://localhost:3000

set -e

BASE_URL="${1:-http://localhost:3000}"

echo "========================================="
echo "Testing MCP JSON-RPC Endpoints"
echo "Base URL: $BASE_URL"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Health Check
echo -e "${YELLOW}Test 1: Health Check${NC}"
echo "GET $BASE_URL/health"
HEALTH_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" "$BASE_URL/health")
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✓ Health check passed${NC}"
  echo "$HEALTH_RESPONSE" | grep -v "HTTP_CODE" | jq '.'
else
  echo -e "${RED}✗ Health check failed (HTTP $HTTP_CODE)${NC}"
  echo "$HEALTH_RESPONSE" | grep -v "HTTP_CODE"
fi
echo ""

# Test 2: Initialize
echo -e "${YELLOW}Test 2: Initialize${NC}"
echo "POST $BASE_URL/mcp (method: initialize)"
INIT_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {"name": "test-script", "version": "1.0.0"}
    },
    "id": 1
  }')

HTTP_CODE=$(echo "$INIT_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✓ Initialize passed${NC}"
  echo "$INIT_RESPONSE" | grep -v "HTTP_CODE" | jq '.'
else
  echo -e "${RED}✗ Initialize failed (HTTP $HTTP_CODE)${NC}"
  echo "$INIT_RESPONSE" | grep -v "HTTP_CODE"
fi
echo ""

# Test 3: Tools List
echo -e "${YELLOW}Test 3: Tools List${NC}"
echo "POST $BASE_URL/mcp (method: tools/list)"
TOOLS_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "params": {},
    "id": 2
  }')

HTTP_CODE=$(echo "$TOOLS_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✓ Tools list passed${NC}"

  # Extract tool count
  TOOL_COUNT=$(echo "$TOOLS_RESPONSE" | grep -v "HTTP_CODE" | jq '.result.tools | length')
  echo "Found $TOOL_COUNT tools:"
  echo "$TOOLS_RESPONSE" | grep -v "HTTP_CODE" | jq '.result.tools[] | .name'
  echo ""
  echo "Full response:"
  echo "$TOOLS_RESPONSE" | grep -v "HTTP_CODE" | jq '.'
else
  echo -e "${RED}✗ Tools list failed (HTTP $HTTP_CODE)${NC}"
  echo "$TOOLS_RESPONSE" | grep -v "HTTP_CODE"
fi
echo ""

# Test 4: Tool Call (kelly-calculate)
echo -e "${YELLOW}Test 4: Tool Call (kelly-calculate)${NC}"
echo "POST $BASE_URL/mcp (method: tools/call)"
CALL_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "kelly-calculate",
      "arguments": {
        "bankroll": 1000,
        "odds": -110,
        "probability": 55,
        "fraction": "1"
      }
    },
    "id": 3
  }')

HTTP_CODE=$(echo "$CALL_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✓ Tool call passed${NC}"
  echo "$CALL_RESPONSE" | grep -v "HTTP_CODE" | jq '.'
else
  echo -e "${RED}✗ Tool call failed (HTTP $HTTP_CODE)${NC}"
  echo "$CALL_RESPONSE" | grep -v "HTTP_CODE"
fi
echo ""

# Test 5: Resources List
echo -e "${YELLOW}Test 5: Resources List${NC}"
echo "POST $BASE_URL/mcp (method: resources/list)"
RESOURCES_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "resources/list",
    "params": {},
    "id": 4
  }')

HTTP_CODE=$(echo "$RESOURCES_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✓ Resources list passed${NC}"
  echo "$RESOURCES_RESPONSE" | grep -v "HTTP_CODE" | jq '.'
else
  echo -e "${RED}✗ Resources list failed (HTTP $HTTP_CODE)${NC}"
  echo "$RESOURCES_RESPONSE" | grep -v "HTTP_CODE"
fi
echo ""

# Test 6: Trailing Slash
echo -e "${YELLOW}Test 6: Trailing Slash (POST /mcp/)${NC}"
echo "POST $BASE_URL/mcp/ (method: initialize)"
SLASH_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$BASE_URL/mcp/" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "params": {},
    "id": 5
  }')

HTTP_CODE=$(echo "$SLASH_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✓ Trailing slash handled correctly${NC}"
  echo "$SLASH_RESPONSE" | grep -v "HTTP_CODE" | jq '.'
else
  echo -e "${YELLOW}! Trailing slash response: HTTP $HTTP_CODE${NC}"
  echo "$SLASH_RESPONSE" | grep -v "HTTP_CODE"
fi
echo ""

# Test 7: Domain Verification
echo -e "${YELLOW}Test 7: OpenAI Domain Verification${NC}"
echo "GET $BASE_URL/.well-known/openai-apps-challenge"
VERIFY_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" "$BASE_URL/.well-known/openai-apps-challenge")
HTTP_CODE=$(echo "$VERIFY_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✓ Domain verification endpoint accessible${NC}"
  echo "Token: $(echo "$VERIFY_RESPONSE" | grep -v "HTTP_CODE")"
else
  echo -e "${RED}✗ Domain verification failed (HTTP $HTTP_CODE)${NC}"
  echo "$VERIFY_RESPONSE" | grep -v "HTTP_CODE"
fi
echo ""

echo "========================================="
echo "All tests completed!"
echo "========================================="
