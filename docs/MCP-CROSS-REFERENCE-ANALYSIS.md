# MCP Server Cross-Reference Analysis

This document provides a comprehensive mapping of workflows across the **MCP Server**, **Backend**, and **ChatGPT Widgets** (frontend for MCP context), documenting data flows, dependencies, and extension points.

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Workflow Component Mapping](#2-workflow-component-mapping)
3. [MCP Server Workflows](#3-mcp-server-workflows)
4. [Backend Services Mapping](#4-backend-services-mapping)
5. [Data Flow Analysis](#5-data-flow-analysis)
6. [Side Effects and Dependencies](#6-side-effects-and-dependencies)
7. [Extension Points](#7-extension-points)
8. [Assumptions and Constraints](#8-assumptions-and-constraints)
9. [Integration Patterns](#9-integration-patterns)

---

## 1. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER INTERFACES                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│   ChatGPT + Widgets        │        Standalone Frontend                     │
│   (AI Assistant Flow)      │        (Direct Web App Flow)                   │
└──────────┬─────────────────┴────────────────┬───────────────────────────────┘
           │                                   │
           ▼                                   ▼
┌─────────────────────────┐       ┌───────────────────────────────────────────┐
│      MCP SERVER v2.0    │       │            BACKEND API                     │
│  (Express + MCP SDK)    │       │         (Express + MongoDB)                │
│                         │       │                                            │
│  Core Tools:            │       │  Routes:                                   │
│  - kelly-calculate      │       │  - /auth/* (Google OAuth)                  │
│  - probability-football │       │  - /api/bets/* (CRUD)                      │
│  - probability-basketball       │  - /api/calculate (Gemini)                 │
│                         │       │  - /api/offense, defense, matchup          │
│  Stats & Matchup Tools: │       │  - /api/user/status                        │
│  - get-team-stats       │       │                                            │
│  - get-matchup-stats    │       │  External Services:                        │
│  - analyze-matchup      │       │  - MongoDB (persistence)                   │
│                         │       │  - Google OAuth                            │
│  Bet Management:        │       │  - Gemini AI                               │
│  - log-bet              │       │  - ESPN API (scrapers)                     │
│  - get-bet-history      │       │                                            │
│  - update-bet-outcome   │       │                                            │
│                         │       │                                            │
│  Bankroll Management:   │       │                                            │
│  - get-bankroll         │       │                                            │
│  - set-bankroll         │       │                                            │
│  - adjust-bankroll      │       │                                            │
│  - get-bankroll-history │       │                                            │
│                         │       │                                            │
│  Resources:             │       │                                            │
│  - kelly-calculator.html│       │                                            │
│  - probability.html     │       │                                            │
└──────────┬──────────────┘       └───────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────┐
│   CHATGPT WIDGETS       │
│   (React Components)    │
│                         │
│  - KellyWidget.tsx      │
│  - ProbabilityWidget.tsx│
│  - LoadingState.tsx     │
└─────────────────────────┘
```

---

## 2. Workflow Component Mapping

### 2.1 MCP Server Tools → Backend Mapping

| MCP Tool | Backend Equivalent | Widget | Purpose |
|----------|-------------------|--------|---------|
| **Core Calculations** ||||
| `kelly-calculate` | - | `KellyWidget.tsx` | Calculate optimal bet size |
| `probability-estimate-football` | - | `ProbabilityWidget.tsx` | NFL/CFB probability |
| `probability-estimate-basketball` | - | `ProbabilityWidget.tsx` | NBA/CBB probability |
| **Team Stats & Matchups** ||||
| `get-team-stats` | `/api/matchup` (single) | - | Get team statistics |
| `get-matchup-stats` | `/api/matchup` | - | Compare two teams |
| `analyze-matchup` | `/api/analyze` | - | AI matchup analysis |
| **Bet Management** ||||
| `log-bet` | `POST /api/bets` | - | Record a bet |
| `get-bet-history` | `GET /api/bets` | - | View betting history |
| `update-bet-outcome` | `PATCH /api/bets/:id/outcome` | - | Record win/loss/push |
| **Bankroll Management** ||||
| `get-bankroll` | `GET /auth/bankroll` | - | Check current bankroll |
| `set-bankroll` | `PATCH /auth/bankroll` | - | Set bankroll amount |
| `adjust-bankroll` | - | - | Add/subtract from bankroll |
| `get-bankroll-history` | - | - | View bankroll changes |

### 2.2 Backend Route → Service Mapping

| Route | Handler | Service Dependencies | Auth Required |
|-------|---------|---------------------|---------------|
| `POST /api/calculate` | `server.js:216-271` | Gemini API | No |
| `POST /api/calculate-premium` | `server.js:275-362` | Gemini API, MongoDB | Yes (identifier) |
| `GET /api/user/status` | `server.js:200-212` | MongoDB | Yes (identifier) |
| `POST /api/bets` | `routes/bets.js:49-123` | MongoDB | Yes (OAuth) |
| `GET /api/bets` | `routes/bets.js:126-171` | MongoDB | Yes (OAuth) |
| `PATCH /api/bets/:id/outcome` | `routes/bets.js:206-261` | MongoDB | Yes (OAuth) |
| `GET /auth/google` | `routes/auth.js:25-29` | Passport/Google | No |
| `GET /auth/status` | `routes/auth.js:82-98` | Session | No |
| `GET /auth/bankroll` | `routes/auth.js:106-144` | MongoDB | Yes (OAuth) |

---

## 3. MCP Server Workflows

### 3.1 Kelly Calculation Workflow

**Entry Point:** `mcp-server/src/tools/kelly.ts:24`

```
User Request (ChatGPT)
        │
        ▼
┌─────────────────────────────────────┐
│ MCP Server receives tool call       │
│ Tool: kelly-calculate               │
│ Location: server.ts:76              │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ Input Validation (Zod Schema)       │
│ Location: kelly.ts:15-20            │
│                                     │
│ Validates:                          │
│ - bankroll: number (positive)       │
│ - odds: American format (±100+)     │
│ - probability: 0.1-99.9%            │
│ - fraction: '1', '0.5', '0.25'      │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ Core Calculation                    │
│ Location: calculations.ts:70-76     │
│                                     │
│ Steps:                              │
│ 1. americanToDecimal(odds)          │
│ 2. kellyFraction(prob, decimalOdds) │
│ 3. stake = bankroll × k × fraction  │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ AI Insight (Optional)               │
│ Location: gemini.ts:25-73           │
│                                     │
│ - Calls Gemini 1.5 Flash            │
│ - Generates 1-2 sentence analysis   │
│ - Graceful failure (returns '')     │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ Response Formatting                 │
│ Location: kelly.ts:169-234          │
│                                     │
│ Returns:                            │
│ - structuredContent (for model)     │
│ - content[].text (natural language) │
│ - _meta (widget rendering data)     │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ Widget Rendering                    │
│ Location: KellyWidget.tsx           │
│                                     │
│ Reads: window.openai.toolOutput     │
│ Renders: stake, percentage, insight │
│ Supports: inline, fullscreen, pip   │
└─────────────────────────────────────┘
```

### 3.2 Probability Estimation Workflow (Football)

**Entry Point:** `mcp-server/src/tools/probabilityFootball.ts:30`

```
User Request (ChatGPT)
        │
        ▼
┌─────────────────────────────────────┐
│ Tool: probability-estimate-football │
│ Location: server.ts:77              │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ Input Validation                    │
│ Location: probabilityFootball.ts:66-87
│                                     │
│ Validates 11 statistical parameters:│
│ - Team: pointsFor/Against, yards    │
│ - Opponent: pointsFor/Against, yards│
│ - Turnover differentials            │
│ - Point spread                      │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ Statistical Calculation             │
│ Location: calculations.ts:81-96     │
│                                     │
│ predictedMarginFootball():          │
│ - Points component (50% weight)     │
│ - Yards component (30% weight)      │
│ - Turnover component (20% weight)   │
│                                     │
│ coverProbability():                 │
│ - Z-score: (margin + spread) / σ    │
│ - σ = 13.5 (football std dev)       │
│ - normCdf() for probability         │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ Response with Team Stats            │
│ Returns: probability, margin,       │
│ spread, teamStats, opponentStats    │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ Widget Rendering                    │
│ Location: ProbabilityWidget.tsx     │
│                                     │
│ Displays:                           │
│ - Cover/upset probability           │
│ - Predicted margin                  │
│ - Team comparison table             │
│ - "Use in Kelly" action button      │
└─────────────────────────────────────┘
```

### 3.3 Tool Chaining Workflow

The ProbabilityWidget enables direct tool chaining:

```
ProbabilityWidget.tsx:113-140
        │
        ▼
┌─────────────────────────────────────┐
│ handleUseInKelly()                  │
│                                     │
│ Calls: window.openai.callTool(      │
│   'kelly-calculate', {              │
│     bankroll: defaultBankroll,      │
│     odds: defaultOdds,              │
│     probability: data.probability,  │
│     fraction: '1'                   │
│   }                                 │
│ )                                   │
└─────────────────────────────────────┘
```

---

## 4. Backend Services Mapping

### 4.1 Authentication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    GOOGLE OAUTH FLOW                             │
└─────────────────────────────────────────────────────────────────┘

1. GET /auth/google
   └─► passport.authenticate('google', {scope: ['profile', 'email']})
        └─► Redirects to Google

2. GET /auth/google/callback
   └─► passport.authenticate('google')
        └─► config/passport.js handles profile
             └─► Creates/updates GoogleUser in MongoDB
                  └─► Redirects to FRONTEND_URL

3. GET /auth/status
   └─► Returns: { authenticated: boolean, user?: {...} }

4. GET /auth/logout
   └─► req.logout() → session.destroy() → clearCookie
```

### 4.2 Bet Logging Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    BET LOGGING FLOW                              │
└─────────────────────────────────────────────────────────────────┘

POST /api/bets
        │
        ▼
┌───────────────────────────┐
│ ensureAuthenticated       │ ◄─── middleware/auth.js
└──────────────┬────────────┘
               │
               ▼
┌───────────────────────────┐
│ Extract from req.body:    │
│ - matchup (sport, teams)  │
│ - estimation (spread,     │
│   probability, edge)      │
│ - kelly (bankroll, odds,  │
│   stake, percentage)      │
│ - actualWager             │
│ - notes, tags             │
└──────────────┬────────────┘
               │
               ▼
┌───────────────────────────┐
│ Sanitize inputs (XSS)     │
│ Create BetLog document    │
│ Save to MongoDB           │
└──────────────┬────────────┘
               │
               ▼
┌───────────────────────────┐
│ Response:                 │
│ { success, bet, bankroll }│
└───────────────────────────┘
```

### 4.3 AI Calculation Flow (Backend)

```
POST /api/calculate
        │
        ▼
┌───────────────────────────┐
│ Extract: prompt,          │
│ systemInstruction         │
└──────────────┬────────────┘
               │
               ▼
┌───────────────────────────┐
│ Call Gemini API:          │
│ gemini-2.5-flash          │
│ response_mime: JSON       │
│ temperature: 0.2          │
└──────────────┬────────────┘
               │
               ▼
┌───────────────────────────┐
│ Parse response.candidates │
│ [0].content.parts[0].text │
│ Return: { text }          │
└───────────────────────────┘
```

---

## 5. Data Flow Analysis

### 5.1 MCP Tool Data Structures

#### Kelly Tool Input/Output

```typescript
// INPUT (kelly.ts:15-20)
interface KellyInput {
  bankroll: number;      // Positive USD amount
  odds: number;          // American odds (±100+)
  probability: number;   // 0.1-99.9 percentage
  fraction: '1' | '0.5' | '0.25';
}

// OUTPUT (structuredContent)
interface KellyOutput {
  hasValue: boolean;
  stake: number;
  stakePercentage: number;
  bankroll: number;
  odds: number;
  probability: number;
  decimalOdds: number;
  fraction: number;
  kellyFraction: number;
  insight?: string;
  lastCalculated: string;
}
```

#### Probability Tool Input/Output (Football)

```typescript
// INPUT (probabilityFootball.ts:14-26)
interface FootballInput {
  teamPointsFor: number;       // 0-100
  teamPointsAgainst: number;   // 0-100
  opponentPointsFor: number;   // 0-100
  opponentPointsAgainst: number; // 0-100
  teamOffYards: number;        // 0-1000
  teamDefYards: number;        // 0-1000
  opponentOffYards: number;    // 0-1000
  opponentDefYards: number;    // 0-1000
  teamTurnoverDiff: number;    // -50 to +50
  opponentTurnoverDiff: number; // -50 to +50
  spread: number;              // -100 to +100
}

// OUTPUT (structuredContent)
interface FootballOutput {
  sport: 'football';
  probability: number;
  predictedMargin: number;
  spread: number;
  sigma: number;  // 13.5 for football
  teamStats: TeamStats;
  opponentStats: TeamStats;
  estimatedAt: string;
}
```

### 5.2 Backend Data Structures

#### BetLog Schema (MongoDB)

```javascript
// models/BetLog.js
{
  userId: String,           // Google OAuth ID
  matchup: {
    sport: 'football' | 'basketball',
    teamA: { name, abbreviation, stats },
    teamB: { name, abbreviation, stats },
    venue: 'home' | 'away' | 'neutral'
  },
  estimation: {
    pointSpread: Number,
    calculatedProbability: Number,
    expectedMargin: Number,
    impliedProbability: Number,
    edge: Number
  },
  kelly: {
    bankroll: Number,
    americanOdds: Number,
    kellyFraction: Number,
    recommendedStake: Number,
    stakePercentage: Number
  },
  actualWager: Number,
  outcome: {
    result: 'pending' | 'win' | 'loss' | 'push' | 'cancelled',
    actualScore: { teamA, teamB },
    payout: Number,
    settledAt: Date
  },
  notes: String,
  tags: [String],
  createdAt: Date,
  updatedAt: Date
}
```

### 5.3 Widget State Persistence

Widgets use `window.openai.widgetState` for persistence:

```typescript
// KellyWidget state
interface KellyWidgetState {
  showDetails?: boolean;
  collapsed?: boolean;
}

// ProbabilityWidget state
interface ProbabilityWidgetState {
  showStats?: boolean;
  defaultBankroll?: number;
  defaultOdds?: number;
}
```

---

## 6. Side Effects and Dependencies

### 6.1 External Service Dependencies

| Component | Service | Purpose | Failure Behavior |
|-----------|---------|---------|------------------|
| MCP Server | Gemini API | AI insights | Graceful (empty string) |
| Backend | MongoDB | Data persistence | Fatal (server won't start) |
| Backend | Google OAuth | Authentication | Login fails |
| Backend | Gemini API | AI calculations | Returns error |
| Backend | ESPN API | Sports stats | Returns error in health check |

### 6.2 Side Effects Matrix

| Action | Side Effect | Location |
|--------|-------------|----------|
| `kelly-calculate` | Gemini API call (optional) | `gemini.ts:41-59` |
| `POST /api/bets` | MongoDB write | `bets.js:112` |
| `PATCH /api/bets/:id/outcome` | MongoDB update | `bets.js:250` |
| `POST /api/calculate-premium` | MongoDB user update, Calculation log | `server.js:305-314` |
| OAuth callback | MongoDB user upsert | `passport.js` |

### 6.3 Environment Variable Dependencies

**MCP Server:**
```env
PORT=3000
ALLOWED_ORIGINS=https://chatgpt.com
GEMINI_API_KEY=your_key_here  # Optional for insights
```

**Backend:**
```env
# Required
MONGODB_URI=
GEMINI_API_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
FRONTEND_URL=
SESSION_SECRET=

# Optional
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
ADMIN_KEY=
```

---

## 7. Extension Points

### 7.1 Adding a New MCP Tool

1. **Create tool file:** `mcp-server/src/tools/newTool.ts`

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function registerNewTool(server: McpServer) {
  server.tool(
    'tool-name',
    {
      title: 'Tool Display Name',
      description: 'When to use this tool...',
      inputSchema: {
        param1: z.number().describe('Description'),
        param2: z.string().describe('Description')
      },
      _meta: {
        'openai/outputTemplate': 'ui://widget/new-widget.html',
        'openai/widgetAccessible': true
      }
    },
    async (args, extra) => {
      // Implementation
      return {
        structuredContent: { /* data for model */ },
        content: [{ type: 'text', text: 'Result summary' }],
        _meta: { /* data for widget */ }
      };
    }
  );
}
```

2. **Register in server.ts:**

```typescript
import { registerNewTool } from './tools/newTool.js';
// ...
registerNewTool(mcpServer);
```

3. **Create widget component:** `chatgpt-widgets/src/widgets/NewWidget.tsx`

4. **Register widget resource:** `mcp-server/src/components/resources.ts`

### 7.2 Adding a New Backend Route

1. **Create route file:** `backend/routes/newRoute.js`

```javascript
const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

router.get('/', ensureAuthenticated, asyncHandler(async (req, res) => {
  // Implementation
  res.json({ success: true });
}));

module.exports = router;
```

2. **Mount in server.js:**

```javascript
const newRoute = require('./routes/newRoute');
app.use('/api/new', newRoute);
```

### 7.3 Adding a New Widget Display Mode

Widgets support three modes: `inline`, `fullscreen`, `pip`

To add custom mode behavior in a widget:

```typescript
// In widget component
if (displayMode === 'custom-mode') {
  return (
    <div className={`widget-container mode-${displayMode}`}>
      {/* Custom layout */}
    </div>
  );
}
```

### 7.4 Adding Localization

1. **Add translations in:** `mcp-server/src/utils/translations.ts`

```typescript
const translations: Record<string, Record<string, string>> = {
  en: {
    new_key: 'English text',
    // ...
  },
  es: {
    new_key: 'Spanish text',
    // ...
  }
};
```

2. **Use in tools:**

```typescript
import { t } from '../utils/translations.js';
const message = t('new_key', locale);
```

---

## 8. Assumptions and Constraints

### 8.1 System Assumptions

| Assumption | Impact | Location |
|------------|--------|----------|
| American odds format | Conversion logic required | `calculations.ts:56-62` |
| Football σ = 13.5 | Statistical model accuracy | `probabilityFootball.ts:122` |
| Basketball σ = 12.0 | Statistical model accuracy | `probabilityBasketball.ts:103` |
| User has Google account | OAuth only auth method | `auth.js` |
| MongoDB always available | No fallback storage | `database.js` |
| Gemini API key valid | Insights work | `gemini.ts:29` |

### 8.2 Data Validation Constraints

**Kelly Calculator:**
- Bankroll: $0.01 - $1,000,000,000
- Odds: ≤ -100 or ≥ 100 (no values between)
- Probability: 0.1% - 99.9%

**Football Estimator:**
- Points: 0-100
- Yards: 0-1000
- Turnover Diff: -50 to +50
- Spread: -100 to +100

**Basketball Estimator:**
- Points: 0-200
- FG%: 0-1 (decimal)
- Margins: -50 to +50
- Spread: -100 to +100

### 8.3 Security Constraints

| Constraint | Implementation | Location |
|------------|----------------|----------|
| XSS Prevention | HTML bracket removal | `bets.js:68-71` |
| CORS | Allowed origins list | `server.ts:34-50`, `server.js:72-76` |
| Rate Limiting | 100 req/15 min | `server.js:133-140` |
| Session Security | httpOnly, secure, sameSite | `server.js:119-125` |
| API Key Server-side | Never exposed to client | `gemini.ts:26-27` |

---

## 9. Integration Patterns

### 9.1 MCP-to-Widget Communication

```
MCP Tool Return
      │
      ├── structuredContent ──► Model (ChatGPT) sees this
      │
      ├── content[] ──────────► Natural language for model
      │
      └── _meta ──────────────► Widget rendering data
                                     │
                                     ▼
                              window.openai.toolOutput
                                     │
                                     ▼
                              React Component State
```

### 9.2 Widget-to-Tool Communication

```
React Component
      │
      ▼
window.openai.callTool('tool-name', { params })
      │
      ▼
MCP Server receives tool call
      │
      ▼
New widget renders with result
```

### 9.3 Backend Authentication Pattern

```
Frontend Request
      │
      ▼
┌─────────────────────────┐
│ ensureAuthenticated     │
│ middleware/auth.js      │
├─────────────────────────┤
│ Checks: req.isAuthenticated()
│ Failure: 401 Unauthorized
│ Success: Continue to route
└─────────────────────────┘
```

### 9.4 Error Handling Pattern

```typescript
// MCP Tool Error Response
return {
  structuredContent: {
    error: 'error_code',
    message: t('error_message', locale)
  },
  content: [{ type: 'text', text: 'Error description' }],
  isError: true,
  _meta: { 'openai/locale': locale }
};
```

```javascript
// Backend Error Response (via asyncHandler)
throw new Error('Message');  // → 500 Internal Server Error
// or
res.status(400).json({ error: 'Bad Request', message: 'Details' });
```

---

## Summary

This cross-reference analysis maps the complete workflow between:

1. **MCP Server** - 3 tools (kelly, football, basketball) with SSE transport
2. **ChatGPT Widgets** - 2 React components rendering tool output
3. **Backend API** - Express server with OAuth, bet logging, AI calculations

**Key Integration Points:**
- MCP tools return `structuredContent` + `_meta` for widget rendering
- Widgets can chain tools via `window.openai.callTool()`
- Backend uses Passport.js session auth, MCP has no auth layer
- Gemini AI is used in both layers for different purposes

**Extension Safety:**
- Add new tools following the registration pattern in `server.ts`
- Add new widgets with proper `toolOutput` detection in `index.tsx`
- Add new routes with `ensureAuthenticated` middleware
- Always validate inputs using Zod schemas
