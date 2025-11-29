/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useRef, useEffect } from 'react';

// NBA Team Stats interface
interface NBATeamStats {
  team: string;
  abbreviation: string;
  ppg: number;
  allowed: number;
  fg_pct: number;
  rebound_margin: number;
  turnover_margin: number;
}

// Parse CSV string into array of objects
function parseCsv(csv: string): Record<string, string | number>[] {
  const lines = csv.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.replace(/"/g, '').trim());
    const obj: Record<string, string | number> = {};
    headers.forEach((h, i) => {
      const val = values[i];
      const num = parseFloat(val);
      obj[h] = isNaN(num) ? val : num;
    });
    return obj;
  });
}

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  stats?: {
    teamA: NBATeamStats;
    teamB: NBATeamStats;
  };
  suggestions?: {
    teamA?: NBATeamStats[];
    teamB?: NBATeamStats[];
  };
  notFound?: {
    teamA?: string;
    teamB?: string;
  };
}

interface NBAMatchupProps {
  onTransferToEstimator?: (matchupData: any) => void;
}

export default function NBAMatchup({ onTransferToEstimator }: NBAMatchupProps) {
  const [nbaTeams, setNbaTeams] = useState<NBATeamStats[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      role: 'assistant',
      content: "Welcome to the NBA Matchup Analyzer! Enter two teams you want to compare (e.g., 'Lakers vs Warriors' or 'Celtics Heat') and I'll show their stats for the probability estimator.",
      timestamp: Date.now()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load CSV data on mount
  useEffect(() => {
    async function loadNBAData() {
      try {
        console.log('Loading NBA stats from /stats/nba/...');

        const [ppgRes, allowedRes, fgPctRes, reboundRes, turnoverRes] = await Promise.all([
          fetch('/stats/nba/nba_ppg.csv'),
          fetch('/stats/nba/nba_allowed.csv'),
          fetch('/stats/nba/nba_fieldgoal.csv'),
          fetch('/stats/nba/nba_rebound_margin.csv'),
          fetch('/stats/nba/nba_turnover_margin.csv'),
        ]);

        // Check if any fetch failed
        if (!ppgRes.ok) throw new Error(`Failed to fetch PPG stats: ${ppgRes.status}`);
        if (!allowedRes.ok) throw new Error(`Failed to fetch Allowed stats: ${allowedRes.status}`);
        if (!fgPctRes.ok) throw new Error(`Failed to fetch Field Goal %: ${fgPctRes.status}`);
        if (!reboundRes.ok) throw new Error(`Failed to fetch Rebound Margin: ${reboundRes.status}`);
        if (!turnoverRes.ok) throw new Error(`Failed to fetch Turnover Margin: ${turnoverRes.status}`);

        const [ppgCsv, allowedCsv, fgPctCsv, reboundCsv, turnoverCsv] = await Promise.all([
          ppgRes.text(),
          allowedRes.text(),
          fgPctRes.text(),
          reboundRes.text(),
          turnoverRes.text(),
        ]);

        console.log('CSV files loaded, parsing...');

        const ppgData = parseCsv(ppgCsv);
        const allowedData = parseCsv(allowedCsv);
        const fgPctData = parseCsv(fgPctCsv);
        const reboundData = parseCsv(reboundCsv);
        const turnoverData = parseCsv(turnoverCsv);

        const allowedMap = new Map(allowedData.map(d => [d.abbreviation, d.allowed]));
        const fgPctMap = new Map(fgPctData.map(d => [d.abbreviation, d.fg_pct]));
        const reboundMap = new Map(reboundData.map(d => [d.abbreviation, d.rebound_margin]));
        const turnoverMap = new Map(turnoverData.map(d => [d.abbreviation, d.turnover_margin]));

        const teams = ppgData.map(team => ({
          team: team.team as string,
          abbreviation: team.abbreviation as string,
          ppg: team.ppg as number,
          allowed: (allowedMap.get(team.abbreviation) as number) || 0,
          fg_pct: (fgPctMap.get(team.abbreviation) as number) || 0,
          rebound_margin: (reboundMap.get(team.abbreviation) as number) || 0,
          turnover_margin: (turnoverMap.get(team.abbreviation) as number) || 0,
        }));

        console.log(`Loaded ${teams.length} NBA teams`);
        setNbaTeams(teams);
        setDataLoaded(true);
      } catch (err: any) {
        console.error('Failed to load NBA data:', err);
        setLoadError(err.message || 'Failed to load NBA stats');
      }
    }

    loadNBAData();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Simple string similarity calculator (Levenshtein-inspired)
  const calculateSimilarity = (str1: string, str2: string): number => {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();

    if (s1 === s2) return 1;
    if (s1.includes(s2) || s2.includes(s1)) return 0.8;

    // Calculate character overlap
    const len1 = s1.length;
    const len2 = s2.length;
    let matches = 0;

    for (let i = 0; i < Math.min(len1, len2); i++) {
      if (s1[i] === s2[i]) matches++;
    }

    return matches / Math.max(len1, len2);
  };

  // Get team suggestions based on similarity
  const getSuggestions = (query: string): NBATeamStats[] => {
    const normalizedQuery = query.toLowerCase().trim();

    const scored = nbaTeams.map(team => {
      const teamNameSimilarity = calculateSimilarity(normalizedQuery, team.team);
      const lastWord = team.team.split(' ').pop() || '';
      const lastWordSimilarity = calculateSimilarity(normalizedQuery, lastWord);
      const abbrevSimilarity = calculateSimilarity(normalizedQuery, team.abbreviation);

      const maxSimilarity = Math.max(teamNameSimilarity, lastWordSimilarity, abbrevSimilarity);

      return { team, similarity: maxSimilarity };
    });

    return scored
      .sort((a, b) => b.similarity - a.similarity)
      .map(item => item.team);
  };

  // Find team by name or abbreviation
  const findTeam = (query: string): NBATeamStats | null => {
    const normalizedQuery = query.toLowerCase().trim();

    const abbrevMatch = nbaTeams.find(t => t.abbreviation.toLowerCase() === normalizedQuery);
    if (abbrevMatch) return abbrevMatch;

    const nameMatch = nbaTeams.find(t =>
      t.team.toLowerCase().includes(normalizedQuery) ||
      normalizedQuery.includes(t.team.split(' ').pop()?.toLowerCase() || '')
    );
    if (nameMatch) return nameMatch;

    const fuzzyMatches: { [key: string]: string } = {
      'clips': 'LAC',
      'clippers': 'LAC',
      'dubs': 'GS',
      'warriors': 'GS',
      'lakers': 'LAL',
      'celtics': 'BOS',
      'heat': 'MIA',
      'bucks': 'MIL',
      'nets': 'BKN',
      'sixers': 'PHI',
      '76ers': 'PHI',
      'knicks': 'NY',
      'mavs': 'DAL',
      'blazers': 'POR',
      'grizz': 'MEM',
      'grizzlies': 'MEM',
      'spurs': 'SA',
      'thunder': 'OKC',
      'suns': 'PHX',
      'nuggets': 'DEN',
      'jazz': 'UTA',
      'wolves': 'MIN',
      'timberwolves': 'MIN',
    };

    const fuzzyKey = Object.keys(fuzzyMatches).find(k => normalizedQuery.includes(k));
    if (fuzzyKey) {
      return nbaTeams.find(t => t.abbreviation === fuzzyMatches[fuzzyKey]) || null;
    }

    return null;
  };

  const parseTeamInput = (input: string): { teamA: string; teamB: string } | null => {
    // Normalize whitespace
    const normalized = input.trim().replace(/\s+/g, ' ');

    // Try "vs", "vs.", or "versus" pattern
    const vsPattern = /(.+)\s+(?:vs\.?|versus)\s+(.+)/i;
    const vsMatch = normalized.match(vsPattern);
    if (vsMatch) {
      return { teamA: vsMatch[1].trim(), teamB: vsMatch[2].trim() };
    }

    // Try "at" or "@" pattern
    const atPattern = /(.+)\s+(?:at|@)\s+(.+)/i;
    const atMatch = normalized.match(atPattern);
    if (atMatch) {
      return { teamA: atMatch[1].trim(), teamB: atMatch[2].trim() };
    }

    // Try space-separated (e.g., "Lakers Warriors")
    const words = normalized.split(/\s+/);
    if (words.length === 2) {
      return { teamA: words[0], teamB: words[1] };
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !dataLoaded) return;

    const userMessage: Message = {
      id: Date.now(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    await new Promise(resolve => setTimeout(resolve, 300));

    try {
      const teams = parseTeamInput(userMessage.content);

      if (!teams) {
        const errorMessage: Message = {
          id: Date.now() + 1,
          role: 'assistant',
          content: "I couldn't understand the team names. Please use format like:\n\n• Lakers vs Warriors\n• Celtics versus Heat\n• Bucks @ Nets\n• Warriors at Lakers\n\nTry again!",
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, errorMessage]);
        setIsLoading(false);
        return;
      }

      const teamA = findTeam(teams.teamA);
      const teamB = findTeam(teams.teamB);

      if (!teamA || !teamB) {
        const errorContent = `⚠️ Team not found`;

        const suggestions: { teamA?: NBATeamStats[]; teamB?: NBATeamStats[] } = {};
        const notFound: { teamA?: string; teamB?: string } = {};

        // Get suggestions for teams not found
        if (!teamA) {
          suggestions.teamA = getSuggestions(teams.teamA).slice(0, 1);
          notFound.teamA = teams.teamA;
        }

        if (!teamB) {
          suggestions.teamB = getSuggestions(teams.teamB).slice(0, 1);
          notFound.teamB = teams.teamB;
        }

        const errorMessage: Message = {
          id: Date.now() + 1,
          role: 'assistant',
          content: errorContent,
          timestamp: Date.now(),
          suggestions,
          notFound
        };
        setMessages(prev => [...prev, errorMessage]);
        setIsLoading(false);
        return;
      }

      const formatSign = (val: number) => val > 0 ? `+${val}` : val.toString();

      const statsText = `
**${teamA.team} vs ${teamB.team}**

**${teamA.team} (${teamA.abbreviation})**
• PPG: ${teamA.ppg.toFixed(1)}
• PA: ${teamA.allowed.toFixed(1)}
• FG%: ${teamA.fg_pct.toFixed(1)}
• REB: ${formatSign(teamA.rebound_margin)}
• TO: ${formatSign(teamA.turnover_margin)}

**${teamB.team} (${teamB.abbreviation})**
• PPG: ${teamB.ppg.toFixed(1)}
• PA: ${teamB.allowed.toFixed(1)}
• FG%: ${teamB.fg_pct.toFixed(1)}
• REB: ${formatSign(teamB.rebound_margin)}
• TO: ${formatSign(teamB.turnover_margin)}
`;

      const assistantMessage: Message = {
        id: Date.now() + 2,
        role: 'assistant',
        content: statsText,
        timestamp: Date.now(),
        stats: { teamA, teamB }
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      const errorMessage: Message = {
        id: Date.now() + 3,
        role: 'assistant',
        content: `Error: ${error.message}\n\nPlease try again with valid NBA team names.`,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTransfer = (stats: { teamA: NBATeamStats; teamB: NBATeamStats }) => {
    if (onTransferToEstimator) {
      onTransferToEstimator({
        teamPointsFor: stats.teamA.ppg.toString(),
        opponentPointsFor: stats.teamB.ppg.toString(),
        teamPointsAgainst: stats.teamA.allowed.toString(),
        opponentPointsAgainst: stats.teamB.allowed.toString(),
        teamFgPct: stats.teamA.fg_pct.toString(),
        opponentFgPct: stats.teamB.fg_pct.toString(),
        teamReboundMargin: stats.teamA.rebound_margin.toString(),
        opponentReboundMargin: stats.teamB.rebound_margin.toString(),
        teamTurnoverMargin: stats.teamA.turnover_margin.toString(),
        opponentTurnoverMargin: stats.teamB.turnover_margin.toString(),
        teamAName: stats.teamA.abbreviation,
        teamBName: stats.teamB.abbreviation,
      });
    }
  };

  const loadExample = (example: string) => {
    setInput(example);
  };

  const clearChat = () => {
    setMessages([
      {
        id: Date.now(),
        role: 'assistant',
        content: "Chat cleared! Ready to analyze a new NBA matchup. What teams would you like to compare?",
        timestamp: Date.now()
      }
    ]);
  };

  if (loadError) {
    return (
      <div className="sports-matchup-container">
        <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>
          <p>Failed to load NBA stats: {loadError}</p>
          <p style={{ fontSize: '.85rem', color: 'var(--text-muted)' }}>
            Make sure the CSV files exist in the stats/nba folder.
          </p>
        </div>
      </div>
    );
  }

  if (!dataLoaded) {
    return (
      <div className="sports-matchup-container">
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <span className="loading-spinner"></span>
          <p>Loading NBA stats...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sports-matchup-container">
      {/* Quick Examples */}
      <div className="quick-examples">
        <span style={{ fontSize: '.85rem', color: 'var(--text-muted)', marginRight: '.5rem' }}>Quick Examples:</span>
        <button className="example-btn" onClick={() => loadExample('Lakers vs Warriors')}>Lakers vs Warriors</button>
        <button className="example-btn" onClick={() => loadExample('Celtics vs Heat')}>Celtics vs Heat</button>
        <button className="example-btn" onClick={() => loadExample('Bucks vs Nets')}>Bucks vs Nets</button>
      </div>

      {/* Chat Messages */}
      <div className="chat-messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-message ${msg.role}`}>
            <div className="message-header">
              <span className="message-role">
                {msg.role === 'user' ? 'You' : 'NBA Analyst'}
              </span>
              <span className="message-time">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="message-content">
              {msg.content.split('\n').map((line, i) => {
                if (line.includes('**')) {
                  const parts = line.split('**');
                  return (
                    <div key={i}>
                      {parts.map((part, j) =>
                        j % 2 === 1 ? <strong key={j}>{part}</strong> : <span key={j}>{part}</span>
                      )}
                    </div>
                  );
                }
                if (line.startsWith('•')) {
                  return <div key={i} style={{ paddingLeft: '1rem' }}>{line}</div>;
                }
                return <div key={i}>{line || <br />}</div>;
              })}

              {/* Show clickable suggestions if available */}
              {msg.suggestions && (
                <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                  <div style={{ marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    💡 Did you mean:
                  </div>
                  {msg.suggestions.teamA && msg.suggestions.teamA.length > 0 && msg.suggestions.teamB && msg.suggestions.teamB.length > 0 ? (
                    // Both teams have suggestions
                    <button
                      className="btn-primary"
                      onClick={() => {
                        const teamAsuggestion = msg.suggestions!.teamA![0];
                        const teamBsuggestion = msg.suggestions!.teamB![0];
                        setInput(`${teamAsuggestion.team} vs ${teamBsuggestion.team}`);
                      }}
                      style={{ marginTop: '0.5rem', background: 'var(--button-primary)', color: 'white', fontWeight: 500, boxShadow: 'var(--button-glow)', border: 'none' }}
                    >
                      {msg.suggestions.teamA[0].team} vs {msg.suggestions.teamB[0].team}
                    </button>
                  ) : msg.suggestions.teamA && msg.suggestions.teamA.length > 0 ? (
                    // Only teamA has suggestion
                    <div>
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>For "{msg.notFound?.teamA}":</span>
                      <br />
                      <button
                        className="btn-primary"
                        onClick={() => {
                          const suggestion = msg.suggestions!.teamA![0];
                          setInput(`${suggestion.team} vs ${msg.notFound?.teamB || ''}`);
                        }}
                        style={{ marginTop: '0.5rem', background: 'var(--button-primary)', color: 'white', fontWeight: 500, boxShadow: 'var(--button-glow)', border: 'none' }}
                      >
                        {msg.suggestions.teamA[0].team} ({msg.suggestions.teamA[0].abbreviation})
                      </button>
                    </div>
                  ) : msg.suggestions.teamB && msg.suggestions.teamB.length > 0 ? (
                    // Only teamB has suggestion
                    <div>
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>For "{msg.notFound?.teamB}":</span>
                      <br />
                      <button
                        className="btn-primary"
                        onClick={() => {
                          const suggestion = msg.suggestions!.teamB![0];
                          setInput(`${msg.notFound?.teamA || ''} vs ${suggestion.team}`);
                        }}
                        style={{ marginTop: '0.5rem', background: 'var(--button-primary)', color: 'white', fontWeight: 500, boxShadow: 'var(--button-glow)', border: 'none' }}
                      >
                        {msg.suggestions.teamB[0].team} ({msg.suggestions.teamB[0].abbreviation})
                      </button>
                    </div>
                  ) : null}
                </div>
              )}

              {msg.role === 'assistant' && msg.stats && onTransferToEstimator && (
                <button
                  className="btn-primary"
                  onClick={() => handleTransfer(msg.stats!)}
                  style={{ marginTop: '1rem', width: '100%' }}
                >
                  Use in Basketball Probability Estimator
                </button>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="chat-message assistant">
            <div className="message-header">
              <span className="message-role">NBA Analyst</span>
            </div>
            <div className="message-content">
              <span className="loading-spinner"></span>
              Looking up team stats...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="chat-input-form">
        <input
          type="text"
          className="chat-input"
          placeholder="Enter teams (e.g., Lakers vs Warriors)..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isLoading}
        />
        <button type="submit" className="chat-submit-btn" disabled={isLoading || !input.trim()}>
          {isLoading ? '...' : '→'}
        </button>
        {messages.length > 2 && (
          <button type="button" className="clear-chat-btn" onClick={clearChat}>
            Clear
          </button>
        )}
      </form>
    </div>
  );
}
