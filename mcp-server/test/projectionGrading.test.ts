/**
 * Tests for projection grading (the backtesting scoring logic).
 * Pure function — no database needed.
 */
import { describe, it, expect } from 'vitest';
import { gradeProjection } from '../src/tools/projectionLog.js';

describe('gradeProjection — totals', () => {
  it('over wins when total exceeds the line', () => {
    expect(gradeProjection('total', 'over', 8.5, 5, 5)).toBe('win'); // 10 > 8.5
  });
  it('over loses when total is under the line', () => {
    expect(gradeProjection('total', 'over', 8.5, 3, 4)).toBe('loss'); // 7 < 8.5
  });
  it('under wins when total is under the line', () => {
    expect(gradeProjection('total', 'under', 8.5, 3, 4)).toBe('win');
  });
  it('exact total pushes', () => {
    expect(gradeProjection('total', 'over', 9, 4, 5)).toBe('push'); // 9 == 9
  });
});

describe('gradeProjection — moneyline', () => {
  it('home win grades home lean as win', () => {
    expect(gradeProjection('moneyline', 'home', null, 5, 3)).toBe('win');
  });
  it('home win grades away lean as loss', () => {
    expect(gradeProjection('moneyline', 'away', null, 5, 3)).toBe('loss');
  });
  it('tie pushes', () => {
    expect(gradeProjection('moneyline', 'home', null, 3, 3)).toBe('push');
  });
});

describe('gradeProjection — spread (home perspective)', () => {
  it('home -3 covers when home wins by 4', () => {
    // bookLine -3 (home favored), homeMargin +4 => homeCover = 4 + (-3) = 1 > 0
    expect(gradeProjection('spread', 'home', -3, 24, 20)).toBe('win');
  });
  it('home -3 fails when home wins by 2', () => {
    expect(gradeProjection('spread', 'home', -3, 22, 20)).toBe('loss');
  });
  it('away +3 wins when home only wins by 2', () => {
    expect(gradeProjection('spread', 'away', -3, 22, 20)).toBe('win');
  });
  it('exact cover pushes', () => {
    expect(gradeProjection('spread', 'home', -3, 23, 20)).toBe('push');
  });
});

describe('gradeProjection — no action', () => {
  it('no-bet always pushes', () => {
    expect(gradeProjection('total', 'no-bet', 8.5, 12, 0)).toBe('push');
  });
  it('pass always pushes', () => {
    expect(gradeProjection('spread', 'pass', -3, 30, 0)).toBe('push');
  });
});
