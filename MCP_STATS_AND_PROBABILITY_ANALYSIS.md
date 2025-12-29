# MCP Server Statistics Sources and Probability Calculations

## Overview
This document details where the MCP server fetches its statistics and the mathematical equations used to calculate betting probabilities.

---

## 📊 Data Sources

### Stats Location
The MCP server fetches **all statistics from local CSV files** stored in:
```
frontend/public/stats/
├── nba/
│   ├── ppg.csv                    # Points per game scored
│   ├── allowed.csv                # Points allowed per game
│   ├── fieldgoal.csv             # Field goal percentage
│   ├── rebound_margin.csv        # Rebound margin per game
│   └── turnover_margin.csv       # Turnover margin per game
└── nfl/
    ├── nfl_ppg.csv               # Points per game scored
    ├── nfl_allowed.csv           # Points allowed per game
    ├── nfl_off_yards.csv         # Offensive yards per game
    ├── nfl_def_yards.csv         # Defensive yards allowed per game
    └── nfl_turnover_diff.csv     # Turnover differential
```

### Data Format
Each CSV file contains team statistics in the following format:
```csv
"team","abbreviation","[stat_name]"
"Denver Nuggets","DEN",125.8
"Oklahoma City Thunder","OKC",121.3
```

### Stats Loader Process
The stats are loaded and cached by `mcp-server/src/utils/statsLoader.ts`:

1. **File Discovery**: Searches multiple possible paths to locate stats directory
2. **CSV Parsing**: Parses CSV files with proper quote handling
3. **Caching**: Stores parsed data in memory (Map objects) for fast lookup
4. **Team Matching**: Uses comprehensive alias system to match team names
   - Supports full names: "Atlanta Hawks"
   - City names: "Atlanta"
   - Nicknames: "Hawks"
   - Abbreviations: "ATL"

---

## 🧮 Probability Calculation - The Walters Protocol

The MCP server uses a sophisticated statistical methodology called the **Walters Protocol** (named after legendary sports bettor Billy Walters) to estimate the probability that a team will cover a given point spread.

### Core Mathematical Components

#### 1. Predicted Margin Calculation

**For Football (NFL/CFB):**
```
Predicted Margin = (Points Component × 50%) + (Yards Component × 30%) + (Turnover Component × 20%)

Where:
  Points Component = (Team Net Points - Opponent Net Points)
  Team Net Points = Team PPG - Team Points Allowed
  Opponent Net Points = Opponent PPG - Opponent Points Allowed

  Yards Component = (Team Net Yards - Opponent Net Yards) / 100
  Team Net Yards = Team Offensive Yards - Team Defensive Yards
  Opponent Net Yards = Opponent Offensive Yards - Opponent Defensive Yards

  Turnover Component = (Team Turnover Diff - Opponent Turnover Diff) × 4
```

**For Basketball (NBA/CBB):**
```
Predicted Margin = (Points × 40%) + (FG% × 30%) + (Rebounds × 20%) + (Turnovers × 10%)

Where:
  Points Component = (Team Net Points - Opponent Net Points)

  FG% Component = (Team FG% - Opponent FG%) × 2

  Rebounds Component = Team Rebound Margin - Opponent Rebound Margin

  Turnover Component = Team Turnover Margin - Opponent Turnover Margin
```

#### 2. Home Field/Court Advantage Adjustment

After calculating the base predicted margin, the system applies venue-based adjustments:

```
If venue == 'home':
    Predicted Margin += Home Advantage
Else if venue == 'away':
    Predicted Margin -= Home Advantage
```

**Home Advantage Constants:**
- **NFL**: 2.5 points
- **CFB**: 3.0 points
- **NBA**: 3.0 points
- **CBB**: 3.5 points

#### 3. Cover Probability Using Normal Distribution

The final probability is calculated using the **Normal Cumulative Distribution Function (CDF)**:

```
Z-Score = (Predicted Margin + Spread) / σ

Cover Probability = Φ(Z) × 100%

Where:
  Φ(Z) = Normal CDF (cumulative probability at Z-score)
  σ = Standard deviation (sport-specific constant)
```

**Standard Deviation (σ) Constants:**
- **NFL**: 13.5 points
- **CFB**: 16.0 points (higher variance in college)
- **NBA**: 11.5 points
- **CBB**: 10.5 points

**Spread Convention:**
- Negative spread = Team A is favored (e.g., -7 means Team A gives 7 points)
- Positive spread = Team A is underdog (e.g., +3.5 means Team A gets 3.5 points)

#### 4. Normal CDF Implementation

The server uses the **Abramowitz-Stegun approximation** for the Normal CDF:

```javascript
function normCdf(x) {
  const a1 = 0.254829592
  const a2 = -0.284496736
  const a3 = 1.421413741
  const a4 = -1.453152027
  const a5 = 1.061405429
  const p = 0.3275911

  const sign = x < 0 ? -1 : 1
  x = Math.abs(x) / Math.sqrt(2)

  const t = 1.0 / (1.0 + p * x)
  const y = 1.0 - (a1*t + a2*t² + a3*t³ + a4*t⁴ + a5*t⁵) * exp(-x²)

  return 0.5 * (1.0 + sign * y)
}
```

