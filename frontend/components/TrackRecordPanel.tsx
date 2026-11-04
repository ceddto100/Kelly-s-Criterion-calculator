import React, { useEffect, useState } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

export interface TrackRecord {
  settled:number; pending:number; wins:number; losses:number; pushes:number; totalBets?:number;
  winRate:number; roi:number; units:number; profit:number; wagered:number; avgStake:number; profitTrend:number[]; streak:{type:'win'|'loss'|null;count:number};
  unitsTrend:number[]; bySport:{sport:string;wins:number;losses:number;pushes:number;roi:number;profit:number}[];
  recent:{sport:string;matchup:string;pick:string;result:'win'|'loss'|'push';date:string;stake:number;profit:number}[];
  since:string|null;
}

function Sparkline({points,format=(v:number)=>String(v)}:{points:number[];format?:(v:number)=>string}) {
  if(points.length<2) return null;
  const data=[0,...points],w=240,h=56,min=Math.min(0,...data),max=Math.max(0,...data),span=max-min||1;
  const x=(i:number)=>(i/(data.length-1))*w, y=(v:number)=>h-((v-min)/span)*h;
  const d=data.map((v,i)=>(i?'L':'M')+x(i).toFixed(1)+' '+y(v).toFixed(1)).join(' ');
  const up=data[data.length-1]>=0;
  return <svg className="tr-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label={`Profit over time, now ${format(data[data.length-1])}`}>
    <line x1="0" x2={w} y1={y(0)} y2={y(0)} className="tr-spark-zero"/>
    <path d={d} className={up?'tr-spark-up':'tr-spark-down'}/>
  </svg>;
}

const signed=(n:number,suffix='')=>`${n>0?'+':''}${n}${suffix}`;
const money=(n:number,showSign=false)=>{
  const abs=Math.abs(n).toLocaleString(undefined,{style:'currency',currency:'USD',minimumFractionDigits:Math.abs(n)>=1000?0:2,maximumFractionDigits:Math.abs(n)>=1000?0:2});
  return n<0?`-${abs}`:showSign&&n>0?`+${abs}`:abs;
};

interface TrackRecordPanelProps {
  /** API path that returns the track-record summary shape. */
  endpoint:string;
  title:string;
  tag:string;
  explain?:React.ReactNode;
  emptyText?:string;
  footer?:React.ReactNode;
  /** Send the session cookie (personal records). */
  withCredentials?:boolean;
  /** Bump to refetch, e.g. after a bet is logged or graded. */
  refreshKey?:number;
  /** Hide the panel entirely if the request fails. */
  hideOnError?:boolean;
}

export function TrackRecordPanel({endpoint,title,tag,explain,emptyText='The first graded bets will show up here.',footer,withCredentials=false,refreshKey=0,hideOnError=true}:TrackRecordPanelProps) {
  const [data,setData]=useState<TrackRecord|null>(null);
  const [failed,setFailed]=useState(false);
  useEffect(()=>{
    let active=true;
    fetch(`${BACKEND_URL}${endpoint}`,{cache:'no-store',credentials:withCredentials?'include':'same-origin'})
      .then(r=>r.ok?r.json():Promise.reject())
      .then(d=>{if(!active)return;if(d&&typeof d.settled==='number'&&Array.isArray(d.recent)&&Array.isArray(d.profitTrend)&&Array.isArray(d.bySport)){setData({...d,streak:d.streak||{type:null,count:0}});setFailed(false);}else setFailed(true);})
      .catch(()=>{if(active)setFailed(true);});
    return()=>{active=false;};
  },[endpoint,withCredentials,refreshKey]);
  const header=<div className="panel-heading"><h3 className="tr-title"><span className="signal-dot" aria-hidden="true"/>{title}</h3><span className="result-tag">{tag}</span></div>;
  if(failed&&!data) return hideOnError?null:<section className="track-record">{header}<p className="tr-explain">Couldn't load your results right now.</p></section>;
  if(!data) return <section className="track-record" aria-busy="true">{header}<p className="tr-explain">Loading results…</p></section>;
  const pendingNote=`${data.pending} pending`+(typeof data.totalBets==='number'?` · ${data.totalBets} total`:'');
  return <section className="track-record" aria-label={title}>
    {header}
    {explain&&<p className="tr-explain">{explain}</p>}
    {data.settled===0 ? <p className="tr-empty">{emptyText}{data.pending?` (${data.pending} pending)`:''}</p> : <>
      <div className="tr-stats">
        <div><small>Record</small><strong>{data.wins}-{data.losses}{data.pushes?`-${data.pushes}`:''}</strong><span>{data.winRate}% win rate</span></div>
        <div><small>ROI</small><strong className={data.roi>=0?'tr-pos':'tr-neg'}>{signed(data.roi,'%')}</strong><span>return per dollar staked</span></div>
        <div><small>Net profit</small><strong className={data.profit>=0?'tr-pos':'tr-neg'}>{money(data.profit,true)}</strong><span>{signed(data.units,'u')} · {money(data.wagered)} staked</span></div>
        <div><small>Streak</small><strong>{data.streak.type?`${data.streak.type==='win'?'W':'L'}${data.streak.count}`:'—'}</strong><span>{pendingNote}</span></div>
      </div>
      <div className="tr-body">
        <div className="tr-trend"><small>Profit over time · {data.settled} graded bets · avg bet {money(data.avgStake)}</small><Sparkline points={data.profitTrend} format={v=>money(v,true)}/>
          {data.bySport.length>0&&<div className="tr-sports">{data.bySport.map(s=><span key={s.sport}><b>{s.sport}</b> <i className={s.profit>=0?'tr-pos':'tr-neg'}>{money(s.profit,true)}</i></span>)}</div>}
        </div>
        <div className="tr-recent"><small>Last {data.recent.length}</small>
          <div className="tr-form" aria-label="Recent results">{[...data.recent].reverse().map((r,i)=><span key={i} className={'tr-dot tr-'+r.result} title={`${r.pick} · ${r.result}`}>{r.result[0].toUpperCase()}</span>)}</div>
          <ul>{data.recent.slice(0,5).map((r,i)=><li key={i}><span className={'tr-chip tr-'+r.result}>{r.result.toUpperCase()}</span><span className="tr-pick"><b>{r.pick}</b><small>{r.sport} · {r.matchup}</small></span><span className={'tr-amt '+(r.profit>0?'tr-pos':r.profit<0?'tr-neg':'')}>{money(r.profit,true)}<small>on {money(r.stake)}</small></span></li>)}</ul>
        </div>
      </div>
    </>}
    {footer&&<p className="tr-foot">{footer}</p>}
  </section>;
}

export default TrackRecordPanel;
