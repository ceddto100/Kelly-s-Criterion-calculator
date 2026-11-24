import { describe,it,expect } from 'vitest';
import {predictedMarginFootball as football,predictedMarginBasketball as basketball,estimateBasketballProbability,estimateFootballProbability,coverProbability,marketAnchoredCover,estimateGamesPlayed,evidenceWeight} from '../src/utils/calculations.js';
const stats={teamPPG:115,teamAllowed:108,opponentPPG:110,opponentAllowed:112};
describe('sport model invariants',()=>{
  it('equal teams at neutral venue have no edge',()=>{
    const equal={teamPPG:100,teamAllowed:99,opponentPPG:100,opponentAllowed:99};
    expect(basketball(equal)).toBe(0);expect(football(equal)).toBe(0);
    expect(estimateBasketballProbability(equal,0,'neutral').probability).toBe(50);
  });
  it('reverses the margin when teams swap',()=>{
    const reverse={teamPPG:110,teamAllowed:112,opponentPPG:115,opponentAllowed:108};
    expect(basketball(stats)).toBeCloseTo(-basketball(reverse));expect(football(stats)).toBeCloseTo(-football(reverse));
  });
  it('does not count shooting, rebounds or three-point volume twice',()=>{
    expect(basketball({...stats,teamFGPct:65,opponentFGPct:35,teamReboundMargin:12,opponentReboundMargin:-12,team3PRate:.6,opponent3PRate:.2})).toBe(basketball(stats));
  });
  it('normalizes unequal pace before comparing efficiencies',()=>{
    expect(basketball({teamPPG:121,teamAllowed:110,opponentPPG:99,opponentAllowed:90,teamPace:110,opponentPace:90})).toBeCloseTo(0);
  });
  it('scales a fixed efficiency gap with matchup possessions',()=>{
    const ratings={...stats,teamOffRtg:120,teamDefRtg:110,opponentOffRtg:110,opponentDefRtg:110};
    expect(basketball({...ratings,teamPace:110,opponentPace:110})).toBeCloseTo(basketball({...ratings,teamPace:100,opponentPace:100})*1.1);
  });
  it('does not inflate a lead for turnover totals with unknown exposure',()=>{
    expect(football({...stats,teamTurnoverDiff:30,opponentTurnoverDiff:-30})).toBe(football(stats));
  });
  it('keeps yardage secondary to scoring (80/20), and lets scoring carry the gap without it',()=>{
    const base={teamPPG:28,teamAllowed:20,opponentPPG:22,opponentAllowed:24};          // net points gap 10
    const full={...base,teamOffYards:380,teamDefYards:320,opponentOffYards:340,opponentDefYards:360}; // net yards gap 80
    const ctx={gamesPlayed:6}; // k = 0.5
    expect(football(base,'NFL',ctx)).toBeCloseTo(0.5*10);
    expect(football(full,'NFL',ctx)).toBeCloseTo(0.5*(0.8*10+0.2*80/15));
  });
  it('keeps the college fallback weight; NBA reaches it after 10 games',()=>{
    // CBB keeps its legacy half weight with no sample-size shrink; the NBA uses
    // the full gap shrunk by k(n)=n/(n+10), which equals one half at 10 games.
    expect(basketball(stats,'NBA',{gamesPlayed:10})).toBeCloseTo(basketball(stats,'CBB'));
    expect(basketball(stats,'CBB',{gamesPlayed:1})).toBeCloseTo(basketball(stats,'CBB',{gamesPlayed:60}));
  });
  it('blends recent scoring conservatively',()=>{
    const delta=basketball({...stats,teamRecentPPG:125})-basketball(stats);expect(delta).toBeGreaterThan(0);expect(delta).toBeLessThan(5);
  });
  it('retains a bounded optional QB adjustment',()=>expect(football({...stats,qbEdge:99})-football(stats)).toBeCloseTo(7,10));
  it('rejects invalid scoring data and variance',()=>{
    expect(()=>basketball({...stats,teamPPG:NaN})).toThrow();expect(()=>football({...stats,teamAllowed:-1})).toThrow();expect(()=>coverProbability(5,-3,0)).toThrow();
  });
  it('increases cover probability with margin and decreases it with a harder spread',()=>{
    expect(coverProbability(8,-3,12)).toBeGreaterThan(coverProbability(4,-3,12));expect(coverProbability(8,-6,12)).toBeLessThan(coverProbability(8,-3,12));
  });
});

