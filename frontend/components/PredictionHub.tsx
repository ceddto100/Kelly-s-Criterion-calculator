import React, { useEffect, useState } from 'react';
import { TrackRecordPanel } from './TrackRecordPanel';
import { useHiddenSports } from '../utils/sportVisibility';
import { loadCatalog, predictFromCatalog, type Catalog, type Prediction, type PredictionSport } from '../../mcp-server/src/utils/predictionCore';

const SPORTS: {key: PredictionSport; name: string; mark: string; tag: string}[] = [
  {key:'NBA',name:'Basketball',mark:'◉',tag:'Own the court'},
  {key:'NFL',name:'Football',mark:'◈',tag:'Read the field'},
  {key:'MLB',name:'Baseball',mark:'◇',tag:'See the matchup'},
  {key:'NHL',name:'Hockey',mark:'◎',tag:'Find the angle'},
];
const cache = new Map<PredictionSport, {time:number; promise:Promise<Catalog>}>();
function catalogFor(sport: PredictionSport, refresh = false) {
  const saved=cache.get(sport);
  if(!refresh && saved && Date.now()-saved.time<60000) return saved.promise;
  const promise=loadCatalog(sport,async path=>{
    const r=await fetch('/stats/'+path,{cache:'no-cache'});
    if(!r.ok) throw new Error('Unable to load stats. Try refreshing the snapshot.');
    return r.text();
  }).catch(e=>{cache.delete(sport);throw e;});
  cache.set(sport,{time:Date.now(),promise});return promise;
}

const METHOD_STEPS = [
  {n:'01',title:'Read the stats',body:'Team-by-team season data runs through a sport-specific model to project the score.'},
  {n:'02',title:'Ask the AI Analyst',body:'Get a plain-English breakdown of the matchup built on the same numbers.'},
  {n:'03',title:'Find the edge',body:'Compare the model to the sportsbook line. No edge, no bet.'},
  {n:'04',title:'Size it with Kelly',body:'Stake a disciplined slice of your bankroll, then log it and track every result.'},
];

function FounderTrackRecord() {
  return <TrackRecordPanel
    endpoint="/api/track-record"
    title="Founder's Track Record"
    tag="REAL BETS"
    explain="These are the Betgistics founder's own logged bets, made with the method above and graded automatically from final scores. They aren't your bets, and they aren't picks to copy."
    footer="Past results don't predict future results. Even a disciplined approach has losing stretches — only bet what you can afford to lose."
  />;
}

const initials=(name:string)=>name.split(' ').map(w=>w[0]).slice(-2).join('');

