/**
 * Unit Tests for Matchup Parser
 *
 * Tests for the natural language parsing of betting requests,
 * including team recognition, spread parsing, pick detection, and venue parsing.
 */

import { describe, it, expect } from 'vitest';
import { parseMatchupRequest, ParsedMatchup } from '../utils/matchupParser.js';
import { findTeam, findMatchupTeams, detectSport, isHomeVenue } from '../utils/teamData.js';

// ============================================================================
// TEAM RECOGNITION TESTS
// ============================================================================

describe('Team Recognition', () => {
  describe('findTeam', () => {
    it('should find NFL team by full name', () => {
      const result = findTeam('Cowboys');
      expect(result).not.toBeNull();
      expect(result?.team.name).toBe('Cowboys');
      expect(result?.sport).toBe('NFL');
    });

    it('should find NBA team by city', () => {
      const result = findTeam('Miami', 'NBA');
      expect(result).not.toBeNull();
      expect(result?.team.name).toBe('Heat');
    });

    it('should find team by abbreviation', () => {
      const result = findTeam('ATL');
      expect(result).not.toBeNull();
      expect(result?.team.name).toBe('Hawks');
    });

    it('should find team by alias', () => {
      const result = findTeam('niners');
      expect(result).not.toBeNull();
      expect(result?.team.name).toBe('49ers');
    });

    it('should return null for unknown team', () => {
      const result = findTeam('XYZ Team');
      expect(result).toBeNull();
    });
  });

  describe('findMatchupTeams', () => {
    it('should find both NBA teams from matchup text', () => {
      const result = findMatchupTeams('Heat vs Hawks', 'NBA');
      expect(result).not.toBeNull();
      expect(result?.teamA.name).toBe('Heat');
      expect(result?.teamB.name).toBe('Hawks');
    });

    it('should find NFL teams from matchup text', () => {
      const result = findMatchupTeams('Cowboys vs Eagles');
      expect(result).not.toBeNull();
      expect(['Cowboys', 'Eagles']).toContain(result?.teamA.name);
      expect(['Cowboys', 'Eagles']).toContain(result?.teamB.name);
    });

    it('should find teams using aliases', () => {
      const result = findMatchupTeams('Philly vs Dallas', 'NFL');
      expect(result).not.toBeNull();
    });
  });
});

// ============================================================================
// SPORT DETECTION TESTS
// ============================================================================

describe('Sport Detection', () => {
  it('should detect NFL from explicit mention', () => {
    expect(detectSport('NFL: Cowboys vs Eagles')).toBe('NFL');
  });

  it('should detect NBA from explicit mention', () => {
    expect(detectSport('NBA: Heat vs Hawks')).toBe('NBA');
  });

  it('should detect CFB from college football mention', () => {
    expect(detectSport('college football game today')).toBe('CFB');
  });

  it('should detect CBB from college basketball mention', () => {
    expect(detectSport('march madness game')).toBe('CBB');
  });

  it('should detect sport from NFL team names', () => {
    expect(detectSport('Cowboys vs Eagles game')).toBe('NFL');
  });

  it('should detect sport from NBA team names', () => {
    expect(detectSport('Lakers vs Celtics tonight')).toBe('NBA');
  });
});

// ============================================================================
// SPREAD PARSING TESTS
// ============================================================================

describe('Spread Parsing', () => {
  it('should parse negative spread with team', () => {
    const result = parseMatchupRequest('NBA: Heat vs Hawks, Hawks -3.5, taking Hawks');
    expect(result.success).toBe(true);
    expect(result.parsed?.spread).toBe(-3.5);
  });

  it('should parse positive spread', () => {
    const result = parseMatchupRequest('NFL: Cowboys vs Eagles, Eagles +2.5, taking Eagles');
    expect(result.success).toBe(true);
    expect(result.parsed?.spread).toBe(2.5);
  });

  it('should handle spread sign correctly based on pick', () => {
    const result = parseMatchupRequest('NBA: Heat vs Hawks, Hawks -3.5, I\'m taking Heat');
    expect(result.success).toBe(true);
    // Heat is the underdog, so spread should be positive from their perspective
    expect(result.parsed?.spread).toBe(3.5);
  });

  it('should parse whole number spread', () => {
    const result = parseMatchupRequest('NFL: Cowboys vs Eagles, Cowboys -7, taking Cowboys');
    expect(result.success).toBe(true);
    expect(result.parsed?.spread).toBe(-7);
  });
});

