import React, { useEffect, useState } from 'react';
import { AutoTeamLogo } from './TeamLogo';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';
const POLL_MS = 30000;

type Result = 'win' | 'loss' | 'push';
interface Side { name: string; abbr: string; score: number | null; logo?: string }
export interface TopPick {
  id: string; sport: string; pick: string; market: string;
  edge: number | null; probability: number | null; stake: number;
  home: Side; away: Side;
  status: 'scheduled' | 'in_progress' | 'final' | 'unknown';
  statusDetail: string; startTime: string | null;
  result: Result | null; currentGrade: Result | null; profit: number | null;
}
interface TopPicksResponse { day: string | null; picks: TopPick[] }

const money = (n: number) => {
  const abs = Math.abs(n).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
  return n < 0 ? `-${abs}` : n > 0 ? `+${abs}` : abs;
};

function clock(p: TopPick) {
  if (p.status === 'final') return p.statusDetail && /final/i.test(p.statusDetail) ? p.statusDetail : 'Final';
  if (p.status === 'in_progress') return p.statusDetail || 'Live';
  if (p.status === 'scheduled' && p.startTime) {
    const d = new Date(p.startTime);
    const sameDay = d.toDateString() === new Date().toDateString();
    return (sameDay ? '' : d.toLocaleDateString(undefined, { weekday: 'short' }) + ' ') +
      d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  return p.statusDetail || 'Awaiting game';
}

function Badge({ p }: { p: TopPick }) {
  if (p.result) return <span className={'tp-badge tr-chip tr-' + p.result}>{p.result.toUpperCase()}</span>;
  if (p.status === 'in_progress') {
    const g = p.currentGrade;
    return <span className={'tp-badge tp-live' + (g ? ' tp-' + g : '')}>
      <i aria-hidden="true" />{g === 'win' ? 'WINNING' : g === 'loss' ? 'LOSING' : g === 'push' ? 'PUSHING' : 'LIVE'}
    </span>;
  }
  return <span className="tp-badge tp-pending">PENDING</span>;
}

function Row({ side, sport, won }: { side: Side; sport: string; won: boolean }) {
  return <div className={'tp-team' + (won ? ' tp-leader' : '')}>
    <AutoTeamLogo sport={sport} name={side.name} abbr={side.abbr} src={side.logo || null} size={22} />
    <span className="tp-name">{side.name}</span>
    <strong className="tp-score">{side.score ?? '–'}</strong>
  </div>;
}

/**
 * The five highest-edge bets from the latest auto-log run, with live/final
 * scores, the game clock and whether each bet won or lost. Renders `fallback`
 * when there are no auto-logged picks to show.
 */
export function TopEdgePicks({ fallback }: { fallback: React.ReactNode }) {
  const [data, setData] = useState<TopPicksResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = () => {
      fetch(`${BACKEND_URL}/api/track-record/top-picks`, { cache: 'no-store' })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then((d: TopPicksResponse) => {
          if (!active) return;
          if (!d || !Array.isArray(d.picks)) { setFailed(true); return; }
          setData(d); setFailed(false);
          // Keep scores fresh until every game is final.
          if (d.picks.some(p => !p.result)) timer = setTimeout(tick, POLL_MS);
        })
        .catch(() => { if (active) { setFailed(true); timer = setTimeout(tick, POLL_MS * 2); } });
    };
    // Skip polls while the tab is hidden; resume on the next tick.
    const tick = () => { if (document.visibilityState === 'hidden') timer = setTimeout(tick, POLL_MS); else load(); };
    load();
    return () => { active = false; if (timer) clearTimeout(timer); };
  }, []);

  if (!data) return failed ? <>{fallback}</> : <div className="top-picks" aria-busy="true"><p className="tp-note">Loading today's top picks…</p></div>;
  if (!data.picks.length) return <>{fallback}</>;

  const settled = data.picks.filter(p => p.result);
  const wins = settled.filter(p => p.result === 'win').length;
  const losses = settled.filter(p => p.result === 'loss').length;
  const pushes = settled.length - wins - losses;
  const liveCount = data.picks.filter(p => !p.result && p.status === 'in_progress').length;
  const isToday = !!data.day && new Date(data.day + 'T12:00:00').toDateString() === new Date().toDateString();
  const dayLabel = data.day
    ? new Date(data.day + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
    : '';

  return <div className="top-picks">
    <div className="panel-heading">
      <span className="eyebrow"><span className="signal-dot" aria-hidden="true" /> TOP {data.picks.length} EDGES{dayLabel ? ` · ${dayLabel.toUpperCase()}` : ''}</span>
      <span className="result-tag">{liveCount ? `${liveCount} LIVE` : settled.length ? `${wins}-${losses}${pushes ? `-${pushes}` : ''}` : 'AUTO-LOGGED'}</span>
    </div>
    <h3 className="tp-title">{isToday ? "Today's" : 'Latest'} sharpest reads.</h3>
    <p className="tp-note">The model's biggest edges from {isToday ? "today's" : 'the latest'} auto-logged bets, tracked live.</p>
    <ul className="tp-list">
      {data.picks.map(p => {
        const scored = p.home.score !== null && p.away.score !== null;
        return <li key={p.id} className={'tp-card' + (p.result ? ' tp-done tp-' + p.result : '')}>
          <div className="tp-head">
            <span className="tp-sport">{p.sport}</span>
            <span className="tp-pick">{p.pick}</span>
            <Badge p={p} />
          </div>
          <div className="tp-board">
            <div className="tp-teams">
              <Row side={p.away} sport={p.sport} won={scored && (p.away.score as number) > (p.home.score as number)} />
              <Row side={p.home} sport={p.sport} won={scored && (p.home.score as number) > (p.away.score as number)} />
            </div>
            <div className={'tp-clock' + (p.status === 'in_progress' ? ' tp-clock-live' : '')}>{clock(p)}</div>
          </div>
          <div className="tp-meta">
            {p.edge !== null && <span>Edge <b>{p.edge > 0 ? '+' : ''}{p.edge.toFixed(1)}%</b></span>}
            {p.probability !== null && <span>Model <b>{p.probability.toFixed(1)}%</b></span>}
            <span>{p.profit !== null ? <>Result <b className={p.profit > 0 ? 'tr-pos' : p.profit < 0 ? 'tr-neg' : ''}>{money(p.profit)}</b></> : <>Stake <b>{money(p.stake).replace('+', '')}</b></>}</span>
          </div>
        </li>;
      })}
    </ul>
    <p className="tp-foot">Graded automatically from final scores. Not picks to copy — past results don't predict future results.</p>
  </div>;
}

export default TopEdgePicks;