export default function PredictionHub() {
  const [sport,setSport]=useState<PredictionSport>('NBA');
  const hiddenSports=useHiddenSports();
  const visibleSports=SPORTS.filter(s=>!hiddenSports.includes(s.key));
  // If the admin hides the selected sport, jump to the first one still shown.
  useEffect(()=>{
    if(visibleSports.length && !visibleSports.some(s=>s.key===sport)) setSport(visibleSports[0].key);
  },[hiddenSports]); // eslint-disable-line react-hooks/exhaustive-deps
  const [catalog,setCatalog]=useState<Catalog|null>(null);
  const [home,setHome]=useState(''),[away,setAway]=useState(''),[line,setLine]=useState('');
  const [prediction,setPrediction]=useState<Prediction|null>(null);
  const [error,setError]=useState(''),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0);
  useEffect(()=>{
    let active=true;setLoading(true);setError('');setCatalog(null);setPrediction(null);setLine('');
    catalogFor(sport,revision>0).then(data=>{
      if(!active)return;
      setCatalog(data);setHome('');setAway('');
    }).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[sport,revision]);
  function calculate(e:React.FormEvent) {
    e.preventDefault();setError('');
    try {if(catalog)setPrediction(predictFromCatalog(catalog,{sport,home,away,line:line.trim()===''?undefined:Number(line)}));}
    catch(e){setPrediction(null);setError(e instanceof Error?e.message:'Could not project this matchup');}
  }
  const change=()=>{setPrediction(null);setError('');};
  return <div className="prediction-hub" data-sport={sport}>
    <section className="prediction-hero">
      <div className="hero-copy"><span className="eyebrow"><span className="signal-dot"/> THE MATCHUP LAB</span>
        <h2>Bet with a method.<br/><em>Not a hunch.</em></h2>
        <p>No one sells guaranteed wins. What Betgistics gives you is a process: stats-driven projections, an AI Analyst to break them down, and the bankroll discipline to bet only when the numbers give you an edge.</p>
        <a className="hero-link" href="#matchup-builder">Build a matchup <span aria-hidden="true">↗</span></a>
      </div>
      <div className="court-art" aria-hidden="true"><div className="court-lines"/><span className="court-word">FIND<br/>THE<br/><b>EDGE.</b></span><span className="court-caption">BETGISTICS / THE METHOD</span></div>
    </section>
    <section className="method-steps" aria-label="The Betgistics method">{METHOD_STEPS.map(s=><article key={s.n}><span className="tile-index">STEP {s.n}</span><h4>{s.title}</h4><p>{s.body}</p></article>)}</section>
    <div className="sport-tabs" role="group" aria-label="Choose sport">{visibleSports.map(s=><button key={s.key} type="button" aria-pressed={sport===s.key} className={sport===s.key?'selected':''} onClick={()=>setSport(s.key)}><span className="sport-mark" aria-hidden="true">{s.mark}</span><span><strong>{s.key}</strong><small>{s.name}</small></span><span className="sport-arrow" aria-hidden="true">↗</span></button>)}</div>
    <div className="board-title"><div><span className="eyebrow">BUILD ANY MATCHUP</span><h3>{SPORTS.find(s=>s.key===sport)?.tag}.</h3></div><button className="snapshot-refresh" onClick={()=>setRevision(v=>v+1)} disabled={loading}>{loading?'Loading snapshot…':'↻ Refresh stats'}</button></div>
    <div className="prediction-workspace">
      <form id="matchup-builder" className="matchup-builder" onSubmit={calculate}>
        <div className="panel-heading"><span className="eyebrow">BUILD A PREDICTION</span><span className="league-badge">{sport}</span></div>
        <label htmlFor="prediction-away">Away team</label>
        <select id="prediction-away" value={away} disabled={loading} required onChange={e=>{setAway(e.target.value);change();}}><option value="">Choose an away team</option>{catalog?.teams.map(t=><option key={t.abbreviation} value={t.abbreviation} disabled={t.abbreviation===home}>{t.team}</option>)}</select>
        <div className="versus-divider"><span/><button type="button" aria-label="Swap home and away teams" onClick={()=>{setHome(away);setAway(home);change();}}>⇅</button><span/></div>
        <label htmlFor="prediction-home">Home team</label>
        <select id="prediction-home" value={home} disabled={loading} required onChange={e=>{setHome(e.target.value);change();}}><option value="">Choose a home team</option>{catalog?.teams.map(t=><option key={t.abbreviation} value={t.abbreviation} disabled={t.abbreviation===away}>{t.team}</option>)}</select>
        <details className="line-options"><summary>Compare with a line <span>Optional</span></summary><label htmlFor="prediction-line">{sport==='NBA'||sport==='NFL'?'Home-team spread':'Game total'}</label><input id="prediction-line" type="number" step="0.5" value={line} onChange={e=>{setLine(e.target.value);change();}} placeholder={sport==='NBA'||sport==='NFL'?'e.g. -3.5':'e.g. 6.5'}/><small>{sport==='NBA'||sport==='NFL'?'Negative means the home team gives points.':'Use the total you want to compare against.'}</small></details>
        <button className="project-button" disabled={loading||!home||!away}>Reveal prediction <span aria-hidden="true">↗</span></button>
        {error&&<p className="prediction-error" role="alert">{error}</p>}
        <p className="snapshot-note">Snapshot: {catalog?.updatedAt ? new Date(catalog.updatedAt).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'Date unavailable'}<br/>Season statistics · select teams to explore</p>
      </form>
      <section className={'prediction-outcome '+(prediction?'has-result':'')} aria-label="Prediction result" aria-live="polite">
        {prediction ? <>
          <div className="panel-heading"><span className="eyebrow">THE MODEL'S READ</span><span className="result-tag">PROJECTION</span></div>
          <div className="matchup-faceoff"><div><span className="team-monogram away">{initials(prediction.away)}</span><strong>{prediction.away}</strong><small>AWAY</small></div><span className="vs">VS</span><div><span className="team-monogram home">{initials(prediction.home)}</span><strong>{prediction.home}</strong><small>HOME</small></div></div>
          <h3 className="outcome-headline">{prediction.headline}</h3><p>{prediction.summary}</p>
          {prediction.homeScore!==undefined&&<div className="score-strip"><div><small>Away projected</small><strong>{prediction.awayScore?.toFixed(1)}</strong></div><div><small>Home projected</small><strong>{prediction.homeScore.toFixed(1)}</strong></div><div><small>Total</small><strong>{prediction.total?.toFixed(1)}</strong></div></div>}
          {prediction.homeWinProbability!==undefined&&prediction.awayWinProbability!==undefined&&(()=>{
            // Projected winner first, so the headline team and the first
            // probability always match (and that number is always >= 50%).
            const homeFirst=prediction.projectedWinner===prediction.home;
            const rows=homeFirst?[[prediction.home,prediction.homeWinProbability],[prediction.away,prediction.awayWinProbability]]:[[prediction.away,prediction.awayWinProbability],[prediction.home,prediction.homeWinProbability]];
            return <div className="probability-read"><div><span>Win probability · {rows[0][0]}</span><strong>{(rows[0][1] as number).toFixed(1)}%</strong></div><div className="probability-track" aria-hidden="true"><span style={{width:rows[0][1]+'%'}}/></div><small>{rows[1][0]}: {(rows[1][1] as number).toFixed(1)}%</small></div>;
          })()}
          {prediction.probability!==undefined&&(prediction.homeWinProbability===undefined||line.trim()!=='')&&<div className="probability-read"><div><span>{prediction.probabilityLabel}</span><strong>{prediction.probability.toFixed(1)}%</strong></div><div className="probability-track" aria-hidden="true"><span style={{width:prediction.probability+'%'}}/></div>{!!prediction.pushProbability&&<small>Push at this line: {prediction.pushProbability.toFixed(1)}%</small>}</div>}
          <details className="model-details"><summary>Why this prediction?</summary><ul>{prediction.drivers.map(d=><li key={d}>{d}</li>)}</ul><p>{prediction.warnings.join(' ')}</p><details><summary>View source statistics</summary><pre>{JSON.stringify(prediction.inputs,(_k,v)=>typeof v==='number'&&!Number.isInteger(v)?Math.round(v*1000)/1000:v,2)}</pre></details></details>
          <p className="estimate-note">Research-informed estimate · not yet backtested. Outcomes can differ.</p>
        </> : <div className="prediction-empty"><span className="empty-orbit" aria-hidden="true">↗</span><span className="eyebrow">LESS GUESSWORK. MORE CONTEXT.</span><h3>Your next read<br/>starts here.</h3><p>Pick two teams. We’ll turn their statistics into an outcome you can explore.</p><div className="empty-steps"><span>Select teams</span><i>→</i><span>See the projection</span><i>→</i><span>Explore why</span></div></div>}
      </section>
    </div>
    <FounderTrackRecord/>
    <section className="insight-tiles" aria-label="Betting with discipline"><article><span className="tile-index">THE EDGE</span><h4>Only bet the gap.</h4><p>When the model's probability beats the sportsbook's implied odds, that's an edge. When it doesn't, passing is the winning move.</p></article><article><span className="tile-index">THE BANKROLL</span><h4>Stake like a pro.</h4><p>Kelly sizing grows your stake when the edge is bigger and shrinks it when it's thin, so no single game sinks your bankroll.</p></article><article><span className="tile-index">THE LONG GAME</span><h4>Track everything.</h4><p>Log every bet. Results only mean something over hundreds of bets, not one weekend.</p></article></section>
  </div>;
}
