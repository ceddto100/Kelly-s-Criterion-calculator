/** Score previously recorded binary predictions. No dependencies or new model inputs.
 * CSV columns: game_id,sport,market,predicted_at,game_time,probability,outcome
 * probability: percentage; outcome: win|loss|push|void. One selected side per game/market.
 */
import {readFile} from 'node:fs/promises';
import {parseCsv} from '../mcp-server/dist/utils/csv.js';
const filename=process.argv[2];
if(!filename) {console.error('Usage: node scripts/evaluatePredictions.mjs path/to/export.csv (build MCP first)');process.exit(1);}
const rows=parseCsv(await readFile(filename,'utf8'));
const groups=new Map(),seen=new Set();
for(const row of rows){
  const key=[row.game_id,row.sport,row.market].join('|');
  if(!row.game_id || !row.market || !['NBA','NFL','MLB','NHL'].includes(row.sport))throw Error('Invalid game/sport/market');
  if(seen.has(key))throw Error('Duplicate game/market: '+key);seen.add(key);
  const recorded=Date.parse(row.predicted_at),gameTime=Date.parse(row.game_time);
  if(!Number.isFinite(recorded)||!Number.isFinite(gameTime)||recorded>=gameTime)throw Error('Forecast must predate the game: '+key);
  const p=Number(row.probability)/100;
  if(row.probability.trim()===''||!Number.isFinite(p)||p<0||p>1)throw Error('Invalid probability: '+key);
  if(!['win','loss','push','void'].includes(row.outcome))throw Error('Invalid outcome: '+key);
  const groupKey=row.sport+'/'+row.market;
  const group=groups.get(groupKey)??{samples:[],excluded:0};groups.set(groupKey,group);
  if(['push','void'].includes(row.outcome)){group.excluded++;continue;}
  group.samples.push({p,y:row.outcome==='win'?1:0});
}
const report={note:'Binary metrics require half-point markets or probabilities explicitly conditional on no push. No weights were fitted.',groups:{}};
for(const [key,{samples,excluded}] of groups){
  const n=samples.length,mean=fn=>n?samples.reduce((sum,row)=>sum+fn(row),0)/n:null;
  report.groups[key]={count:n,excludedPushOrVoid:excluded,brier:mean(({p,y})=>(p-y)**2),logLoss:mean(({p,y})=>-(y*Math.log(Math.max(1e-15,p))+(1-y)*Math.log(Math.max(1e-15,1-p)))),reliability:Array.from({length:10},(_,i)=>{
    const bin=samples.filter(({p})=>Math.min(9,Math.floor(p*10))===i);
    return {lower:i/10,count:bin.length,meanProbability:bin.length?bin.reduce((s,r)=>s+r.p,0)/bin.length:null,observedWinRate:bin.length?bin.reduce((s,r)=>s+r.y,0)/bin.length:null};
  })};
}
console.log(JSON.stringify(report,null,2));
