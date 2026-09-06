import { calculateNHLProjection as project } from '../../mcp-server/src/utils/nhl';
import type { NHLTeamStats } from '../../mcp-server/src/utils/nhl';
export type { NHLTeamStats, NHLProjectionResult } from '../../mcp-server/src/utils/nhl';
export { normalCDF } from '../../mcp-server/src/utils/nhl';
export interface NHLProjectionInput { home: NHLTeamStats; away: NHLTeamStats }
export const calculateNHLProjection = (stats: NHLProjectionInput, line: number) => project(stats.home, stats.away, line);
const blank = (): NHLTeamStats => ({xGF60:0,xGA60:0,GSAx60:0,HDCF60:0,PP:0,PK:0,timesShorthandedPerGame:0});
export const initialNHLStats: NHLProjectionInput = {home:blank(), away:blank()};
