import {describe,it,expect,beforeEach} from 'vitest';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import request from 'supertest';
import {app} from '../src/server.js';
import {loadCatalog,predictFromCatalog,parseCsv,resolveTeam} from '../src/utils/predictionCore.js';
import {handlePrediction,handleSportsQuestion,clearPredictionCache} from '../src/tools/predictions.js';
import {calculateNHLProjection} from '../src/utils/nhl.js';
import {calculateNHLProjection as browserNHL} from '../../frontend/utils/nhlProjection.js';
import {projectMLBGame as browserMLB} from '../../frontend/utils/mlbProjection.js';
import {projectMLBGame,calculateOffenseScore} from '../src/utils/mlb.js';
beforeEach(clearPredictionCache);
const read=(file:string)=>readFile(resolve('../frontend/public/stats',file),'utf8');
describe('CSV prediction contract',()=>{
  it('joins Utah aliases without losing special teams statistics',async()=>{
    const c=await loadCatalog('NHL',read);expect(c.teams).toHaveLength(32);
    const utah=resolveTeam(c,'UTAH');expect(utah.stats.pp).toBe(20);expect(utah.stats.pk).toBe(78.1);
    expect(predictFromCatalog(c,{sport:'NHL',home:'Utah Hockey Club',away:'BOS'}).total).toBeGreaterThan(0);
  });
  it.each(['NBA','NFL','NHL','MLB'] as const)('%s browser and server return identical outcomes',async sport=>{
    const c=await loadCatalog(sport,read);expect(c.teams.length).toBeGreaterThan(20);
    const input={sport,home:c.teams[0].abbreviation,away:c.teams[1].abbreviation,line:sport==='NHL'||sport==='MLB'?6.5:-3.5};
    expect(await handlePrediction(input)).toEqual(predictFromCatalog(c,input));
    expect((await request(app).post('/api/predictions').send(input)).body).toEqual(await handlePrediction(input));
  });
  it('parses quoted multiline data and rejects malformed rows',()=>{
    expect(parseCsv('\uFEFFteam,abbreviation\n"New\nYork, NY",NY\n')[0].team).toBe('New\nYork, NY');
    expect(()=>parseCsv('a,b\n1')).toThrow();expect(()=>parseCsv('a,a\n1,2')).toThrow();
  });
  it('rejects malformed metrics rather than inventing zero',async()=>{
    const broken=async(file:string)=>(await read(file)).replace('"Cleveland Cavaliers","CLE",119.1','"Cleveland Cavaliers","CLE",oops');
    await expect(loadCatalog('NBA',broken)).rejects.toThrow();
  });
  it('does not predict missing scores, duplicate teams or ambiguous cities',async()=>{
    const c=await loadCatalog('NBA',read);expect(()=>resolveTeam(c,'Los Angeles')).toThrow('Ambiguous');
    expect(()=>predictFromCatalog(c,{sport:'NBA',home:'BOS',away:'BOS'})).toThrow();
    delete c.teams[0].stats.ppg;
    expect(()=>predictFromCatalog(c,{sport:'NBA',home:c.teams[0].abbreviation,away:c.teams[1].abbreviation})).toThrow('Missing');
  });
  it('returns validation errors for invalid API requests',async()=>{
    expect((await request(app).post('/api/predictions').send({sport:'SOCCER'})).status).toBe(400);
    expect((await request(app).post('/api/predictions').send({sport:'NBA',home:'BOS',away:'LAL',madeUpMetric:3})).status).toBe(400);
  });
  it('supports natural language statistics, predictions and clarification',async()=>{
    expect((await handleSportsQuestion({question:'NBA Lakers at Celtics'})).kind).toBe('prediction');
    expect((await handleSportsQuestion({question:'NBA Lakers vs Celtics'})).kind).toBe('clarification');
    expect((await handleSportsQuestion({question:'NBA Celtics statistics'})).kind).toBe('statistics');
    expect((await handleSportsQuestion({question:'What are the model weights?'})).kind).toBe('methodology');
    expect((await handleSportsQuestion({question:'Give me lottery numbers'})).kind).toBe('clarification');
  });
});
describe('MCP transport without MongoDB or AI keys',()=>{
  const rpc=(body:object)=>request(app).post('/mcp').set('Accept','application/json, text/event-stream').send(body);
  it('initializes and advertises typed read-only prediction tools',async()=>{
    const init=await rpc({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'test',version:'1'}}});
    expect(init.status).toBe(200);expect(init.body.result.serverInfo.name).toBe('betgistics-mcp-server');
    const list=await rpc({jsonrpc:'2.0',id:2,method:'tools/list',params:{}});
    expect(list.status).toBe(200);expect(list.body.result.tools).toHaveLength(4);
    const tool=list.body.result.tools.find((t:any)=>t.name==='predict_game');expect(tool.annotations.readOnlyHint).toBe(true);expect(tool.outputSchema.properties.source).toBeDefined();
  });
  it('executes a CSV prediction and returns errors as tool errors',async()=>{
    const args={sport:'NBA',home:'BOS',away:'LAL'};
    const result=await rpc({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'predict_game',arguments:args}});
    expect(result.body.result.structuredContent).toEqual(await handlePrediction(args));
    const bad=await rpc({jsonrpc:'2.0',id:4,method:'tools/call',params:{name:'predict_game',arguments:{...args,away:'unknown'}}});expect(bad.body.result.isError).toBe(true);
  });
  it('handles transport methods and validates origins',async()=>{
    expect((await request(app).get('/mcp')).status).toBe(405);expect((await request(app).delete('/mcp')).status).toBe(405);
    expect((await request(app).post('/mcp').set('Origin','https://untrusted.invalid').send({})).status).toBe(403);
    expect((await request(app).options('/mcp').set('Origin','https://chatgpt.com')).headers['access-control-allow-headers']).toContain('MCP-Protocol-Version');
  });
});
describe('NHL direction and discrete outcomes',()=>{
  const team={xGF60:3,xGA60:3,GSAx60:.1,HDCF60:12,PP:20,PK:80,timesShorthandedPerGame:3};
  it('better scoring raises over probability',()=>expect(calculateNHLProjection({...team,xGF60:4},team,6.5).overProbability).toBeGreaterThan(calculateNHLProjection(team,team,6.5).overProbability));
  it('over + under + push sum to 100',()=>{
    for(const line of [0,4,5.5,6,6.5,10,100]){const p=calculateNHLProjection(team,team,line);expect(p.overProbability+p.underProbability+p.pushProbability).toBeCloseTo(100,3);if(!Number.isInteger(line))expect(p.pushProbability).toBe(0);}
  });
  it('does not duplicate scoring events and reconciles score sums',()=>{
    const p=calculateNHLProjection(team,team,6.5);expect(calculateNHLProjection({...team,PP:50,HDCF60:30},team,6.5).projectedTotal).toBe(p.projectedTotal);
    expect(p.homeScore+p.awayScore).toBeCloseTo(p.projectedTotal,3);expect(browserNHL({home:team,away:team},6.5)).toEqual(p);
  });
});
describe('MLB efficiency anchor',()=>{
  it('does not dilute wRC+ with correlated raw stats',()=>expect(calculateOffenseScore({wrcPlus:110,woba:.4,ops:1,runsPerGame:7}).multiplier).toBe(calculateOffenseScore({wrcPlus:110}).multiplier));
  it('shares the exact function with browser',()=>expect(browserMLB).toBe(projectMLBGame));
});
