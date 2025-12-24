# MCP Tool Annotations Justification

This document provides detailed justifications for the MCP tool annotations for all betgistics tools according to the [MCP Tool Annotations Specification](https://modelcontextprotocol.io/legacy/concepts/tools).

## Understanding the Annotations

- **readOnlyHint**: `true` if the tool only reads data without making modifications; `false` if it creates, updates, or deletes data
- **openWorldHint**: `true` if the tool accesses resources outside user control (external APIs, web services); `false` if it only works with local/user-controlled data
- **destructiveHint**: `true` if the tool can permanently delete or modify data in ways that cannot be easily reversed; `false` otherwise

## Tool Annotations

### 1. kelly-calculate

**Read Only: No**
Performs calculations but calls external Gemini API (getAnalystInsight()) to send data and generate insights, making it a write operation to external services.

**Open World: Yes**
Calls Gemini AI API at generativelanguage.googleapis.com for analyst insights, which is an external service outside user control.

**Destructive: No**
Only performs calculations and returns results. No data deletion or permanent modification occurs.

---

### 2. probability-estimate-football

**Read Only: Yes**
Performs purely mathematical calculations using predictedMarginFootball() and coverProbability() without modifying any stored data.

**Open World: No**
All calculations are local using statistical formulas. No external APIs or web services are accessed.

**Destructive: No**
Only performs read-only calculations. No data creation, modification, or deletion.

---

### 3. probability-estimate-basketball

**Read Only: Yes**
Performs purely mathematical calculations using predictedMarginBasketball() and coverProbability() without modifying any stored data.

**Open World: No**
All calculations are local using statistical formulas. No external APIs or web services are accessed.

**Destructive: No**
Only performs read-only calculations. No data creation, modification, or deletion.

---

### 4. get-team-stats

**Read Only: Yes**
Reads team statistics from local CSV files using loadNBATeamStats() and loadNFLTeamStats() without any modifications.

**Open World: No**
Only reads from local CSV files on the server. No external APIs or web services accessed.

**Destructive: No**
Performs read-only operations on local files. No data modification or deletion.

---

### 5. get-matchup-stats

**Read Only: Yes**
Reads statistics for two teams from local CSV files using getMatchupStats() without modifying data.

**Open World: No**
Only reads from local CSV files on the server. No external APIs or web services accessed.

**Destructive: No**
Performs read-only operations on local files. No data modification or deletion.

---

### 6. analyze-matchup

**Read Only: Yes**
Reads team statistics from local files and requests external analysis without modifying any stored data.

**Open World: Yes**
Calls Gemini AI API at generativelanguage.googleapis.com via getAIAnalysis() for matchup analysis.

**Destructive: No**
Only reads data and requests external analysis. No data deletion or permanent modification.

---

### 7. log-bet

**Read Only: No**
Creates new bet records in local storage (localBetStorage.set()) and sends data to external backend API via logBetToBackend().

**Open World: Yes**
Sends bet data to external backend API at BACKEND_URL environment variable, which is outside local environment.

**Destructive: No**
Creates new data records but doesn't delete or irreversibly modify existing data. Operations are additive.

---

### 8. get-bet-history

**Read Only: Yes**
Reads bet records from local in-memory storage (localBetStorage.get()) and calculates statistics without modification.

**Open World: No**
Only reads from in-memory local storage. No external APIs or services accessed.

**Destructive: No**
Performs read-only operations on local data. No modification or deletion.

---

### 9. update-bet-outcome

**Read Only: No**
Modifies existing bet records by updating the outcome field (bet.outcome = outcome) in local storage.

**Open World: No**
Only modifies local in-memory storage (localBetStorage). No external APIs called.

**Destructive: No**
Modifies bet outcomes but changes are reversible. Outcomes can be updated again and no data is permanently deleted.

---

### 10. get-bankroll

**Read Only: Yes**
Reads current bankroll amount from local storage using getBankroll() without modification.

**Open World: No**
Only reads from in-memory local storage (bankrollStorage). No external APIs accessed.

**Destructive: No**
Performs read-only operations. No data modification or deletion.

---

### 11. set-bankroll

**Read Only: No**
Modifies bankroll amount in local storage (record.amount = amount) and adds history entries (record.history.push()).

**Open World: No**
Only modifies local in-memory storage (bankrollStorage). No external APIs accessed.

**Destructive: No**
Changes are tracked in history (record.history), bankroll can be reset, and no data is deleted. Complete audit trail maintained.

---

### 12. adjust-bankroll

**Read Only: No**
Modifies bankroll by adding/subtracting amounts (record.amount = previousAmount + adjustment) and logs changes in history.

**Open World: No**
Only modifies local in-memory storage (bankrollStorage). No external APIs accessed.

**Destructive: No**
Adjustments are logged with timestamps and reasons. Changes are reversible and no data is deleted. Full audit trail maintained.

---

### 13. get-bankroll-history

**Read Only: Yes**
Reads bankroll history from local storage (record.history) without modification.

**Open World: No**
Only reads from in-memory local storage (bankrollStorage). No external APIs accessed.

**Destructive: No**
Performs read-only operations. No data modification or deletion.

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
