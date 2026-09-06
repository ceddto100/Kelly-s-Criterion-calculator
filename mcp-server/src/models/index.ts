/**
 * Models index - exports all MongoDB models
 */

export { BetLog, type IBetLog, type IMatchup, type IEstimation, type IKelly, type IOutcome, type UserBetStats } from './BetLog.js';
export { User, type IUser, type CalculationPermission } from './User.js';
export {
  Projection,
  type IProjection,
  type ProjectionSport,
  type ProjectionMarket,
  type ProjectionLean,
  type ProjectionResult,
  type BacktestSummary
} from './Projection.js';
