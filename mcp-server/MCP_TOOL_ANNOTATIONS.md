# MCP Tool Annotations for Betgistics Server

Complete annotations for all 23 MCP tools with justifications under 200 characters each.

---

## 1. kelly_calculate

**Read Only: Yes**
Performs mathematical calculations using Kelly Criterion formula. No data is modified, only computed results returned.

**Open World: No**
Uses only local mathematical calculations. No external APIs or network requests made during execution.

**Destructive: No**
Pure calculation function. Returns bet sizing recommendations without modifying any persistent state or data.

---

## 2. estimate_football_probability

**Read Only: Yes**
Statistical calculation using Walters Protocol weighted model. Analyzes team stats but modifies no data.

**Open World: No**
All probability calculations performed locally using normal distribution math. No external service calls.

**Destructive: No**
Read-only statistical analysis. Returns probability estimates without altering any stored data.

---

## 3. estimate_basketball_probability

**Read Only: Yes**
Statistical calculation using sport-specific weighted model. Analyzes metrics but writes nothing.

**Open World: No**
Local probability calculations only. No external APIs, databases, or network resources accessed.

**Destructive: No**
Pure statistical analysis. Returns probability percentages without modifying any persistent state.

---

## 4. ai_estimate_probability

**Read Only: Yes**
Queries Gemini AI for probability estimate. Reads from external API but creates no local changes.

**Open World: Yes**
Calls Google Gemini API to generate AI-powered probability estimates. Requires GEMINI_API_KEY.

**Destructive: No**
Only reads from Gemini API. Does not modify local database or create persistent changes.

---

## 5. ai_analyze_matchup

**Read Only: Yes**
Requests matchup analysis from Gemini AI. External read operation with no local modifications.

**Open World: Yes**
Uses Google Gemini API to generate comprehensive matchup analysis. External service dependency.

**Destructive: No**
Fetches analysis from external AI without modifying database or creating side effects.

---

## 6. log_bet

**Read Only: No**
Creates new bet record in MongoDB database. Writes structured betting data to persistent storage.

**Open World: No**
Writes only to local MongoDB instance. No external APIs called, database configured via MONGODB_URI.

**Destructive: No**
Creates new documents in MongoDB. Does not delete or overwrite existing bet records.

---

## 7. get_bet_history

**Read Only: Yes**
Retrieves bet records from MongoDB using filters and pagination. Pure read operation with no writes.

**Open World: No**
Queries local MongoDB database only. No external services or APIs accessed during execution.

**Destructive: No**
Database read operation. Returns bet history without modifying any stored records.

---

## 8. get_bet

**Read Only: Yes**
Fetches single bet document by ID from MongoDB. Read-only database query operation.

**Open World: No**
Accesses local MongoDB instance only. No external network requests or third-party services.

**Destructive: No**
Retrieves bet details without modifying database state or deleting records.

---

## 9. get_pending_bets

**Read Only: Yes**
Queries MongoDB for bets with pending status. Filtered read operation without modifications.

**Open World: No**
Reads from local MongoDB database. No external APIs or open-world resources accessed.

**Destructive: No**
Returns list of pending bets without altering database contents or bet states.

---

## 10. update_bet_outcome

**Read Only: No**
Updates bet result field and calculates payout. Modifies existing MongoDB document permanently.

**Open World: No**
Updates local MongoDB only. No external APIs called, all operations database-internal.

**Destructive: Yes**
Permanently updates bet outcome. Prevents re-updating settled bets, making changes irreversible.

---

## 11. check_auth_status

**Read Only: Yes**
Verifies user exists in MongoDB and returns auth state. Read-only user lookup operation.

**Open World: No**
Queries local MongoDB for user record. No external authentication services or APIs used.

**Destructive: No**
Returns authentication status without modifying user data or account state.

---

## 12. get_user_profile

**Read Only: Yes**
Fetches user profile from MongoDB including stats and bankroll. Pure database read.

**Open World: No**
Accesses local MongoDB database exclusively. No external profile services or APIs contacted.

**Destructive: No**
Retrieves profile information without altering user data or account settings.

---

## 13. register_user

**Read Only: No**
Creates new user or updates existing via findOrCreate pattern. Writes to MongoDB database.

**Open World: No**
Operates on local MongoDB instance only. No external OAuth services called directly.

