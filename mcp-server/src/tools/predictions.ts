import { z } from 'zod';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Express } from 'express';
import { loadCatalog, predictFromCatalog, MODEL_VERSION, type PredictionSport, type Catalog } from '../utils/predictionCore.js';

export const sportSchema = z.enum(['NBA','NFL','NHL','MLB']);
export const predictionSchema = z.object({
  sport:sportSchema,
  home:z.string().trim().min(2).max(100).describe('Home team full name or CSV abbreviation; ask the user if venue is unknown.'),
  away:z.string().trim().min(2).max(100).describe('Away team full name or CSV abbreviation.'),
  line:z.number().finite().min(-100).max(100).optional().describe('Optional home spread for NBA/NFL, total for NHL/MLB. Never invent a market line.'),
  gameDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('MLB slate date, YYYY-MM-DD. Omit for today or a hypothetical matchup.'),
}).strict();
export const predictionOutputSchema = z.object({
  sport:sportSchema,home:z.string(),away:z.string(),headline:z.string(),summary:z.string(),
  homeScore:z.number().finite().optional(),awayScore:z.number().finite().optional(),margin:z.number().finite().optional(),total:z.number().finite().optional(),
  probability:z.number().min(0).max(100).optional(),probabilityLabel:z.string().optional(),pushProbability:z.number().min(0).max(100).optional(),
  drivers:z.array(z.string()),warnings:z.array(z.string()),updatedAt:z.string().nullable(),modelVersion:z.string(),source:z.literal('CSV'),files:z.array(z.string()),inputs:z.record(z.unknown()),
});
export const questionSchema=z.object({question:z.string().trim().min(3).max(2000),sport:sportSchema.optional()}).strict();

export const MODEL_GUIDANCE = {
  modelVersion:MODEL_VERSION,
  source:'CSV',
  scope:'NBA, NFL, NHL and MLB team outcomes. No fabricated stats, news, injuries, odds, trends or betting actions.',
  calibration:'Structural defaults, not fitted optimal weights. Historical pre-game snapshots and outcomes are required to validate accuracy.',
  NBA:'Equal offense/defense efficiency blend at expected pace; scoring/pace fallback. Shooting, rebounds and turnovers are already represented in efficiency.',
  NFL:'Net scoring gap × 0.5 + net yardage gap / 15 × 0.25, then home advantage. Season turnover totals are not given an extra bonus without games played.',
  NHL:'All-situation xG blended across offense/defense, opponent GSAx regressed by half. No duplicate HDCF or PP/PK bonus. Negative binomial totals include pushes.',
  MLB:'wRC+ offense anchor, then wOBA/OPS/runs fallbacks. Pitching is blended by expected innings, with existing park/weather/lineup adjustments.',
};

export function statsDirectory() {
  if(process.env.STATS_DIR) return resolve(process.env.STATS_DIR);
  const location=fileURLToPath(new URL('../../../frontend/public/stats/',import.meta.url));
  const candidates=[location,resolve(process.cwd(),'../frontend/public/stats'),resolve(process.cwd(),'frontend/public/stats')];
  const found=candidates.find(existsSync);
  if(!found) throw new Error('CSV statistics directory is unavailable; configure STATS_DIR');
  return found;
}
const catalogs = new Map<PredictionSport,{at:number;value:Promise<Catalog>}>();
export function clearPredictionCache(){catalogs.clear();}
export async function getCatalog(sport:PredictionSport) {
  const cached=catalogs.get(sport);
  if(cached && Date.now()-cached.at<60000) return cached.value;
  const base=statsDirectory();
  const value=loadCatalog(sport,file=>readFile(resolve(base,file),'utf8')).catch(e=>{catalogs.delete(sport);throw e;});
  catalogs.set(sport,{at:Date.now(),value});return value;
}
export async function handlePrediction(input:unknown) {
  const request=predictionSchema.parse(input);
  return predictionOutputSchema.parse(predictFromCatalog(await getCatalog(request.sport),request));
}

/** The host assistant handles unrestricted language. This optional text tool
 * answers supported questions itself and requests clarification on ambiguity.
 * It never fills statistical fields from generated text.
 */