---

## 📋 Complete Example Calculation

### Scenario: Hawks vs Heat, NBA Game
- **Venue**: Hawks playing at home
- **Spread**: Hawks -3.5 (Hawks favored by 3.5 points)

**Step 1: Load Team Stats from CSV**
```
Hawks:  PPG=115.2, Allowed=110.5, FG%=46.5, Rebound Margin=+2.1, Turnover Margin=-0.8
Heat:   PPG=112.8, Allowed=108.2, FG%=45.2, Rebound Margin=+1.5, Turnover Margin=+1.2
```

**Step 2: Calculate Predicted Margin**
```
Points Component:
  Hawks Net = 115.2 - 110.5 = 4.7
  Heat Net = 112.8 - 108.2 = 4.6
  Points = (4.7 - 4.6) × 0.4 = 0.04

FG% Component:
  FG% Diff = (46.5 - 45.2) × 2 × 0.3 = 0.78

Rebound Component:
  Rebound = (2.1 - 1.5) × 0.2 = 0.12

Turnover Component:
  Turnover = (-0.8 - 1.2) × 0.1 = -0.20

Base Predicted Margin = 0.04 + 0.78 + 0.12 - 0.20 = 0.74 points
```

**Step 3: Apply Home Court Advantage**
```
Hawks are home, so:
Adjusted Predicted Margin = 0.74 + 3.0 = 3.74 points
```

**Step 4: Calculate Cover Probability**
```
Spread = -3.5 (Hawks give 3.5 points)
σ = 11.5 (NBA standard deviation)

Z = (3.74 + (-3.5)) / 11.5 = 0.24 / 11.5 = 0.0209

Probability = normCdf(0.0209) × 100 ≈ 50.8%
```

**Result**: Hawks have approximately **50.8% probability** of covering the -3.5 spread.

---

## 🔑 Key Implementation Files

1. **`mcp-server/src/utils/statsLoader.ts`** (Lines 1-541)
   - Loads and caches CSV statistics
   - Handles team name matching with aliases
   - Provides lookup functions

2. **`mcp-server/src/utils/calculations.ts`** (Lines 1-395)
   - `normCdf()`: Normal CDF implementation (Lines 179-199)
   - `coverProbability()`: Z-score to probability conversion (Lines 208-214)
   - `predictedMarginFootball()`: Football margin calculation (Lines 281-299)
   - `predictedMarginBasketball()`: Basketball margin calculation (Lines 305-326)
   - `estimateFootballProbability()`: Full NFL/CFB probability (Lines 331-356)
   - `estimateBasketballProbability()`: Full NBA/CBB probability (Lines 361-386)

3. **`mcp-server/src/tools/teamStats.ts`** (Lines 1-323)
   - MCP tool definitions for fetching team stats
   - `get_team_stats`: Fetch single team statistics
   - `get_matchup_stats`: Fetch both teams with venue info

4. **`mcp-server/src/tools/probability.ts`** (Lines 1-382)
   - MCP tool definitions for probability estimation
   - `estimate_football_probability`: Football spread probability
   - `estimate_basketball_probability`: Basketball spread probability

---

## 🎯 Statistical Weights Rationale

### Football (50% Points, 30% Yards, 20% Turnovers)
- **Points** are the ultimate outcome metric
- **Yards** measure offensive/defensive efficiency
- **Turnovers** have high impact but more variance

### Basketball (40% Points, 30% FG%, 20% Rebounds, 10% Turnovers)
- **Points** remain primary but less weighted than football
- **FG%** is critical for basketball success
- **Rebounds** control possessions
- **Turnovers** less impactful per game than in football

---

## 🤖 Alternative: AI-Based Probability

The MCP server also offers AI-powered probability estimation using **Google Gemini AI** as an alternative or complement to statistical calculations:

- **Tool**: `ai_estimate_probability` (in `mcp-server/src/tools/aiProbability.ts`)
- **Use Case**: When detailed stats aren't available or for qualitative factors
- **Requires**: `GEMINI_API_KEY` environment variable
- **Analyzes**: Team names, injuries, weather, recent form, historical matchups

---

## 📚 Summary

**Where Stats Come From:**
- Local CSV files in `frontend/public/stats/nba/` and `frontend/public/stats/nfl/`
- Manually maintained season statistics
- Loaded and cached at server startup

**Probability Equation:**
1. Calculate weighted predicted margin from team statistics
2. Apply home field/court advantage adjustment
3. Convert to Z-score: `Z = (Predicted Margin + Spread) / σ`
4. Apply Normal CDF to get probability: `P = Φ(Z) × 100%`

**Mathematical Foundation:**
- Normal distribution modeling
- Sport-specific variance (σ) constants
- Weighted statistical components
- Venue-based adjustments

This methodology provides **objective, data-driven probability estimates** that can be used with the Kelly Criterion for optimal bet sizing.
