// backend/utils/loadCSV.js
// Utility to load and parse CSV files from stats/ directory

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { fuzzyFindTeam } = require('./fuzzyTeamMatch');

/**
 * Load a CSV file and return parsed data as an array of objects
 * @param {string} filename - Name of the CSV file (e.g., 'ppg.csv')
 * @returns {Promise<Array>} - Array of parsed row objects
 */
function loadCSV(filename) {
  return new Promise((resolve, reject) => {
    // Try multiple possible paths for stats files
    const possiblePaths = [
      path.join(__dirname, '..', '..', 'stats', filename),  // Local: /stats/
      path.join(__dirname, '..', 'stats', filename),         // Render: /backend/stats/
      path.join(process.cwd(), 'stats', filename),           // CWD: stats/
      path.join(process.cwd(), '..', 'stats', filename)      // CWD parent: ../stats/
    ];

    let filePath = null;
    for (const tryPath of possiblePaths) {
      if (fs.existsSync(tryPath)) {
        filePath = tryPath;
        break;
      }
    }

    if (!filePath) {
      return reject(new Error(`CSV file not found: ${filename}. Tried paths: ${possiblePaths.join(', ')}`));
    }

    const results = [];

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => {
        console.log(`✅ Loaded ${results.length} rows from ${filename}`);
        resolve(results);
      })
      .on('error', (error) => {
        console.error(`🔥 Error reading ${filename}:`, error.message);
        reject(error);
      });
  });
}

/**
 * Find a team's stats from CSV data by name or abbreviation
 * Uses fuzzy matching to handle misspellings and variations
 * @param {Array} csvData - Array of team stat objects
 * @param {string} searchTerm - Team name or abbreviation to search for
 * @returns {Object|null} - Team stats object or null if not found
 */
function findTeam(csvData, searchTerm) {
  return fuzzyFindTeam(searchTerm, csvData, 0.6);
}

module.exports = { loadCSV, findTeam };