describe('sample-size shrinkage (fitted on 2010-2026 NFL and 2025-27 NBA results)',()=>{
  const nba={teamPPG:118,teamAllowed:110,opponentPPG:112,opponentAllowed:114,teamPace:100,opponentPace:100};
  const nfl={teamPPG:27,teamAllowed:19,opponentPPG:21,opponentAllowed:24};
  it('weights a season gap by n/(n+priorGames)',()=>{
    expect(evidenceWeight(10,10)).toBeCloseTo(0.5);expect(evidenceWeight(6,18)).toBeCloseTo(0.75);
    expect(evidenceWeight(0,3)).toBe(1);expect(evidenceWeight(10,0)).toBe(0);
    // NBA raw gap here: (8 - (-2)) = 10 points at pace 100
    expect(basketball(nba,'NBA',{gamesPlayed:10})).toBeCloseTo(5);
    expect(basketball(nba,'NBA',{gamesPlayed:30})).toBeCloseTo(7.5);
    // NFL raw gap without yardage: scoring carries the full weight, 8 - (-3) = 11; k(6) = 0.5
    expect(football(nfl,'NFL',{gamesPlayed:6})).toBeCloseTo(5.5);
  });
  it('lets early-season gaps count for little and late-season gaps for most',()=>{
    expect(basketball(nba,'NBA',{gamesPlayed:2})).toBeLessThan(2);
    expect(basketball(nba,'NBA',{gamesPlayed:70})).toBeGreaterThan(8.5);
  });
  it('estimates games played from the league calendar',()=>{
    expect(estimateGamesPlayed('NBA','2026-11-23T12:00:00Z')).toBeGreaterThan(14.5);
    expect(estimateGamesPlayed('NBA','2026-11-23T12:00:00Z')).toBeLessThan(17.5);
    expect(estimateGamesPlayed('NBA','2026-08-01T12:00:00Z')).toBe(82);
    expect(estimateGamesPlayed('NBA','2027-04-20T12:00:00Z')).toBe(82);
    expect(estimateGamesPlayed('NFL','2026-11-24T12:00:00Z')).toBeGreaterThan(9);
    expect(estimateGamesPlayed('NFL','2026-11-24T12:00:00Z')).toBeLessThan(11);
    expect(estimateGamesPlayed('NFL','2026-09-08T12:00:00Z')).toBe(17); // before kickoff: last season's CSV
    expect(estimateGamesPlayed('NFL','2027-01-20T12:00:00Z')).toBe(17);
  });
  it('rejects invalid games played',()=>expect(()=>basketball(nba,'NBA',{gamesPlayed:-1})).toThrow());
});

describe('market-anchored cover probability',()=>{
  it('reduces to the classic normal model with full trust and no shrink',()=>{
    expect(marketAnchoredCover({predictedMargin:5,homeEdge:0,spread:-3,evidenceWeight:1,marketTrust:1,sigma:13}).probability)
      .toBeCloseTo(coverProbability(5,-3,13),6);
  });
  it('is a coin flip when the season gap agrees with the line, for favorites and underdogs alike',()=>{
    // Home team favored by 10 with a 2-point home edge: the market implies an
    // 8-point team gap. A season gap of 8, shrunk by k=0.6, projects 6.8 —
    // the old method read that as the underdog covering. It is agreement.
    const k=0.6, homeEdge=2;
    for(const spread of [-10,-4,0,3,9]){
      const gap=-spread-homeEdge;
      const r=marketAnchoredCover({predictedMargin:homeEdge+k*gap,homeEdge,spread,evidenceWeight:k,marketTrust:0.2,sigma:14});
      expect(r.disagreement).toBeCloseTo(0,10);expect(r.probability).toBeCloseTo(50,6);
    }
  });
  it('moves toward the model in the right direction but stays close to the line',()=>{
    const up=marketAnchoredCover({predictedMargin:12,homeEdge:2,spread:-3,evidenceWeight:1,marketTrust:0.2,sigma:14});
    const down=marketAnchoredCover({predictedMargin:-6,homeEdge:2,spread:-3,evidenceWeight:1,marketTrust:0.2,sigma:14});
    expect(up.probability).toBeGreaterThan(50);expect(up.probability).toBeLessThan(56);
    expect(down.probability).toBeLessThan(50);expect(down.probability).toBeGreaterThan(44);
  });
  it('separates the model-only probability from the anchored one',()=>{
    const team={teamPPG:120,teamAllowed:105,opponentPPG:108,opponentAllowed:118,teamPace:100,opponentPace:100};
    const r=estimateBasketballProbability(team,-3,'home',true,{gamesPlayed:40});
    // Whatever trust history assigns (0 = no proven edge), the anchored figure sits
    // between the line's coin flip and the model's own view.
    expect(r.modelProbability).toBeGreaterThan(r.probability);expect(r.probability).toBeGreaterThanOrEqual(50);
    if((r.marketTrust ?? 0)>0) expect(r.probability).toBeGreaterThan(50); else expect(r.probability).toBe(50);
    const su=estimateBasketballProbability(team,0,'home',true,{gamesPlayed:40,marketLine:false});
    expect(su.probability).toBe(su.modelProbability);expect(su.marketTrust).toBeNull();
    const f=estimateFootballProbability({teamPPG:24,teamAllowed:24,opponentPPG:24,opponentAllowed:24},-1.8,'home',true,{gamesPlayed:8});
    expect(f.predictedMargin).toBeCloseTo(1.8);expect(f.probability).toBeCloseTo(50,1);
  });
});


describe('learned calibration (scripts/backtest/calibrate.ts)', () => {
  it('feeds every sport and stays inside its guardrails', async () => {
    const { CALIBRATION } = await import('../src/config/calibration.generated.js');
    const { NFL_CONSTANTS, NBA_CONSTANTS } = await import('../src/utils/calculations.js');
    const { NHL_CONFIG } = await import('../src/utils/nhl.js');
    expect(NFL_CONSTANTS.marketTrust).toBe(CALIBRATION.NFL.marketTrust);
    expect(NBA_CONSTANTS.marketTrust).toBe(CALIBRATION.NBA.marketTrust);
    expect(NHL_CONFIG.marketTrust).toBe(CALIBRATION.NHL.marketTrust);
    for (const t of [CALIBRATION.NFL.marketTrust, CALIBRATION.NBA.marketTrust, CALIBRATION.NHL.marketTrust]) {
      expect(t).toBeGreaterThanOrEqual(0); expect(t).toBeLessThanOrEqual(0.6);
    }
  });
});
