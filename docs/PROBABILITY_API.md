# Probability Estimation API Documentation

## Overview

The probability estimation endpoints calculate the probability of covering a point spread for NBA and NFL games. These tools are designed to be called by LLM interfaces and support flexible input formats.

---

## `probability-estimate-basketball`

### Purpose
Estimate the probability of covering a point spread for NBA basketball games using statistical analysis.

### Canonical Input Schema

```json
{
  "team_favorite": "Houston Rockets",
  "team_underdog": "Los Angeles Lakers",
  "spread": -3.5
}
```

### Field Aliases

The endpoint supports multiple field name formats for flexibility:

| Canonical Field | Aliases | Description |
|----------------|---------|-------------|
| `team_favorite` | `favorite_team`, `favorite`, `fav` | The favored team (expected to win) |
| `team_underdog` | `underdog_team`, `underdog`, `dog` | The underdog team (expected to lose) |

### Input Field Details

**`team_favorite`** (string, required)
- Name of the favored team
- Accepts: Full name ("Houston Rockets"), city name ("Rockets"), or abbreviation ("HOU")
- The favorite is the team expected to win

**`team_underdog`** (string, required)
- Name of the underdog team
- Accepts: Full name ("Los Angeles Lakers"), city name ("Lakers"), or abbreviation ("LAL")
- The underdog is the team expected to lose

**`spread`** (number, required)
- Point spread from the favorite's perspective
- Must be negative (e.g., -3.5 means favorite must win by more than 3.5 points to cover)
- Valid range: -50 to -0.5

### Output Schema

```json
{
  "favorite_cover_probability": 0.57,
  "underdog_cover_probability": 0.43,
  "inputs": {
    "team_favorite": "Rockets",
    "team_underdog": "Lakers",
    "spread": -3.5
  },
  "normalized": {
    "team_favorite": "Houston Rockets",
    "team_underdog": "Los Angeles Lakers"
  }
}
```

**Output Fields:**
- `favorite_cover_probability` (number): Probability (0-1) that the favorite covers the spread
- `underdog_cover_probability` (number): Probability (0-1) that the underdog covers the spread
- `inputs` (object): Original input values as provided by the user
- `normalized` (object): Canonical team names from the database

**Guarantees:**
- `favorite_cover_probability + underdog_cover_probability == 1.0` (within 1e-6)
- All probabilities are between 0 and 1

### Example Usage

**Using canonical fields:**
```json
{
  "team_favorite": "Houston Rockets",
  "team_underdog": "Los Angeles Lakers",
  "spread": -3.5
}
```

**Using abbreviations:**
```json
{
  "team_favorite": "HOU",
  "team_underdog": "LAL",
  "spread": -3.5
}
```

**Using aliases:**
```json
{
  "favorite_team": "Rockets",
  "underdog_team": "Lakers",
  "spread": -3.5
}
```

**Using short aliases:**
```json
{
  "fav": "HOU",
  "dog": "LAL",
  "spread": -3.5
}
```

### Error Responses

**Missing Required Fields:**
```json
{
  "error": "invalid_input",
  "message": "Missing required field(s): team_favorite (or favorite_team, favorite, fav), spread",
  "missing_fields": [
    "team_favorite (or favorite_team, favorite, fav)",
    "spread"
  ]
}
```

**Unknown Team Name:**
```json
{
  "error": "invalid_input",
  "message": "Unknown team name: \"Cowboyz\"",
  "team_searched": "Cowboyz",
  "suggestions": [
    "Dallas Cowboys"
  ]
}
```

**Invalid Spread:**
```json
{
  "error": "invalid_input",
  "message": "Spread must be negative (from favorite's perspective)",
  "hint": "The favorite is expected to win, so the spread should be negative (e.g., -3.5)"
}
```

---

## `probability-estimate-football`

### Purpose
Estimate the probability of covering a point spread for NFL football games using statistical analysis.

### Canonical Input Schema

```json
{
  "team_favorite": "Dallas Cowboys",
  "team_underdog": "New York Giants",
  "spread": -6.5
}
```

### Field Aliases

Same as basketball endpoint:

| Canonical Field | Aliases | Description |
|----------------|---------|-------------|
| `team_favorite` | `favorite_team`, `favorite`, `fav` | The favored team (expected to win) |
| `team_underdog` | `underdog_team`, `underdog`, `dog` | The underdog team (expected to lose) |

### Input Field Details

**`team_favorite`** (string, required)
- Name of the favored team
- Accepts: Full name ("Dallas Cowboys"), city name ("Cowboys"), or abbreviation ("DAL")
- The favorite is the team expected to win

**`team_underdog`** (string, required)
- Name of the underdog team
- Accepts: Full name ("New York Giants"), city name ("Giants"), or abbreviation ("NYG")
- The underdog is the team expected to lose

