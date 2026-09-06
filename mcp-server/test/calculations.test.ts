import { describe,it,expect } from 'vitest';
import {predictedMarginFootball as football,predictedMarginBasketball as basketball,estimateBasketballProbability,coverProbability} from '../src/utils/calculations.js';
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
  it('keeps yardage secondary to scoring',()=>{
    const base={teamPPG:28,teamAllowed:20,opponentPPG:22,opponentAllowed:24};
    const full={...base,teamOffYards:380,teamDefYards:320,opponentOffYards:340,opponentDefYards:360};
    expect(football(full)).toBeGreaterThan(football(base));expect(football(full)-football(base)).toBeLessThan(football(base));
  });
  it('does not compress the college scoring fallback',()=>expect(basketball(stats,'CBB')).toBeCloseTo(basketball(stats,'NBA')));
  it('blends recent scoring conservatively',()=>{
    const delta=basketball({...stats,teamRecentPPG:125})-basketball(stats);expect(delta).toBeGreaterThan(0);expect(delta).toBeLessThan(5);
  });
  it('retains a bounded optional QB adjustment',()=>expect(football({...stats,qbEdge:99})-football(stats)).toBe(7));
  it('rejects invalid scoring data and variance',()=>{
    expect(()=>basketball({...stats,teamPPG:NaN})).toThrow();expect(()=>football({...stats,teamAllowed:-1})).toThrow();expect(()=>coverProbability(5,-3,0)).toThrow();
  });
  it('increases cover probability with margin and decreases it with a harder spread',()=>{
    expect(coverProbability(8,-3,12)).toBeGreaterThan(coverProbability(4,-3,12));expect(coverProbability(8,-6,12)).toBeLessThan(coverProbability(8,-3,12));
  });
});
