/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const stringSimilarity = require('string-similarity');

/**
 * Finds the best matching team from a list of teams using fuzzy string matching
 * @param {string} searchTerm - The team name to search for
 * @param {Array} teams - Array of team objects with 'team' and 'abbreviation' properties
 * @param {number} threshold - Minimum similarity score (0-1) to accept a match (default: 0.6)
 * @returns {Object|null} - The best matching team object or null if no good match found
 */
function fuzzyFindTeam(searchTerm, teams, threshold = 0.6) {
  if (!searchTerm || !teams || teams.length === 0) {
    return null;
  }

  const search = searchTerm.toLowerCase().trim();

  // First, try exact matches (case-insensitive)
  const exactMatch = teams.find(team => {
    const teamName = team.team?.toLowerCase() || '';
    const abbrev = team.abbreviation?.toLowerCase() || '';
    return teamName === search || abbrev === search;
  });

  if (exactMatch) {
    return exactMatch;
  }

  // Build list of all possible team strings to match against
  const teamStrings = [];
  const teamMap = new Map();

  teams.forEach(team => {
    const teamName = team.team || '';
    const abbrev = team.abbreviation || '';

    // Add full team name
    if (teamName) {
      teamStrings.push(teamName.toLowerCase());
      teamMap.set(teamName.toLowerCase(), team);
    }

    // Add abbreviation
    if (abbrev) {
      teamStrings.push(abbrev.toLowerCase());
      teamMap.set(abbrev.toLowerCase(), team);
    }

    // Add last word of team name (e.g., "Lakers" from "Los Angeles Lakers")
    const words = teamName.split(' ');
    if (words.length > 1) {
      const lastName = words[words.length - 1].toLowerCase();
      teamStrings.push(lastName);
      teamMap.set(lastName, team);
    }
  });

  // Find best match using string similarity
  const matches = stringSimilarity.findBestMatch(search, teamStrings);
  const bestMatch = matches.bestMatch;

  // Only return if similarity is above threshold
  if (bestMatch.rating >= threshold) {
    return teamMap.get(bestMatch.target);
  }

  // If no good fuzzy match, try substring matching as fallback
  const substringMatch = teams.find(team => {
    const teamName = team.team?.toLowerCase() || '';
    const abbrev = team.abbreviation?.toLowerCase() || '';
    return teamName.includes(search) || abbrev.includes(search);
  });

  return substringMatch || null;
}

/**
 * Calculates similarity score between two strings (0-1)
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Similarity score between 0 and 1
 */
function getSimilarity(str1, str2) {
  return stringSimilarity.compareTwoStrings(
    str1.toLowerCase().trim(),
    str2.toLowerCase().trim()
  );
}

/**
 * Get multiple team suggestions based on fuzzy matching
 * @param {string} searchTerm - The team name to search for
 * @param {Array} teams - Array of team objects with 'team' and 'abbreviation' properties
 * @param {number} limit - Maximum number of suggestions to return (default: 5)
 * @returns {Array} - Array of team suggestions with similarity scores, sorted by score
 */
function getTeamSuggestions(searchTerm, teams, limit = 5) {
  if (!searchTerm || !teams || teams.length === 0) {
    return [];
  }

  const search = searchTerm.toLowerCase().trim();

  // Build list of all team names with their similarity scores
  const teamScores = [];
  const seenTeams = new Set();

  teams.forEach(team => {
    const teamName = team.team || '';
    const abbrev = team.abbreviation || '';

    if (!teamName || seenTeams.has(teamName)) {
      return;
    }

    seenTeams.add(teamName);

    // Calculate similarity scores for different variations
    const fullNameScore = stringSimilarity.compareTwoStrings(search, teamName.toLowerCase());
    const abbrevScore = abbrev ? stringSimilarity.compareTwoStrings(search, abbrev.toLowerCase()) : 0;

    // Check last word (e.g., "Lakers" from "Los Angeles Lakers")
    const words = teamName.split(' ');
    const lastWordScore = words.length > 1
      ? stringSimilarity.compareTwoStrings(search, words[words.length - 1].toLowerCase())
      : 0;

    // Use the highest score
    const maxScore = Math.max(fullNameScore, abbrevScore, lastWordScore);

    teamScores.push({
      team: teamName,
      abbreviation: abbrev,
      score: maxScore
    });
  });

  // Sort by score descending and return top N
  return teamScores
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => ({
      team: item.team,
      abbreviation: item.abbreviation
    }));
}

module.exports = {
  fuzzyFindTeam,
  getSimilarity,
  getTeamSuggestions
};
