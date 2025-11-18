// backend/utils/loadCSV.js
// Utility to load and parse CSV files from stats/ directory

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

/**
 * Load a CSV file and return parsed data as an array of objects
 * @param {string} filename - Name of the CSV file (e.g., 'ppg.csv')
 * @returns {Promise<Array>} - Array of parsed row objects
 */
function loadCSV(filename) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(__dirname, '..', '..', 'stats', filename);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return reject(new Error(`CSV file not found: ${filename}`));
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
 * @param {Array} csvData - Array of team stat objects
 * @param {string} searchTerm - Team name or abbreviation to search for
 * @returns {Object|null} - Team stats object or null if not found
 */
function findTeam(csvData, searchTerm) {
  const search = searchTerm.toLowerCase().trim();

  return csvData.find(row => {
    const teamName = row.team?.toLowerCase() || '';
    const abbrev = row.abbreviation?.toLowerCase() || '';

    return teamName.includes(search) || abbrev.includes(search) || search.includes(teamName);
  }) || null;
}

module.exports = { loadCSV, findTeam };
