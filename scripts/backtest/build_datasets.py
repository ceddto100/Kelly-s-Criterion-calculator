"""Build the historical datasets used to calibrate and validate the models.

Everything here is pre-game information plus final results:
  * stats snapshots the updater committed to git (what the board saw each day);
  * walk-forward season-to-date stats rebuilt from box scores;
  * final scores and closing lines from public sources:
      - NFL: nflverse games.csv (scores, closing spread/total), 2010-present
      - NBA: sportsdataverse hoopR-nba-raw (scores + the DraftKings line ESPN
        stored with each game, team box totals for pace)
      - NHL: sportsdataverse fastRhockey-nhl-raw (final scores incl. OT/SO)
  * the graded CFB Walters pick log in frontend/public/stats/cfb.

Usage (from the repo root; needs pandas, pyarrow, numpy):
    python3 scripts/backtest/build_datasets.py [--cache scripts/backtest/.cache]
Then run validate.ts (see README.md). Downloads are cached; NBA per-game files
are ~1 MB each and only the line/box fields are kept.
"""
import argparse, collections, concurrent.futures as cf, csv, io, json, os, subprocess, urllib.request
from datetime import datetime, timezone

import numpy as np
import pandas as pd

RAW = 'https://raw.githubusercontent.com'
NFLVERSE = f'{RAW}/nflverse/nfldata/master/data/games.csv'
NBA_SCHED = f'{RAW}/sportsdataverse/hoopR-nba-raw/main/nba/schedules/parquet/nba_schedule_{{season}}.parquet'
NBA_GAME = f'{RAW}/sportsdataverse/hoopR-nba-raw/main/nba/json/final/{{gid}}.json'
NHL_SCHED = f'{RAW}/sportsdataverse/fastRhockey-nhl-raw/main/nhl/schedules/parquet/nhl_schedule_{{season}}.parquet'
SNAPSHOT_FILES = {
    'NBA': {'ppg': 'ppg', 'allowed': 'allowed', 'pace': 'pace', 'off_rtg': 'off_rtg', 'def_rtg': 'def_rtg'},
    'NFL': {'nfl_ppg': 'ppg', 'nfl_allowed': 'allowed', 'nfl_off_yards': 'off_yards', 'nfl_def_yards': 'def_yards', 'nfl_turnover_diff': 'turnover_diff'},
    'NHL': {'nhl_xgf60': 'xgf60', 'nhl_xga60': 'xga60', 'nhl_gsax60': 'gsax60', 'nhl_hdcf60': 'hdcf60', 'nhl_pp': 'pp', 'nhl_pk': 'pk', 'nhl_times_shorthanded': 'times_shorthanded'},
}


def download(url, path):
    if not os.path.exists(path):
        with urllib.request.urlopen(url, timeout=120) as r, open(path, 'wb') as f:
            f.write(r.read())
    return path


def git(*args):
    return subprocess.run(['git', *args], capture_output=True, text=True, check=False).stdout


def snapshots(sport):
    """Every committed snapshot of a sport's CSVs: [(utc time, {ABBR: {metric: value}})]."""
    folder = f'frontend/public/stats/{sport.lower()}'
    out = []
    for line in git('log', '--format=%H %cI', '--', folder).splitlines():
        sha, ts = line.split(' ', 1)
        teams = {}
        for fname, metric in SNAPSHOT_FILES[sport].items():
            res = subprocess.run(['git', 'show', f'{sha}:{folder}/{fname}.csv'], capture_output=True, text=True)
            if res.returncode:
                continue
            for row in csv.DictReader(io.StringIO(res.stdout)):
                ab = (row.get('abbreviation') or '').upper()
                try:
                    teams.setdefault('UTA' if ab == 'UTAH' and sport == 'NHL' else ab, {})[metric] = float(row[metric])
                except (KeyError, ValueError):
                    pass
        if teams:
            out.append((datetime.fromisoformat(ts), teams))
    return sorted(out, key=lambda s: s[0])


