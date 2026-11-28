import { useEffect, useState } from 'react';
import { AutoTeamLogo } from './TeamLogo';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';
const POLL_MS = 60000;
const SHOW = 6;

type Result = 'win' | 'loss' | 'push';
interface Side { name: string; score: number | null; logo?: string }
interface Lean {
  id: string; sport: string; market: 'spread' | 'total'; pick: string;
  modelPct: number; marketPct: number; gap: number;
  odds: number | null; breakEven: number | null; priceFromBook: boolean | null;
  home: Side; away: Side;
  status: 'scheduled' | 'in_progress' | 'final' | 'postponed' | 'unknown';
  statusDetail: string; startTime: string | null;
  result: Result | null; currentGrade: Result | null;
}
interface Record_ { wins: number; losses: number; pushes: number; winRate: number | null; since: string | null;
  priced: { leans: number; units: number; breakEven: number } | null;
  bySport: { sport: string; wins: number; losses: number; pushes: number; winRate: number | null }[] }
interface LeansResponse { day: string | null; leans: Lean[]; record: Record_ }

const fmtOdds = (o: number) => (o > 0 ? `+${o}` : `${o}`);
const wlp = (r: { wins: number; losses: number; pushes: number }) => `${r.wins}-${r.losses}${r.pushes ? `-${r.pushes}` : ''}`;
const dayLabel = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

function clock(l: Lean) {
  if (l.status === 'final') return 'Final';
  if (l.status === 'in_progress') return l.statusDetail || 'Live';
  if (l.status === 'scheduled' && l.startTime) return new Date(l.startTime).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return l.statusDetail || '—';
}

function Badge({ l }: { l: Lean }) {
  if (l.result) return <span className={'tp-badge tr-chip tr-' + l.result}>{l.result.toUpperCase()}</span>;
  if (l.status === 'in_progress') {
    const g = l.currentGrade;
    return <span className={'tp-badge tp-live' + (g ? ' tp-' + g : '')}><i aria-hidden="true" />{g === 'win' ? 'WINNING' : g === 'loss' ? 'LOSING' : 'LIVE'}</span>;
  }
  return <span className="tp-badge tp-pending">PENDING</span>;
}

/**
 * The model's lean on every game with a real line, tracked and graded but
 * never bet. Separate from the Founder's Track Record, which counts only real
 * bets: this is where the model earns (or loses) the right to make picks.
 */