export async function handleSportsQuestion(input:unknown) {
  const {question,sport:provided}=questionSchema.parse(input);
  const q=question.toLowerCase();
  const sport=provided ?? (['NBA','NFL','NHL','MLB'] as const).find(s=>new RegExp('\\b'+s+'\\b','i').test(q));
  if(/\b(model|math|weight|method|calculate|calibration)\b/.test(q) && !/\b(vs|versus|against| at | @ )\b/.test(q)) return {kind:'methodology',answer:MODEL_GUIDANCE};
  if(!sport) return {kind:'clarification',answer:'Which sport: NBA, NFL, NHL or MLB?'};
  const catalog=await getCatalog(sport);
  if(/\b(list|available)\b/.test(q) && /\bteams\b/.test(q)) return {kind:'teams',sport,teams:catalog.teams.map(t=>({name:t.team,abbreviation:t.abbreviation})),updatedAt:catalog.updatedAt};
  const matched=catalog.teams.filter(t=>{
    const aliases=[t.team.toLowerCase(),t.abbreviation.toLowerCase(),t.team.toLowerCase().split(' ').slice(-1)[0]];
    return aliases.some(alias=>new RegExp('\\b'+alias.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b').test(q));
  });
  if(matched.length===1 && /\b(stats|statistics|offense|defense|scoring|shooting|pace|rating)\b/.test(q)) return {kind:'statistics',sport,team:matched[0],source:'CSV',updatedAt:catalog.updatedAt};
  if(matched.length!==2) return {kind:'clarification',answer:'Name two teams, or ask for one team’s statistics. Use full names or abbreviations for ambiguous cities.'};
  const mentions=matched.map(team=>{
    const full=q.indexOf(team.team.toLowerCase());
    const abbr=q.search(new RegExp('\\b'+team.abbreviation.toLowerCase()+'\\b'));
    const nickname=q.lastIndexOf(team.team.toLowerCase().split(' ').slice(-1)[0]);
    return {team,position:full>=0?full:abbr>=0?abbr:nickname};
  }).sort((a,b)=>a.position-b.position);
  const between=q.slice(mentions[0].position,mentions[1].position);
  let home: string,away: string;
  if(/\bat\b|@/.test(between)) {away=mentions[0].team.abbreviation;home=mentions[1].team.abbreviation;}
  else return {kind:'clarification',answer:'Which team is home? For example: “NBA Lakers at Celtics”.'};
  // Do not interpret incidental numbers as a line.
  const lineMatch=q.match(/(?:total|over|under|home spread|spread)\s*(?:of\s*)?([+-]?\d+(?:\.\d+)?)/);
  const date=q.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0];
  return {kind:'prediction',prediction:await handlePrediction({sport,home,away,line:lineMatch?Number(lineMatch[1]):undefined,gameDate:date})};
}

function response(data:Record<string,unknown>) {return {content:[{type:'text' as const,text:JSON.stringify(data)}],structuredContent:data};}
const annotations={readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false};
export function registerPredictionTools(server:McpServer) {
  server.registerTool('predict_game',{
    title:'Predict a game from CSV statistics',
    description:'Primary game prediction tool. Translate natural-language requests into sport, home and away teams. Uses only server CSV statistics and the shared mathematical model. Returns projections, explanations, input provenance and limitations. Ask for home/away if unknown. Do not invent a line or claim a hypothetical matchup is scheduled.',
    inputSchema:predictionSchema.shape,outputSchema:predictionOutputSchema.shape,annotations,
  },async input=>{try{return response(await handlePrediction(input));}catch(e){return {content:[{type:'text' as const,text:e instanceof Error?e.message:'Prediction unavailable'}],isError:true};}});
  server.registerTool('get_sports_catalog',{
    title:'Read supported teams and their statistics',description:'List available teams, CSV statistics and snapshot date. Use for team questions, comparison, clarification and explaining predictions.',
    inputSchema:{sport:sportSchema},annotations,
  },async ({sport})=>{try{const c=await getCatalog(sport);return response({sport,teams:c.teams,updatedAt:c.updatedAt,files:c.files,source:'CSV',modelVersion:MODEL_VERSION});}catch(e){return {content:[{type:'text' as const,text:e instanceof Error?e.message:'Stats unavailable'}],isError:true};}});
  server.registerTool('ask_sports',{
    title:'Ask about a sport or matchup',description:'Read-only natural-language questions about supported team stats, methodology or game predictions. Example: NBA Lakers at Celtics, total 220. Use predict_game for a structured matchup after resolving ambiguity. Never supplies invented statistics.',inputSchema:questionSchema.shape,annotations,
  },async input=>{try{return response(await handleSportsQuestion(input));}catch(e){return {content:[{type:'text' as const,text:e instanceof Error?e.message:'Question unavailable'}],isError:true};}});
  server.registerTool('explain_prediction_model',{title:'Explain the prediction model',description:'Explain sport-specific weights, CSV source and calibration limitations.',inputSchema:{},annotations},async()=>response(MODEL_GUIDANCE));
}

export function registerPredictionRoutes(app:Express) {
  app.get('/api/predictions/catalog',async(req,res)=>{
    try {const c=await getCatalog(sportSchema.parse(req.query.sport));res.json({sport:c.sport,teams:c.teams,updatedAt:c.updatedAt,files:c.files,source:'CSV',modelVersion:MODEL_VERSION});}
    catch(e){res.status(e instanceof z.ZodError?400:422).json({error:e instanceof Error?e.message:'Stats unavailable'});}
  });
  app.get('/api/predictions/model',(_req,res)=>res.json(MODEL_GUIDANCE));
  app.post('/api/predictions',async(req,res)=>{
    try {res.json(await handlePrediction(req.body));}catch(e){res.status(e instanceof z.ZodError?400:422).json({error:e instanceof Error?e.message:'Prediction unavailable'});}
  });
  app.post('/api/predictions/question',async(req,res)=>{
    try {res.json(await handleSportsQuestion(req.body));}catch(e){res.status(e instanceof z.ZodError?400:422).json({error:e instanceof Error?e.message:'Question unavailable'});}
  });
}