def nba_lines(season, cache):
    """Closing line + team box totals for every completed regular-season game (cached JSONL)."""
    sched = pd.read_parquet(download(NBA_SCHED.format(season=season), f'{cache}/nba_schedule_{season}.parquet'))
    sched = sched[(sched.season_type == 2) & (sched.status_type_completed == True)]
    path = f'{cache}/nba_lines_{season}.jsonl'
    done = {}
    if os.path.exists(path):
        for line in open(path):
            r = json.loads(line)
            if 'error' not in r:
                done[r['game_id']] = r
    todo = [str(g) for g in sched.game_id if str(g) not in done]

    def stat(stats, name):
        return next((s.get('displayValue') for s in stats if s.get('name') == name), None)

    def fetch(gid):
        try:
            with urllib.request.urlopen(NBA_GAME.format(gid=gid), timeout=120) as r:
                d = json.loads(r.read())
        except Exception as e:  # keep going; a re-run retries
            return {'game_id': gid, 'error': str(e)[:200]}
        lines = [{'spread': p.get('spread'), 'overUnder': p.get('overUnder')} for p in d.get('pickcenter') or []]
        box = {}
        for t in (d.get('boxscore') or {}).get('teams') or []:
            st = t.get('statistics') or []
            box[(t.get('team') or {}).get('abbreviation')] = {
                k: stat(st, k) for k in ('fieldGoalsMade-fieldGoalsAttempted', 'freeThrowsMade-freeThrowsAttempted', 'offensiveRebounds', 'totalTurnovers', 'turnovers')}
        return {'game_id': gid, 'lines': lines, 'box': box}

    with open(path, 'a') as f, cf.ThreadPoolExecutor(max_workers=6) as ex:
        for res in ex.map(fetch, todo):
            f.write(json.dumps(res) + '\n')
            if 'error' not in res:
                done[res['game_id']] = res
    return sched, done


def possessions(b):
    try:
        fga = float(b['fieldGoalsMade-fieldGoalsAttempted'].split('-')[1])
        fta = float(b['freeThrowsMade-freeThrowsAttempted'].split('-')[1])
        return fga - float(b['offensiveRebounds']) + float(b.get('totalTurnovers') or b.get('turnovers')) + 0.44 * fta
    except Exception:
        return None


def build_nba(seasons, cache):
    rows = []
    for season in seasons:
        sched, lines = nba_lines(season, cache)
        sched = sched.assign(t=pd.to_datetime(sched.date, utc=True)).sort_values('t')
        acc = collections.defaultdict(lambda: dict(n=0, pf=0., pa=0., poss=0., oposs=0.))
        for g in sched.itertuples():
            gid, h, a = str(g.game_id), g.home_abbreviation, g.away_abbreviation
            hs, as_ = float(g.home_score), float(g.away_score)
            info = lines.get(gid, {})
            spread = next((float(l['spread']) for l in info.get('lines', []) if l.get('spread') is not None), None)
            H, A = acc[h], acc[a]
            if H['n'] and A['n'] and spread is not None:
                def st(X):
                    return dict(ppg=X['pf'] / X['n'], allowed=X['pa'] / X['n'], pace=(X['poss'] + X['oposs']) / (2 * X['n']))
                rows.append(dict(season=season, home=h, away=a, result=hs - as_, spread=spread, neutral=bool(g.neutral_site),
                                 n=(H['n'] + A['n']) / 2, h=st(H), a=st(A)))
            box = info.get('box') or {}
            ph = possessions(box.get(h, {})) if h in box else None
            pa = possessions(box.get(a, {})) if a in box else None
            if ph is None or pa is None:
                ph = pa = 99.0
            for me, pf, pagst, mp, op in ((h, hs, as_, ph, pa), (a, as_, hs, pa, ph)):
                X = acc[me]
                X['n'] += 1; X['pf'] += pf; X['pa'] += pagst; X['poss'] += mp; X['oposs'] += op
    return rows


