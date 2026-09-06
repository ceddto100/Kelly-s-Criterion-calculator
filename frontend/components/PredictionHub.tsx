import React, { useEffect, useState } from 'react';
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
const initials=(name:string)=>name.split(' ').map(w=>w[0]).slice(-2).join('');

export default function PredictionHub() {
  const [sport,setSport]=useState<PredictionSport>('NBA');
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
      <div className="hero-copy"><span className="eyebrow"><span className="signal-dot"/> THE PREDICTION ROOM</span>
        <h2>Every game.<br/><em>A clearer picture.</em></h2>
        <p>The numbers tell a story. Explore the matchup, see the projected outcome, and understand what drives it.</p>
        <a className="hero-link" href="#matchup-builder">Build your matchup <span aria-hidden="true">↗</span></a>
      </div>
      <div className="court-art" aria-hidden="true"><div className="court-lines"/><span className="court-word">READ<br/>THE<br/><b>GAME.</b></span><span className="court-caption">BETGISTICS / PREDICTIONS</span></div>
    </section>
    <div className="sport-tabs" role="group" aria-label="Choose sport">{SPORTS.map(s=><button key={s.key} type="button" aria-pressed={sport===s.key} className={sport===s.key?'selected':''} onClick={()=>setSport(s.key)}><span className="sport-mark" aria-hidden="true">{s.mark}</span><span><strong>{s.key}</strong><small>{s.name}</small></span><span className="sport-arrow" aria-hidden="true">↗</span></button>)}</div>
    <div className="board-title"><div><span className="eyebrow">YOUR MATCHUP LAB</span><h3>{SPORTS.find(s=>s.key===sport)?.tag}.</h3></div><button className="snapshot-refresh" onClick={()=>setRevision(v=>v+1)} disabled={loading}>{loading?'Loading snapshot…':'↻ Refresh stats'}</button></div>
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
          {prediction.probability!==undefined&&<div className="probability-read"><div><span>{prediction.probabilityLabel}</span><strong>{prediction.probability.toFixed(1)}%</strong></div><div className="probability-track" aria-hidden="true"><span style={{width:prediction.probability+'%'}}/></div>{!!prediction.pushProbability&&<small>Push at this line: {prediction.pushProbability.toFixed(1)}%</small>}</div>}
          <details className="model-details"><summary>Why this prediction?</summary><ul>{prediction.drivers.map(d=><li key={d}>{d}</li>)}</ul><p>{prediction.warnings.join(' ')}</p><details><summary>View source statistics</summary><pre>{JSON.stringify(prediction.inputs,null,2)}</pre></details></details>
          <p className="estimate-note">Research-informed estimate · not yet backtested. Outcomes can differ.</p>
        </> : <div className="prediction-empty"><span className="empty-orbit" aria-hidden="true">↗</span><span className="eyebrow">LESS GUESSWORK. MORE CONTEXT.</span><h3>Your next read<br/>starts here.</h3><p>Pick two teams. We’ll turn their statistics into an outcome you can explore.</p><div className="empty-steps"><span>Select teams</span><i>→</i><span>See the projection</span><i>→</i><span>Explore why</span></div></div>}
      </section>
    </div>
    <section className="insight-tiles" aria-label="How predictions work"><article><span className="tile-index">THE FOUNDATION</span><h4>Stats with substance.</h4><p>Your team's offense and the opponent's defense meet in one sport-specific model.</p></article><article><span className="tile-index">THE PERSPECTIVE</span><h4>See beyond the pick.</h4><p>Open the explanation to see the signals behind the result and the age of the data.</p></article><article><span className="tile-index">THE CONVERSATION</span><h4>Ask about the game.</h4><p>The connected assistant uses these same statistics and calculations to explain a matchup.</p></article></section>
  </div>;
}
