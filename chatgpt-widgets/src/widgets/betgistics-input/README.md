# Betgistics Input Widget (ChatGPT Widget Builder)

Styled widget layout wired to the `analyze_matchup_and_log_bet` MCP tool. Paste `ui.tsx` into the Widget Builder “Code” tab, set `schema.json` in the “Schema” tab, and use `state.ts` as the Zod equivalent if needed.

## Files
- `ui.tsx` – widget UI (Card + inputs + submit button)
- `schema.json` – JSON schema for widget state
- `state.ts` – Zod schema plus default state values

## Defaults surfaced to users
- Bankroll: `$1,000` (if omitted)
- Odds: `-110` (if omitted)
- Kelly fraction: `0.5` (Half Kelly, if omitted)
- Log bet: enabled by default (shows helper text about DB availability)

## Inputs mapped to the tool
- `userText` → natural-language request
- `bankroll` → optional number
- `americanOdds` → optional odds string/number
- `kellyFraction` → select (`0.25 | 0.5 | 1.0`)
- `userId` → optional handle/user id
- `logBet` → checkbox (default true)
