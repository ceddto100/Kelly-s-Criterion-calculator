# MCP Tool Annotations Justification

This document provides detailed justifications for the MCP tool annotations for all betgistics tools according to the [MCP Tool Annotations Specification](https://modelcontextprotocol.io/legacy/concepts/tools).

## Understanding the Annotations

- **readOnlyHint**: `true` if the tool only reads data without making modifications; `false` if it creates, updates, or deletes data
- **openWorldHint**: `true` if the tool accesses resources outside user control (external APIs, web services); `false` if it only works with local/user-controlled data
- **destructiveHint**: `true` if the tool can permanently delete or modify data in ways that cannot be easily reversed; `false` otherwise

## Tool Annotations

### 1. kelly-calculate

**Read Only: No**
This tool performs Kelly Criterion calculations and may call the external Gemini API to generate analyst insights. While the primary function is calculation (which is read-only), it can trigger external API calls to Gemini that send data outside the local system, making it not strictly read-only in the MCP sense.

**Open World: Yes**
The tool calls the Gemini AI API (`getAnalystInsight()`) to generate betting insights. This external API call at `generativelanguage.googleapis.com` is outside the user's direct control, qualifying it as an "open world" tool that interacts with external services.

**Destructive: No**
The tool only performs calculations and returns results. It does not delete or permanently modify any data. All operations are non-destructive computations.

---

### 2. probability-estimate-football

**Read Only: Yes**
This tool performs purely mathematical calculations to estimate win probability based on football statistics. It reads input parameters and computes predicted margin and cover probability without modifying any data.

**Open World: No**
All calculations are performed locally using statistical formulas (`predictedMarginFootball`, `coverProbability`). No external APIs or services are called. The tool operates entirely within the local execution environment.

**Destructive: No**
The tool only performs read-only calculations. No data is created, modified, or deleted. All operations are non-destructive computations.

---

### 3. probability-estimate-basketball

**Read Only: Yes**
This tool performs purely mathematical calculations to estimate win probability based on basketball statistics. It reads input parameters and computes predicted margin and cover probability without modifying any data.

**Open World: No**
All calculations are performed locally using statistical formulas (`predictedMarginBasketball`, `coverProbability`). No external APIs or services are called. The tool operates entirely within the local execution environment.

**Destructive: No**
The tool only performs read-only calculations. No data is created, modified, or deleted. All operations are non-destructive computations.

---

### 4. get-team-stats

**Read Only: Yes**
This tool reads team statistics from local CSV files (`loadNBATeamStats`, `loadNFLTeamStats`) and returns the data without any modifications. It performs pure read operations on the statistics database.

**Open World: No**
The tool only reads from local CSV files stored in the server's file system. No external APIs or web services are accessed. All data sources are under the application's direct control.

**Destructive: No**
The tool performs read-only operations on local data files. No data is modified or deleted. All operations are non-destructive.

---

### 5. get-matchup-stats

**Read Only: Yes**
This tool reads statistics for two teams from local CSV files using `getMatchupStats()` and returns a comparison. It performs pure read operations without modifying any data.

**Open World: No**
The tool only reads from local CSV files stored in the server's file system. No external APIs or web services are accessed. All data sources are under the application's direct control.

**Destructive: No**
The tool performs read-only operations on local data files. No data is modified or deleted. All operations are non-destructive.

---

### 6. analyze-matchup

**Read Only: Yes**
While this tool calls an external API (Gemini AI), it only reads team statistics and requests analysis. It does not modify any stored data. The external API call is for analysis purposes only and doesn't alter the application's state or data.

**Open World: Yes**
The tool calls the Gemini AI API (`getAIAnalysis()`) at `generativelanguage.googleapis.com` to generate matchup analysis. This external API is outside the user's direct control, making this an "open world" tool.

**Destructive: No**
The tool only reads data and requests external analysis. No data is deleted or permanently modified. All operations are non-destructive.

---

### 7. log-bet

**Read Only: No**
This tool creates and stores new bet records in both local storage (`localBetStorage.set()`) and attempts to persist to an external backend API (`logBetToBackend()`). It modifies application state by adding new data.

**Open World: Yes**
The tool attempts to send bet data to an external backend API at the URL specified in `BACKEND_URL` environment variable. This backend service is outside the local execution environment and constitutes "open world" access.

**Destructive: No**
While this tool creates new data, it does not delete or permanently modify existing data in an irreversible way. New bet records are additive and can be managed through other tools. The operation is not destructive.

---

### 8. get-bet-history

**Read Only: Yes**
This tool reads bet records from local storage (`localBetStorage.get()`) and returns them without modification. It performs pure read operations to retrieve betting history and calculate summary statistics.

**Open World: No**
The tool only reads from in-memory local storage. No external APIs or services are accessed. All data is stored locally within the server's runtime environment.

**Destructive: No**
The tool performs read-only operations on local data. No data is modified or deleted. All operations are non-destructive.

---

### 9. update-bet-outcome

**Read Only: No**
This tool modifies existing bet records by updating their `outcome` field (`bet.outcome = outcome`). It changes the state of stored data, making it a write operation.

**Open World: No**
The tool only modifies data in local in-memory storage (`localBetStorage`). No external APIs or backend services are called for the update operation. All modifications are local.

**Destructive: No**
While this tool modifies bet outcomes, the changes are not destructive because: (1) bet outcomes can be updated again if needed, (2) the original bet data is preserved, and (3) no data is permanently deleted. The operation is reversible.

---

### 10. get-bankroll

**Read Only: Yes**
This tool reads the current bankroll amount from local storage (`getBankroll()`) and returns it without modification. It performs a pure read operation.

**Open World: No**
The tool only reads from in-memory local storage (`bankrollStorage`). No external APIs or services are accessed. All data is stored locally within the server's runtime environment.

**Destructive: No**
The tool performs read-only operations. No data is modified or deleted. All operations are non-destructive.

---

### 11. set-bankroll

**Read Only: No**
This tool modifies the bankroll amount in local storage (`record.amount = amount`) and adds entries to the history log (`record.history.push()`). It performs write operations that change application state.

**Open World: No**
The tool only modifies data in local in-memory storage (`bankrollStorage`). No external APIs or backend services are accessed. All modifications are local to the server's runtime.

**Destructive: No**
While this tool modifies the bankroll amount, it is not destructive because: (1) all changes are tracked in history (`record.history`), (2) the bankroll can be set again to any value, and (3) no data is permanently deleted. The operation maintains a complete audit trail.

---

### 12. adjust-bankroll

**Read Only: No**
This tool modifies the bankroll amount by adding or subtracting from it (`record.amount = previousAmount + adjustment`) and records the change in history. It performs write operations that change application state.

**Open World: No**
The tool only modifies data in local in-memory storage (`bankrollStorage`). No external APIs or backend services are accessed. All modifications are local to the server's runtime.

**Destructive: No**
While this tool modifies the bankroll, it is not destructive because: (1) all adjustments are logged in history with timestamps and reasons, (2) adjustments can be reversed with opposite operations, and (3) no data is permanently deleted. Full audit trail is maintained.

---

### 13. get-bankroll-history

**Read Only: Yes**
This tool reads the bankroll history from local storage (`record.history`) and returns it without modification. It performs pure read operations to retrieve historical bankroll changes.

**Open World: No**
The tool only reads from in-memory local storage (`bankrollStorage`). No external APIs or services are accessed. All data is stored locally within the server's runtime environment.

**Destructive: No**
The tool performs read-only operations. No data is modified or deleted. All operations are non-destructive.

---

## Summary Table

| Tool | Read Only | Open World | Destructive |
|------|-----------|------------|-------------|
| kelly-calculate | No | Yes | No |
| probability-estimate-football | Yes | No | No |
| probability-estimate-basketball | Yes | No | No |
| get-team-stats | Yes | No | No |
| get-matchup-stats | Yes | No | No |
| analyze-matchup | Yes | Yes | No |
| log-bet | No | Yes | No |
| get-bet-history | Yes | No | No |
| update-bet-outcome | No | No | No |
| get-bankroll | Yes | No | No |
| set-bankroll | No | No | No |
| adjust-bankroll | No | No | No |
| get-bankroll-history | Yes | No | No |

## Implementation Status

Based on the codebase analysis, the current implementation has the following annotations set:

✅ **Correctly Set:**
- `probability-estimate-football`: readOnlyHint = true
- `probability-estimate-basketball`: readOnlyHint = true
- `get-team-stats`: readOnlyHint = true
- `get-matchup-stats`: readOnlyHint = true
- `analyze-matchup`: readOnlyHint = true
- `get-bet-history`: readOnlyHint = true
- `get-bankroll`: readOnlyHint = true
- `get-bankroll-history`: readOnlyHint = true

⚠️ **Need Verification/Update:**
- `kelly-calculate`: Currently has readOnlyHint = false (correct), but missing openWorldHint
- `log-bet`: Currently has readOnlyHint = false (correct), but missing openWorldHint
- Other tools missing explicit openWorldHint and destructiveHint annotations

## Recommendations

1. Add explicit `openWorldHint` and `destructiveHint` annotations to all tool definitions
2. Set `openWorldHint = true` for tools that call external APIs (kelly-calculate, analyze-matchup, log-bet)
3. Set `destructiveHint = false` for all tools (none perform destructive operations)
4. Update MCP server implementation to include all three hint fields for OpenAI/ChatGPT compatibility
