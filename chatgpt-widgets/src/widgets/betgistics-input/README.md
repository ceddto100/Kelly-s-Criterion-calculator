# Betgistics Input Widget (React)

Interactive drop-in React widget that posts matchup details to a Betgistics-style API (`/api/analyze-matchup` by default), then renders probabilities, edge, recommended stake, payout, and logging status.

## Files
- `ui.tsx` – fully self-contained React component (form, loading/error handling, results display, inline sparkle icon)
- `schema.json` – optional JSON schema for the widget state if you need to mirror defaults elsewhere
- `state.ts` – optional Zod schema plus default state values

## Defaults surfaced to users
- Bankroll: `$1,000`
- Odds: `-110`
- Kelly fraction: `0.5` (Half Kelly; input accepts `0.1`–`1`)
- Log bet: enabled by default

## Inputs sent to the API
- `userText` → natural-language note (required)
- `bankroll` → number (parsed from input)
- `americanOdds` → number (parsed from input)
- `kellyFraction` → number between `0.1` and `1`
- `userId` → optional string
- `logBet` → boolean

## Expected API response fields
- `calculatedProbability` (or `coverProbability`)
- `impliedProbability`
- `edge`
- `recommendedStake`
- `expectedPayout` (optional; otherwise derived from odds)
- `americanOdds` (optional; falls back to submitted odds)
- `betId` (optional)
- `teamA` / `teamB` names (optional)
- `pointSpread`/`spread` (optional)
- `logged` (optional)