**`spread`** (number, required)
- Point spread from the favorite's perspective
- Must be negative (e.g., -6.5 means favorite must win by more than 6.5 points to cover)
- Valid range: -50 to -0.5

### Output Schema

Same as basketball endpoint - see above.

### Example Usage

**Using canonical fields:**
```json
{
  "team_favorite": "Dallas Cowboys",
  "team_underdog": "New York Giants",
  "spread": -6.5
}
```

**Using abbreviations:**
```json
{
  "team_favorite": "DAL",
  "team_underdog": "NYG",
  "spread": -6.5
}
```

**Using aliases:**
```json
{
  "favorite": "Philadelphia Eagles",
  "underdog": "Washington Commanders",
  "spread": -7.0
}
```

### Error Responses

Same as basketball endpoint - see above.

---

## Team Name Resolution

### Supported Formats

Both endpoints support three formats for team names:

1. **Full Name**: "Houston Rockets", "Dallas Cowboys"
2. **City/Team Name**: "Rockets", "Cowboys"
3. **Abbreviation**: "HOU", "DAL", "KC", "NYG"

### Team Name Matching

The system performs fuzzy matching in the following order:

1. **Exact match** on team name
2. **Exact match** on abbreviation
3. **Partial match** on team name (case-insensitive, includes)
4. **Alias match** using predefined team aliases

### Suggestions on Error

If a team name is not found, the system provides up to 5 suggestions based on partial matching:

```json
{
  "error": "invalid_input",
  "message": "Unknown team name: \"Laker\"",
  "team_searched": "Laker",
  "suggestions": [
    "Los Angeles Lakers"
  ]
}
```

---

## Validation Rules

### Required Fields

After normalization (applying aliases), the following fields must be present and non-empty:

- `team_favorite` (or any alias)
- `team_underdog` (or any alias)
- `spread`

### Spread Validation

- **Must be a number**
- **Must be negative** (from favorite's perspective)
- **Valid range**: -50 to -0.5
- Example valid values: -3.5, -6.5, -10, -14.5
- Example invalid values: 3.5, 0, -60

### Team Validation

- Team names must exist in the database
- If not found, system provides suggestions
- Team stats must include at minimum: points per game and points allowed

---

## Integration Notes

### For LLM Interfaces

- The endpoint accepts flexible input formats to accommodate natural language variations
- All field aliases are equivalent - use whichever feels most natural
- Error messages include all possible field names to help users correct mistakes
- Team name suggestions help users find the correct team when typos occur

### Backward Compatibility

- The endpoint is fully backward compatible with existing callers
- Canonical field names (`team_favorite`, `team_underdog`) continue to work as before
- The addition of `inputs` and `normalized` in the output is additive (doesn't break existing parsers)
- All probability calculations remain unchanged

### Usage with Kelly Criterion Calculator

After obtaining probabilities, pass them to `kelly-calculate` tool:

```javascript
// Step 1: Get probability
const probResult = await callTool('probability-estimate-basketball', {
  team_favorite: 'Rockets',
  team_underdog: 'Lakers',
  spread: -3.5
});

// Step 2: Calculate bet size with Kelly Criterion
const kellyResult = await callTool('kelly-calculate', {
  probability: probResult.favorite_cover_probability,
  odds: -110,  // American odds
  bankroll: 1000,
  fraction: 0.25  // Quarter Kelly
});
```

---

## Technical Implementation

### Probability Model

**Basketball:**
- Uses net rating differential, field goal percentage, rebound margin, and turnover margin
- Standard deviation (σ) = 12.0 points
- Converts predicted margin to probability using normal CDF

**Football:**
- Uses points differential, yards differential, and turnover differential
- Standard deviation (σ) = 13.5 points
- Converts predicted margin to probability using normal CDF

### Data Sources

- NBA stats from CSV files (`ppg.csv`, `allowed.csv`, `fieldgoal.csv`, `rebound_margin.csv`, `turnover_margin.csv`)
- NFL stats from CSV files (`nfl_ppg.csv`, `nfl_allowed.csv`, `nfl_off_yards.csv`, `nfl_def_yards.csv`, `nfl_turnover_diff.csv`)
- Team stats loaded automatically based on team name lookup

### Performance

- All calculations are local (no external API calls)
- CSV files are loaded on-demand and parsed in-memory
- Team lookup includes caching via module-level imports
- Typical response time: <100ms

---

## Change Log

### v2.1.0 (2025-12-24)

**Added:**
- Field name alias support (`favorite_team`, `favorite`, `fav`, `underdog_team`, `underdog`, `dog`)
- Team name suggestions when unknown team is provided
- `inputs` and `normalized` fields in output schema
- Comprehensive error messages with all possible field names

**Fixed:**
- Validation now occurs after argument normalization (prevents false positives)
- Probabilities now guaranteed to sum to exactly 1.0

**Improved:**
- Error messages now include field aliases for better user guidance
- Team lookup now includes abbreviation exact matching for faster resolution
