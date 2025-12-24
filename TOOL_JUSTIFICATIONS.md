# MCP Tool Annotations Justification

This document provides detailed justifications for the MCP tool annotations for all betgistics tools according to the [MCP Tool Annotations Specification](https://modelcontextprotocol.io/legacy/concepts/tools).

## Understanding the Annotations

- **readOnlyHint**: `true` if the tool only reads data without making modifications; `false` if it creates, updates, or deletes data
- **openWorldHint**: `true` if the tool accesses resources outside user control (external APIs, web services); `false` if it only works with local/user-controlled data
- **destructiveHint**: `true` if the tool can permanently delete or modify data in ways that cannot be easily reversed; `false` otherwise

## Tool Annotations

### 1. kelly-calculate

**Read Only: No**
Correct. Tool calls external Gemini API (getAnalystInsight()) to send betting data for analysis, which constitutes a write operation to external services.

**Open World: Yes**
Correct. Tool makes HTTP requests to Gemini AI API at generativelanguage.googleapis.com, an external service outside user's infrastructure.

**Destructive: No (should be No)**
Tool only performs calculations and returns results. No data is permanently deleted or modified in an irreversible way. Changes scanner classification from Yes to No.

---

### 2. probability-estimate-football

**Read Only: Yes (should be Yes)**
Incorrect scanner classification. Tool only performs local mathematical calculations using predictedMarginFootball() without modifying any data. Changes from No to Yes.

**Open World: No (should be No)**
Incorrect scanner classification. All calculations are purely local statistical formulas with no external API calls or network access. Changes from Yes to No.

**Destructive: No (should be No)**
Tool performs read-only probability calculations. No data deletion, modification, or permanent changes occur. Changes scanner classification from Yes to No.

---

### 3. probability-estimate-basketball

**Read Only: Yes (should be Yes)**
Incorrect scanner classification. Tool only performs local mathematical calculations using predictedMarginBasketball() without modifying any data. Changes from No to Yes.

**Open World: No (should be No)**
Incorrect scanner classification. All calculations are purely local statistical formulas with no external API calls or network access. Changes from Yes to No.

**Destructive: No (should be No)**
Tool performs read-only probability calculations. No data deletion, modification, or permanent changes occur. Changes scanner classification from Yes to No.

---

### 4. get-team-stats

**Read Only: Yes (should be Yes)**
Incorrect scanner classification. Tool only reads from local CSV files using loadNBATeamStats()/loadNFLTeamStats() without modification. Changes from No to Yes.

**Open World: No (should be No)**
Incorrect scanner classification. Only accesses local CSV files on server filesystem, no external APIs or network requests. Changes from Yes to No.

**Destructive: No (should be No)**
Tool performs read-only file operations. No data deletion, modification, or permanent changes to files occur. Changes scanner classification from Yes to No.

---

### 5. get-matchup-stats

**Read Only: Yes (should be Yes)**
Incorrect scanner classification. Tool only reads from local CSV files using getMatchupStats() for two teams without modification. Changes from No to Yes.

**Open World: No (should be No)**
Incorrect scanner classification. Only accesses local CSV files on server filesystem, no external APIs or network requests. Changes from Yes to No.

**Destructive: No (should be No)**
Tool performs read-only file operations on team statistics. No data deletion, modification, or permanent changes occur. Changes scanner classification from Yes to No.

---

### 6. analyze-matchup

**Read Only: Yes (should be Yes)**
Incorrect scanner classification. Tool only reads local team stats and requests external analysis without modifying stored data. Changes from No to Yes.

**Open World: Yes**
Correct. Tool makes HTTP requests to Gemini AI API at generativelanguage.googleapis.com via getAIAnalysis() for matchup insights.

**Destructive: No (should be No)**
Tool only reads data and requests analysis. No data deletion, modification, or permanent changes occur. Changes scanner classification from Yes to No.

---

### 7. log-bet

**Read Only: No**
Correct. Tool creates new bet records in storage (localBetStorage.set()) and sends data to external backend API via logBetToBackend().

**Open World: Yes**
Correct. Tool makes HTTP POST requests to external backend API at BACKEND_URL to persist bet data outside local environment.

**Destructive: No (should be No)**
Tool creates new records but never deletes data. All operations are additive and reversible through other tools. Changes scanner classification from Yes to No.

---

### 8. get-bet-history

**Read Only: Yes (should be Yes)**
Incorrect scanner classification. Tool only reads from local storage (localBetStorage.get()) and calculates stats without modification. Changes from No to Yes.

**Open World: No (should be No)**
Incorrect scanner classification. Only accesses in-memory local storage, no external APIs or network requests made. Changes from Yes to No.

**Destructive: No (should be No)**
Tool performs read-only operations on bet history. No data deletion, modification, or permanent changes occur. Changes scanner classification from Yes to No.

---

### 9. update-bet-outcome

**Read Only: No**
Correct. Tool modifies existing bet records by updating the outcome field (bet.outcome = outcome) in local storage.

**Open World: No (should be No)**
Incorrect scanner classification. Only modifies local in-memory storage (localBetStorage), no external APIs called. Changes from Yes to No.

**Destructive: No (should be No)**
Tool modifies bet outcomes but changes are reversible. Outcomes can be updated multiple times, no permanent deletion. Changes scanner classification from Yes to No.

---

### 10. get-bankroll

**Read Only: Yes (should be Yes)**
Incorrect scanner classification. Tool only reads bankroll from local storage using getBankroll() without modification. Changes from No to Yes.

**Open World: No (should be No)**
Incorrect scanner classification. Only accesses in-memory local storage (bankrollStorage), no external APIs or network requests. Changes from Yes to No.

**Destructive: No (should be No)**
Tool performs read-only operations on bankroll data. No data deletion, modification, or permanent changes occur. Changes scanner classification from Yes to No.

---

### 11. set-bankroll

**Read Only: No**
Correct. Tool modifies bankroll amount in local storage (record.amount = amount) and adds history entries (record.history.push()).

**Open World: No (should be No)**
Incorrect scanner classification. Only modifies local in-memory storage (bankrollStorage), no external APIs accessed. Changes from Yes to No.

**Destructive: No (should be No)**
Tool maintains complete history (record.history) and bankroll can be reset. No permanent deletion, full audit trail. Changes scanner classification from Yes to No.

---

### 12. adjust-bankroll

**Read Only: No**
Correct. Tool modifies bankroll by adding/subtracting amounts (record.amount = previousAmount + adjustment) and logs changes in history.

**Open World: No (should be No)**
Incorrect scanner classification. Only modifies local in-memory storage (bankrollStorage), no external APIs accessed. Changes from Yes to No.

**Destructive: No (should be No)**
Tool logs all adjustments with timestamps. Changes are reversible, no permanent deletion, full audit trail maintained. Changes scanner classification from Yes to No.

---

### 13. get-bankroll-history

**Read Only: Yes (should be Yes)**
Incorrect scanner classification. Tool only reads bankroll history from local storage (record.history) without modification. Changes from No to Yes.

**Open World: No (should be No)**
Incorrect scanner classification. Only accesses in-memory local storage (bankrollStorage), no external APIs or network requests. Changes from Yes to No.

**Destructive: No (should be No)**
Tool performs read-only operations on history data. No data deletion, modification, or permanent changes occur. Changes scanner classification from Yes to No.

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
