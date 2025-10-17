export interface KellyInput {
  winProb: number;
  odds: number;
  bankroll: number;
}

export interface KellyResult {
  kellyFraction: number;
  betSize: number;
}

export const calculateKelly = ({ winProb, odds, bankroll }: KellyInput): KellyResult => {
  const b = odds - 1;
  const numerator = odds * winProb - 1;
  const rawFraction = numerator / b;
  const kellyFraction = Math.max(0, rawFraction);
  const betSize = bankroll * kellyFraction;

  return {
    kellyFraction,
    betSize,
  };
};

export default calculateKelly;