export function ModelLeans() {
  const [data, setData] = useState<LeansResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [all, setAll] = useState(false);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = () => {
      fetch(`${BACKEND_URL}/api/track-record/leans`, { cache: 'no-store' })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then((d: LeansResponse) => {
          if (!active) return;
          if (!d || !Array.isArray(d.leans)) { setFailed(true); return; }
          setData(d); setFailed(false);
          if (d.leans.some(l => !l.result)) timer = setTimeout(tick, POLL_MS);
        })
        .catch(() => { if (active) { setFailed(true); timer = setTimeout(tick, POLL_MS * 2); } });
    };
    const tick = () => { if (document.visibilityState === 'hidden') timer = setTimeout(tick, POLL_MS); else load(); };
    load();
    return () => { active = false; if (timer) clearTimeout(timer); };
  }, []);

  const header = <div className="panel-heading">
    <h2 className="tr-title"><span className="signal-dot ml-dot" aria-hidden="true" />Model Leans</h2>
    <span className="result-tag ml-tag">TRACKING · NOT BETS</span>
  </div>;

  if (!data) return <section className="model-leans" aria-busy={!failed}>{header}<p className="tr-explain">{failed ? "Couldn't load the model's leans right now." : 'Loading leans…'}</p></section>;

  const { record, leans, day } = data;
  const shown = all ? leans : leans.slice(0, SHOW);
  const isToday = !!day && new Date(day + 'T12:00:00').toDateString() === new Date().toDateString();

  return <section className="model-leans" aria-label="Model leans">
    {header}
    <p className="tr-explain">Every game with a real sportsbook line gets a lean: the side the model alone prefers, next to the market's own fair probability. Nothing is staked and these don't count in the Founder's record. They're graded from final scores so you can see whether the model actually beats the line before it's trusted to make picks.</p>

    <div className="ml-record">
      <div className="ml-total"><small>Lean record vs. the line</small><strong>{record.wins + record.losses + record.pushes ? wlp(record) : '—'}</strong>
        <span>{record.winRate !== null ? `${record.winRate}% won` : 'First grades land after tonight’s games'}
          {record.priced ? ` · at their real prices these needed ${record.priced.breakEven}% to break even (${record.priced.units > 0 ? '+' : ''}${record.priced.units}u over ${record.priced.leans} priced leans)` : ''}
          {record.since ? ` · since ${dayLabel(record.since)}` : ''}</span></div>
      {record.bySport.length > 0 && <div className="tr-sports">{record.bySport.map(s => <span key={s.sport}>{s.sport}<i>{wlp(s)}</i></span>)}</div>}
    </div>

    {leans.length === 0 ? <p className="tr-empty">No lined games on the board yet. Leans appear once sportsbooks post spreads and totals.</p> : <>
      <h3 className="ml-sub">{isToday ? "Today's" : day ? dayLabel(day) : 'Latest'} leans <small>{leans.length} games · biggest disagreement with the market first</small></h3>
      <ul className="ml-list">
        {shown.map(l => {
          const scored = l.home.score !== null && l.away.score !== null;
          return <li key={l.id} className={'tp-card' + (l.result ? ' tp-done tp-' + l.result : '')}>
            <div className="tp-head">
              <span className="tp-sport">{l.sport}</span>
              <span className="tp-pick">{l.pick}</span>
              <Badge l={l} />
            </div>
            <div className="tp-board">
              <div className="tp-teams">
                {[l.away, l.home].map((s, i) => <div key={i} className={'tp-team' + (scored && s.score! > (i ? l.away.score! : l.home.score!) ? ' tp-leader' : '')}>
                  <AutoTeamLogo sport={l.sport} name={s.name} abbr="" src={s.logo || null} size={20} />
                  <span className="tp-name">{s.name}</span>
                  <strong className="tp-score">{s.score ?? '–'}</strong>
                </div>)}
              </div>
              <div className={'tp-clock' + (l.status === 'in_progress' ? ' tp-clock-live' : '')}>{clock(l)}</div>
            </div>
            <div className="ml-bar" aria-label={`Model ${l.modelPct}%, market ${l.marketPct}%`}>
              <span className="ml-market" style={{ left: `${l.marketPct}%` }} />
              <span className="ml-model" style={{ width: `${l.modelPct}%` }} />
            </div>
            <div className="tp-meta">
              <span>Model <b>{l.modelPct.toFixed(1)}%</b></span>
              <span>Market <b>{l.marketPct.toFixed(1)}%</b></span>
              <span>Gap <b className={l.gap >= 3 ? 'tr-pos' : ''}>{l.gap > 0 ? '+' : ''}{l.gap.toFixed(1)}</b></span>
              {l.odds !== null && l.breakEven !== null && <span title={l.priceFromBook ? 'Price posted by the sportsbook' : 'No price posted yet; standard-vig estimate'}>Price <b>{fmtOdds(l.odds)}</b>{l.priceFromBook ? '' : ' est.'} · needs <b>{l.breakEven.toFixed(1)}%</b></span>}
            </div>
          </li>;
        })}
      </ul>
      {leans.length > SHOW && <button type="button" className="ml-more" onClick={() => setAll(v => !v)}>{all ? 'Show fewer' : `Show all ${leans.length} leans`}</button>}
    </>}
    <p className="tp-foot">A big gap is not a bet. The model has to prove these leans beat the line over hundreds of games first; until then the bettable number stays close to the market's. To test it with real stakes, every lean with a green gap (+3 or more) is logged at a flat 5% of bankroll and graded in the Founder's Track Record.</p>
  </section>;
}

export default ModelLeans;