// ============================================================================
// PICK DETECTION TESTS
// ============================================================================

describe('Pick Detection', () => {
  it('should detect pick from "taking" phrase', () => {
    const result = parseMatchupRequest('NBA: Heat vs Hawks, Hawks -3.5, taking Hawks');
    expect(result.success).toBe(true);
    expect(result.parsed?.teamA.name).toBe('Hawks');
  });

  it('should detect pick from "I\'m taking" phrase', () => {
    const result = parseMatchupRequest('NFL: Cowboys vs Eagles, I\'m taking Eagles +3');
    expect(result.success).toBe(true);
    expect(result.parsed?.teamA.name).toBe('Eagles');
  });

  it('should detect pick from "my pick is" phrase', () => {
    const result = parseMatchupRequest('NBA: Lakers vs Celtics, my pick is Boston, -5.5');
    expect(result.success).toBe(true);
    expect(result.parsed?.teamA.name).toBe('Celtics');
  });

  it('should detect pick from "betting on" phrase', () => {
    const result = parseMatchupRequest('NFL: Cowboys vs Eagles, betting on Dallas -7');
    expect(result.success).toBe(true);
    expect(result.parsed?.teamA.name).toBe('Cowboys');
  });
});

// ============================================================================
// VENUE PARSING TESTS
// ============================================================================

describe('Venue Parsing', () => {
  it('should detect home venue from city mention', () => {
    const result = parseMatchupRequest('NBA: Heat vs Hawks, Hawks -3.5, taking Hawks, game in Atlanta');
    expect(result.success).toBe(true);
    expect(result.parsed?.venue).toBe('home');
    expect(result.parsed?.venueAssumed).toBe(false);
  });

  it('should detect away venue', () => {
    const result = parseMatchupRequest('NBA: Hawks vs Heat, Hawks -3.5, taking Hawks, game in Miami');
    expect(result.success).toBe(true);
    expect(result.parsed?.venue).toBe('away');
  });

  it('should detect neutral venue explicitly', () => {
    const result = parseMatchupRequest('NFL: Cowboys vs Eagles, Eagles +3, taking Eagles, neutral site');
    expect(result.success).toBe(true);
    expect(result.parsed?.venue).toBe('neutral');
    expect(result.parsed?.venueAssumed).toBe(false);
  });

  it('should assume neutral when not specified', () => {
    const result = parseMatchupRequest('NBA: Heat vs Hawks, Hawks -3.5, taking Hawks');
    expect(result.success).toBe(true);
    expect(result.parsed?.venue).toBe('neutral');
    expect(result.parsed?.venueAssumed).toBe(true);
  });

  it('should detect venue from "at home" phrase', () => {
    const result = parseMatchupRequest('NFL: Eagles at home vs Cowboys, Eagles -3, taking Eagles');
    expect(result.success).toBe(true);
  });

  it('should detect away venue from descriptive phrasing', () => {
    const result = parseMatchupRequest('NBA: Pistons vs Bulls, Pistons +5, taking Pistons, Pistons are away');
    expect(result.success).toBe(true);
    expect(result.parsed?.venue).toBe('away');
    expect(result.parsed?.venueAssumed).toBe(false);
  });
});

// ============================================================================
// FULL PARSING TESTS (User Examples)
// ============================================================================

describe('Full Parsing - User Examples', () => {
  it('should parse NBA example: "Heat vs Hawks, Hawks -3.5, I\'m taking Hawks. Game is in Atlanta."', () => {
    const result = parseMatchupRequest('NBA: Heat vs Hawks, Hawks -3.5, I\'m taking Hawks. Game is in Atlanta.');

    expect(result.success).toBe(true);
    expect(result.parsed?.sport).toBe('NBA');
    expect(result.parsed?.teamA.name).toBe('Hawks');
    expect(result.parsed?.teamB.name).toBe('Heat');
    expect(result.parsed?.spread).toBe(-3.5);
    expect(result.parsed?.venue).toBe('home');
  });

  it('should parse NFL example: "Cowboys vs Eagles, Eagles +2.5, I\'m taking Eagles. Philly at home."', () => {
    const result = parseMatchupRequest('NFL: Cowboys vs Eagles, Eagles +2.5, I\'m taking Eagles. Philly at home.');

    expect(result.success).toBe(true);
    expect(result.parsed?.sport).toBe('NFL');
    expect(result.parsed?.teamA.name).toBe('Eagles');
    expect(result.parsed?.teamB.name).toBe('Cowboys');
    expect(result.parsed?.spread).toBe(2.5);
    expect(result.parsed?.venue).toBe('home');
  });

  it('should parse minimal input with team inference', () => {
    const result = parseMatchupRequest('Lakers vs Celtics, -5.5, taking Lakers');

    expect(result.success).toBe(true);
    expect(result.parsed?.sport).toBe('NBA');
    expect(result.parsed?.teamA.name).toBe('Lakers');
  });

  it('should parse input with odds', () => {
    const result = parseMatchupRequest('NFL: Chiefs vs Raiders, Chiefs -7 at -110 odds, taking Chiefs');

    expect(result.success).toBe(true);
    expect(result.parsed?.americanOdds).toBe(-110);
  });
});