**Destructive: No**
Uses upsert pattern. Creates users safely without deleting existing data or accounts.

---

## 14. get_user_stats

**Read Only: Yes**
Aggregates betting performance from MongoDB. Computes statistics but modifies no records.

**Open World: No**
Runs aggregation pipeline on local MongoDB. All calculations performed database-internal.

**Destructive: No**
Statistical aggregation only. Returns calculated metrics without changing bet records.

---

## 15. convert_odds

**Read Only: Yes**
Converts between American, decimal, fractional odds formats. Pure mathematical conversion.

**Open World: No**
Local odds conversion calculations. No external services, APIs, or network requests.

**Destructive: No**
Returns converted odds values without modifying any persistent data or state.

---

## 16. calculate_vig

**Read Only: Yes**
Calculates bookmaker margin from two-sided odds. Mathematical calculation with no writes.

**Open World: No**
Local vigorish calculation using implied probability formulas. No external dependencies.

**Destructive: No**
Returns vig percentage and fair probabilities without altering any stored data.

---

## 17. calculate_implied_probability

**Read Only: Yes**
Derives probability percentage from American odds. Pure mathematical conversion operation.

**Open World: No**
Local calculation converting odds to probability. No external APIs or services used.

**Destructive: No**
Returns probability and break-even rate without modifying any persistent state.

---

## 18. get_bankroll

**Read Only: Yes**
Retrieves current bankroll from user document in MongoDB. Read-only database query.

**Open World: No**
Queries local MongoDB for bankroll field. No external financial APIs or services.

**Destructive: No**
Returns bankroll amount without modifying user account or financial data.

---

## 19. set_bankroll

**Read Only: No**
Replaces user's bankroll with absolute value. Updates MongoDB user document directly.

**Open World: No**
Writes to local MongoDB database only. No external financial services or APIs.

**Destructive: Yes**
Overwrites previous bankroll completely. Cannot recover old value after replacement.

---

## 20. adjust_bankroll

**Read Only: No**
Increments or decrements bankroll by specified amount. Modifies user's MongoDB record.

**Open World: No**
Updates local MongoDB database. All bankroll adjustments stored locally with audit reasons.

**Destructive: No**
Incremental adjustment with reason tracking. Changes are logged, creating audit trail.

---

## 21. analyze_matchup_and_log_bet

**Read Only: No**
Orchestrates full workflow including probability, Kelly calc, and optional bet logging to database.

**Open World: No**
Uses local calculations and MongoDB. Reads team stats from local CSV files internally.

**Destructive: No**
Creates new bet records when logging enabled. Does not delete or overwrite existing data.

---

## 22. get_team_stats

**Read Only: Yes**
Loads team statistics from local CSV files in frontend/public/stats directory.

**Open World: No**
Reads from local filesystem CSV files. No external sports data APIs or services.

**Destructive: No**
File read operation only. Returns stats without modifying CSV files or database.

---

## 23. get_matchup_stats

**Read Only: Yes**
Fetches stats for both teams from CSV files. Formats data for probability calculators.

**Open World: No**
Reads from local CSV files and calculates home advantage. No external API calls.

**Destructive: No**
Returns formatted matchup statistics without altering files or database records.

---

## Summary Statistics

- **Read Only = Yes**: 17 tools
- **Read Only = No**: 6 tools

- **Open World = Yes**: 2 tools (ai_estimate_probability, ai_analyze_matchup)
- **Open World = No**: 21 tools

- **Destructive = Yes**: 2 tools (update_bet_outcome, set_bankroll)
- **Destructive = No**: 21 tools

---

## Notes on Annotation Decisions

### Read Only Justification
Tools are marked Read Only = No only when they write to MongoDB (log_bet, register_user, adjust_bankroll, set_bankroll, update_bet_outcome) or orchestrate such operations (analyze_matchup_and_log_bet).

### Open World Justification
Only AI tools accessing Google Gemini API are marked Open World = Yes. MongoDB is considered local infrastructure (configured via connection string), not open world. CSV files are local filesystem resources.

### Destructive Justification
Only tools that irreversibly modify data are marked Destructive = Yes:
- update_bet_outcome: Prevents re-updating settled bets
- set_bankroll: Completely replaces previous value without history

Tools with audit trails (adjust_bankroll) or safe upsert patterns (register_user, log_bet) are not destructive.
