// backend/scrapers/mlbAdvanced.js
// =============================================================================
// Reads the FanGraphs advanced stats produced by scripts/updateMLBAdvanced.py
// (backend/data/mlb/{team_offense,pitchers}.csv) and exposes lookups used to
// enrich the MLB projection inputs in mlbStatsApi.js:
//
//   getTeamOffense(teamName)        -> { wrcPlus, woba }   (or {} if unknown)
//   getStarter(pitcherName, team)   -> { fip, xfip, siera } (or {} if unknown)
//   getBullpen(teamName)            -> { fip, era, whip }  (or {} if unknown)
//
// Fault-tolerant by design: if the files are missing (e.g. the updater hasn't
// run yet, or the backend is deployed without them) every lookup returns {},
// so the engine simply falls back to OPS/ERA — today's behavior. Files are
// cached in memory and reloaded only when their mtime changes.
// =============================================================================
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data', 'mlb');
const TEAM_FILE = path.join(DATA_DIR, 'team_offense.csv');
const PITCHER_FILE = path.join(DATA_DIR, 'pitchers.csv');
const BULLPEN_FILE = path.join(DATA_DIR, 'bullpen.csv');

function normalize(s) {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents (Jose)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function nickname(s) {
  const parts = (s || '').trim().split(/\s+/);
  return normalize(parts[parts.length - 1] || '');
}

function toNum(v) {
  if (v === undefined || v === null || v === '') return undefined;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : undefined;
}

// Minimal CSV parse — the generator strips commas from names/teams, so a plain
// split is safe and avoids a dependency.
function parseCsv(text) {
  const lines = text.trim().split('\n').filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const vals = line.split(',');
    const row = {};
    headers.forEach((h, i) => { row[h] = (vals[i] || '').trim(); });
    return row;
  });
}

const cache = {
  teamMtime: -1, pitcherMtime: -1, bullpenMtime: -1,
  teams: null, pitchers: null, bullpens: null,
};

function mtime(file) {
  try { return fs.statSync(file).mtimeMs; } catch { return 0; }
}

function loadTeams() {
  const m = mtime(TEAM_FILE);
  if (cache.teams && m === cache.teamMtime) return cache.teams;
  const byKey = new Map(); // normalized full-name / abbr -> entry
  const byNick = new Map(); // nickname -> entry
  try {
    for (const r of parseCsv(fs.readFileSync(TEAM_FILE, 'utf8'))) {
      const entry = { wrcPlus: toNum(r.wrc_plus), woba: toNum(r.woba) };
      if (r.team) { byKey.set(normalize(r.team), entry); byNick.set(nickname(r.team), entry); }
      if (r.abbreviation) byKey.set(normalize(r.abbreviation), entry);
    }
  } catch { /* file absent -> no enrichment */ }
  cache.teams = { byKey, byNick };
  cache.teamMtime = m;
  return cache.teams;
}

function loadPitchers() {
  const m = mtime(PITCHER_FILE);
  if (cache.pitchers && m === cache.pitcherMtime) return cache.pitchers;
  const byName = new Map(); // normalized name -> [entries]
  try {
    for (const r of parseCsv(fs.readFileSync(PITCHER_FILE, 'utf8'))) {
      const key = normalize(r.name);
      if (!key) continue;
      const entry = { team: r.team, fip: toNum(r.fip), xfip: toNum(r.xfip), siera: toNum(r.siera) };
      const list = byName.get(key);
      if (list) list.push(entry);
      else byName.set(key, [entry]);
    }
  } catch { /* file absent */ }
  cache.pitchers = byName;
  cache.pitcherMtime = m;
  return cache.pitchers;
}

function loadBullpens() {
  const m = mtime(BULLPEN_FILE);
  if (cache.bullpens && m === cache.bullpenMtime) return cache.bullpens;
  const byKey = new Map(); // normalized full-name / abbr -> entry
  const byNick = new Map(); // nickname -> entry
  try {
    for (const r of parseCsv(fs.readFileSync(BULLPEN_FILE, 'utf8'))) {
      const entry = { fip: toNum(r.fip), era: toNum(r.era), whip: toNum(r.whip) };
      if (r.team) { byKey.set(normalize(r.team), entry); byNick.set(nickname(r.team), entry); }
      if (r.abbreviation) byKey.set(normalize(r.abbreviation), entry);
    }
  } catch { /* file absent -> no enrichment */ }
  cache.bullpens = { byKey, byNick };
  cache.bullpenMtime = m;
  return cache.bullpens;
}

function getTeamOffense(teamName) {
  if (!teamName) return {};
  const { byKey, byNick } = loadTeams();
  return byKey.get(normalize(teamName)) || byNick.get(nickname(teamName)) || {};
}

function getBullpen(teamName) {
  if (!teamName) return {};
  const { byKey, byNick } = loadBullpens();
  return byKey.get(normalize(teamName)) || byNick.get(nickname(teamName)) || {};
}

function getStarter(pitcherName, teamName) {
  if (!pitcherName) return {};
  const list = loadPitchers().get(normalize(pitcherName));
  if (!list || list.length === 0) return {};
  if (list.length === 1) return list[0];
  // Rare same-name collision: prefer the pitcher whose FanGraphs team matches.
  const nick = nickname(teamName);
  const match = list.find((p) => normalize(p.team) === nick || nickname(p.team) === nick);
  return match || list[0];
}

module.exports = { getTeamOffense, getStarter, getBullpen };