// ============================================================================
// NBA TEAM RESOLUTION REGRESSIONS
// ============================================================================

describe('NBA Team Resolution - Clippers vs Pistons', () => {
  it('should resolve Clippers when explicitly mentioned as opponent', () => {
    const result = parseMatchupRequest('NBA: Pistons at Clippers, Pistons -3.5, Pistons are away');

    expect(result.success).toBe(true);
    expect(result.parsed?.sport).toBe('NBA');
    expect(result.parsed?.teamA.name).toBe('Pistons');
    expect(result.parsed?.teamB.name).toBe('Clippers');
    expect(result.parsed?.venue).toBe('away');
    expect(result.parsed?.spread).toBe(-3.5);
  });

  it('should resolve Clippers using city/abbreviation aliases', () => {
    const result = parseMatchupRequest('Detroit Pistons @ LA Clippers, Pistons -3.5');

    expect(result.success).toBe(true);
    expect(result.parsed?.teamA.abbreviation).toBe('DET');
    expect(result.parsed?.teamB.abbreviation).toBe('LAC');
    expect(result.parsed?.spread).toBe(-3.5);
  });

  it('should respect user intent when matchup is phrased as versus', () => {
    const result = parseMatchupRequest('Pistons vs Clippers, Pistons -3.5 (away)');

    expect(result.success).toBe(true);
    expect(result.parsed?.teamB.name).toBe('Clippers');
    expect(result.parsed?.venue).toBe('away');
  });

  it('should accept pure abbreviations for both teams', () => {
    const result = parseMatchupRequest('DET @ LAC, DET -3.5');

    expect(result.success).toBe(true);
    expect(result.parsed?.teamA.abbreviation).toBe('DET');
    expect(result.parsed?.teamB.abbreviation).toBe('LAC');
    expect(result.parsed?.spread).toBe(-3.5);
  });

  it('should fail gracefully on misspelled opponent', () => {
    const result = parseMatchupRequest('NBA: Pistons at Clipprs, Pistons -3.5');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Clipprs');
  });

  it('should fail when opponent reference is ambiguous', () => {
    const result = parseMatchupRequest('NBA: Pistons vs Los Angles, Pistons -3.5');

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

// ============================================================================
// ERROR HANDLING TESTS
// ============================================================================

describe('Error Handling', () => {
  it('should return error for unrecognized teams', () => {
    const result = parseMatchupRequest('XYZ vs ABC, -3.5, taking XYZ');

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should return error for missing spread', () => {
    const result = parseMatchupRequest('NBA: Heat vs Hawks, taking Hawks');

    expect(result.success).toBe(false);
    expect(result.clarificationNeeded).toContain('spread');
  });

  it('should return error for undetectable sport with no teams', () => {
    const result = parseMatchupRequest('random text without any teams -3.5');

    expect(result.success).toBe(false);
  });
});

// ============================================================================
// HOME VENUE DETECTION TESTS
// ============================================================================

describe('Home Venue Detection', () => {
  it('should recognize home venue by city', () => {
    const heat = findTeam('Heat', 'NBA')?.team;
    expect(heat).toBeDefined();
    if (heat) {
      expect(isHomeVenue('Miami', heat)).toBe(true);
      expect(isHomeVenue('Atlanta', heat)).toBe(false);
    }
  });

  it('should recognize home venue by arena name', () => {
    const hawks = findTeam('Hawks', 'NBA')?.team;
    expect(hawks).toBeDefined();
    if (hawks) {
      expect(isHomeVenue('State Farm Arena', hawks)).toBe(true);
    }
  });
});
