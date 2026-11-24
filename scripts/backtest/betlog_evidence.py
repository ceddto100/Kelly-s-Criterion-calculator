"""Summarize graded bet logs into per-sport evidence for calibrate.ts.

Input: a JSON export of graded `betlogs` documents (a list, or {"documents": [...]}),
each with the stated probability and the result. Accepted field names:
  sport:        matchup.sport | s          (basketball / football / hockey)
  probability:  estimation.calculatedProbability | p   (percent)
  result:       outcome.result | r         (win / loss; pushes and pending are skipped)

For each sport it fits w in  logit(P(win)) = w × logit(stated probability)  by
maximum likelihood: w = 1 means the stated probabilities were right, 0 means they
carried no information, between means they were overconfident. Only these summary
numbers are written (no individual bets), to scripts/backtest/betlog_evidence.json.

Usage: python3 scripts/backtest/betlog_evidence.py EXPORT.json [--out scripts/backtest/betlog_evidence.json]
"""
import argparse, json, math

SPORT = {'basketball': 'NBA', 'nba': 'NBA', 'football': 'NFL', 'nfl': 'NFL', 'hockey': 'NHL', 'nhl': 'NHL'}


def get(doc, dotted, short):
    if short in doc:
        return doc[short]
    cur = doc
    for k in dotted.split('.'):
        if not isinstance(cur, dict) or k not in cur:
            return None
        cur = cur[k]
    return cur


def fit(rows):
    z = [math.log(p / (1 - p)) for p, _ in rows]
    y = [w for _, w in rows]

    def ll(w):
        return sum(-math.log1p(math.exp(-w * zi)) if yi else -math.log1p(math.exp(w * zi)) for zi, yi in zip(z, y))
    w_hat = max((i / 1000 for i in range(-3000, 3001)), key=ll)
    h = 0.01
    d2 = (ll(w_hat + h) - 2 * ll(w_hat) + ll(w_hat - h)) / h ** 2
    return w_hat, (math.sqrt(-1 / d2) if d2 < 0 else float('inf'))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('export')
    ap.add_argument('--out', default='scripts/backtest/betlog_evidence.json')
    args = ap.parse_args()
    data = json.load(open(args.export))
    docs = data['documents'] if isinstance(data, dict) else data
    by = {}
    for d in docs:
        sport = SPORT.get(str(get(d, 'matchup.sport', 's')).lower())
        p, r = get(d, 'estimation.calculatedProbability', 'p'), get(d, 'outcome.result', 'r')
        if sport is None or p is None or r not in ('win', 'loss'):
            continue
        p = min(0.99, max(0.01, float(p) / 100))
        by.setdefault(sport, []).append((p, r == 'win'))
    out = {}
    for sport, rows in sorted(by.items()):
        w_hat, se = fit(rows)
        wins = sum(w for _, w in rows)
        out[sport] = {'weight': round(w_hat, 3), 'se': round(se, 3), 'bets': len(rows), 'wins': wins,
                      'losses': len(rows) - wins, 'statedMean': round(100 * sum(p for p, _ in rows) / len(rows), 1)}
        print(f"{sport}: {wins}-{len(rows) - wins}, stated {out[sport]['statedMean']}%, weight {w_hat:+.3f} ± {se:.3f}")
    json.dump({'source': 'graded betlogs (previous prediction module)', 'sports': out}, open(args.out, 'w'), indent=2)
    print('wrote', args.out)


if __name__ == '__main__':
    main()