def build_nfl(cache, first_season=2010):
    games = list(csv.DictReader(open(download(NFLVERSE, f'{cache}/nfl_games.csv'))))
    games = [r for r in games if r['result'] and r['spread_line'] and int(r['season']) >= first_season]
    games.sort(key=lambda r: (int(r['season']), r['gameday'], r['gametime']))
    # yardage per game from the committed ESPN box-score caches, keyed by ESPN abbreviation
    espn = {'LA': 'LAR', 'WAS': 'WSH'}
    ylog = collections.defaultdict(list)
    for path in sorted(p for p in os.listdir('backend/data/nfl') if p.startswith('boxscores_')):
        season = int(path.split('_')[1].split('.')[0])
        for g in json.load(open(f'backend/data/nfl/{path}'))['games'].values():
            t = list(g['teams'])
            for me, op in ((t[0], t[1]), (t[1], t[0])):
                ylog[(season, me)].append((g['week'], g['teams'][me]['yds'], g['teams'][op]['yds']))
    rows = []
    for season in sorted({int(r['season']) for r in games}):
        acc = collections.defaultdict(lambda: [0, 0.0, 0.0])
        for r in (g for g in games if int(g['season']) == season):
            h, a = r['home_team'], r['away_team']
            if r['game_type'] == 'REG' and acc[h][0] and acc[a][0]:
                row = dict(season=season, week=int(r['week']), result=float(r['result']), spread=-float(r['spread_line']),
                           neutral=r['location'] == 'Neutral', n=(acc[h][0] + acc[a][0]) / 2,
                           h=dict(ppg=acc[h][1] / acc[h][0], allowed=acc[h][2] / acc[h][0]),
                           a=dict(ppg=acc[a][1] / acc[a][0], allowed=acc[a][2] / acc[a][0]))
                wk = int(r['week'])
                yh = [x for x in ylog[(season, espn.get(h, h))] if x[0] < wk]
                ya = [x for x in ylog[(season, espn.get(a, a))] if x[0] < wk]
                if yh and ya:
                    row['h'].update(off=float(np.mean([x[1] for x in yh])), dfn=float(np.mean([x[2] for x in yh])))
                    row['a'].update(off=float(np.mean([x[1] for x in ya])), dfn=float(np.mean([x[2] for x in ya])))
                rows.append(row)
            hs, as_ = float(r['home_score']), float(r['away_score'])
            acc[h][0] += 1; acc[h][1] += hs; acc[h][2] += as_
            acc[a][0] += 1; acc[a][1] += as_; acc[a][2] += hs
    return rows


def build_nhl(seasons, cache):
    snaps = snapshots('NHL')
    rows = []
    for season in seasons:
        sched = pd.read_parquet(download(NHL_SCHED.format(season=season), f'{cache}/nhl_schedule_{season}.parquet'))
        sched = sched[(sched.game_type == 'R') & sched.game_state.isin(['OFF', 'FINAL'])]
        for g in sched.itertuples():
            t = datetime.fromisoformat(g.game_time.replace('Z', '+00:00'))
            prior = [s for s in snaps if s[0] < t]
            if not prior or (t - prior[-1][0]).days > 4:
                continue  # only games with a fresh pre-game snapshot
            teams = prior[-1][1]
            h, a = teams.get(g.home_team_abbr), teams.get(g.away_team_abbr)
            if not h or not a or not all(k in h and k in a for k in ('xgf60', 'xga60', 'gsax60')):
                continue
            rows.append(dict(gid=str(g.game_id), home=g.home_team_abbr, away=g.away_team_abbr, date=g.game_date,
                             total=float(g.home_score) + float(g.away_score), h=h, a=a))
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--cache', default='scripts/backtest/.cache')
    ap.add_argument('--nba-seasons', default='2026,2027', help='ESPN season years (2027 = 2026-27)')
    ap.add_argument('--nhl-seasons', default='2026,2027')
    args = ap.parse_args()
    os.makedirs(args.cache, exist_ok=True)
    out = {
        'nba': build_nba([int(s) for s in args.nba_seasons.split(',')], args.cache),
        'nfl': build_nfl(args.cache),
        'nhl': build_nhl([int(s) for s in args.nhl_seasons.split(',')], args.cache),
        'cfb': [dict(p=float(r['probability']), win=r['outcome'] == 'win')
                for r in csv.DictReader(open('frontend/public/stats/cfb/cfb_predictions.csv')) if r['outcome'] in ('win', 'loss')],
        'builtAt': datetime.now(timezone.utc).isoformat(),
    }
    json.dump(out, open(f'{args.cache}/backtest.json', 'w'))
    print({k: len(v) for k, v in out.items() if isinstance(v, list)}, '->', f'{args.cache}/backtest.json')


if __name__ == '__main__':
    main()
