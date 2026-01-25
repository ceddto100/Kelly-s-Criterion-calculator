/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useRef, useEffect } from 'react';

// NHL Team Stats interface
interface NHLTeamStats {
  team: string;
  abbreviation: string;
  xgf60: number;      // Expected Goals For per 60 minutes
  xga60: number;      // Expected Goals Against per 60 minutes
  gsax60: number;     // Goalie Goals Saved Above Expected per 60 minutes
  hdcf60: number;     // High Danger Chances For per 60 minutes
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
    homeTeam: NHLTeamStats;
    awayTeam: NHLTeamStats;
  };
  suggestions?: {
    teamA?: NHLTeamStats[];
    teamB?: NHLTeamStats[];
  };
  notFound?: {
    teamA?: string;
    teamB?: string;
  };
}

interface NHLMatchupProps {
  onTransferToEstimator?: (matchupData: any) => void;
}

export default function NHLMatchup({ onTransferToEstimator }: NHLMatchupProps) {
  const [nhlTeams, setNhlTeams] = useState<NHLTeamStats[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      role: 'assistant',
      content: "Welcome to the NHL Matchup Analyzer! Enter two teams to compare (e.g., 'Maple Leafs @ Bruins' or 'Oilers vs Avalanche'). Use '@' or 'at' to indicate the home team (second team is home), or 'vs' for neutral comparison.\n\nI'll load team stats and you can transfer them to the Probability Estimator to calculate over/under probability.",
      timestamp: Date.now()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load CSV data on mount
  useEffect(() => {
    async function loadNHLData() {
      try {
        console.log('Loading NHL stats from /stats/nhl/...');

        const [xgfRes, xgaRes, gsaxRes, hdcfRes] = await Promise.all([
          fetch('/stats/nhl/nhl_xgf60.csv'),
          fetch('/stats/nhl/nhl_xga60.csv'),
          fetch('/stats/nhl/nhl_gsax60.csv'),
          fetch('/stats/nhl/nhl_hdcf60.csv'),
        ]);

        // Check if any fetch failed
        if (!xgfRes.ok) throw new Error(`Failed to fetch xGF stats: ${xgfRes.status}`);
        if (!xgaRes.ok) throw new Error(`Failed to fetch xGA stats: ${xgaRes.status}`);
        if (!gsaxRes.ok) throw new Error(`Failed to fetch GSAx stats: ${gsaxRes.status}`);
        if (!hdcfRes.ok) throw new Error(`Failed to fetch HDCF stats: ${hdcfRes.status}`);

        const [xgfCsv, xgaCsv, gsaxCsv, hdcfCsv] = await Promise.all([
          xgfRes.text(),
          xgaRes.text(),
          gsaxRes.text(),
          hdcfRes.text(),
        ]);

        console.log('CSV files loaded, parsing...');

        const xgfData = parseCsv(xgfCsv);
        const xgaData = parseCsv(xgaCsv);
        const gsaxData = parseCsv(gsaxCsv);
        const hdcfData = parseCsv(hdcfCsv);

        const xgaMap = new Map(xgaData.map(d => [d.abbreviation, d.xga60]));
        const gsaxMap = new Map(gsaxData.map(d => [d.abbreviation, d.gsax60]));
        const hdcfMap = new Map(hdcfData.map(d => [d.abbreviation, d.hdcf60]));

        const teams = xgfData.map(team => ({
          team: team.team as string,
          abbreviation: team.abbreviation as string,
          xgf60: team.xgf60 as number,
          xga60: (xgaMap.get(team.abbreviation) as number) || 0,
          gsax60: (gsaxMap.get(team.abbreviation) as number) || 0,
          hdcf60: (hdcfMap.get(team.abbreviation) as number) || 0,
        }));

        console.log(`Loaded ${teams.length} NHL teams`);
        setNhlTeams(teams);
        setDataLoaded(true);
      } catch (err: any) {
        console.error('Failed to load NHL data:', err);
        setLoadError(err.message || 'Failed to load NHL stats');
      }
    }

    loadNHLData();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Simple string similarity calculator
  const calculateSimilarity = (str1: string, str2: string): number => {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();

    if (s1 === s2) return 1;
    if (s1.includes(s2) || s2.includes(s1)) return 0.8;

    const len1 = s1.length;
    const len2 = s2.length;
    let matches = 0;

    for (let i = 0; i < Math.min(len1, len2); i++) {
      if (s1[i] === s2[i]) matches++;
    }

    return matches / Math.max(len1, len2);
  };

  // Get team suggestions based on similarity
  const getSuggestions = (query: string): NHLTeamStats[] => {
    const normalizedQuery = query.toLowerCase().trim();

    const scored = nhlTeams.map(team => {
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
  const findTeam = (query: string): NHLTeamStats | null => {
    const normalizedQuery = query.toLowerCase().trim();

    const abbrevMatch = nhlTeams.find(t => t.abbreviation.toLowerCase() === normalizedQuery);
    if (abbrevMatch) return abbrevMatch;

    const nameMatch = nhlTeams.find(t =>
      t.team.toLowerCase().includes(normalizedQuery) ||
      normalizedQuery.includes(t.team.split(' ').pop()?.toLowerCase() || '')
    );
    if (nameMatch) return nameMatch;

    // Common NHL nicknames
    const fuzzyMatches: { [key: string]: string } = {
      'leafs': 'TOR',
      'maple leafs': 'TOR',
      'habs': 'MTL',
      'canadiens': 'MTL',
      'sens': 'OTT',
      'hawks': 'CHI',
      'blackhawks': 'CHI',
      'avs': 'COL',
      'pens': 'PIT',
      'bolts': 'TBL',
      'lightning': 'TBL',
      'knights': 'VGK',
      'golden knights': 'VGK',
      'vegas': 'VGK',
      'wings': 'DET',
      'red wings': 'DET',
      'jackets': 'CBJ',
      'blue jackets': 'CBJ',
      'devils': 'NJD',
      'rangers': 'NYR',
      'isles': 'NYI',
      'islanders': 'NYI',
      'flyers': 'PHI',
      'caps': 'WSH',
      'capitals': 'WSH',
      'bruins': 'BOS',
      'sabres': 'BUF',
      'flames': 'CGY',
      'canes': 'CAR',
      'hurricanes': 'CAR',
      'stars': 'DAL',
      'oilers': 'EDM',
      'panthers': 'FLA',
      'kings': 'LAK',
      'wild': 'MIN',
      'preds': 'NSH',
      'predators': 'NSH',
      'sharks': 'SJS',
      'kraken': 'SEA',
      'blues': 'STL',
      'canucks': 'VAN',
      'jets': 'WPG',
      'ducks': 'ANA',
      'utah': 'UTAH',
      'hockey club': 'UTAH',
    };

    const fuzzyKey = Object.keys(fuzzyMatches).find(k => normalizedQuery.includes(k));
    if (fuzzyKey) {
      return nhlTeams.find(t => t.abbreviation === fuzzyMatches[fuzzyKey]) || null;
    }

    return null;
  };

  // Parse team input - supports "vs", "at", "@" patterns
  const parseTeamInput = (input: string): { teamA: string; teamB: string; isTeamAHome: boolean | null } | null => {
    const normalized = input.trim().replace(/\s+/g, ' ');

    // Try "at" or "@" pattern (first team is away, second is home)
    const atPattern = /(.+)\s+(?:at|@)\s+(.+)/i;
    const atMatch = normalized.match(atPattern);
    if (atMatch) {
      return {
        teamA: atMatch[1].trim(),  // Away team
        teamB: atMatch[2].trim(),  // Home team
        isTeamAHome: false
      };
    }

    // Try "vs", "vs.", or "versus" pattern
    const vsPattern = /(.+)\s+(?:vs\.?|versus)\s+(.+)/i;
    const vsMatch = normalized.match(vsPattern);
    if (vsMatch) {
      return {
        teamA: vsMatch[1].trim(),
        teamB: vsMatch[2].trim(),
        isTeamAHome: true
      };
    }

    // Try space-separated
    const words = normalized.split(/\s+/);
    if (words.length === 2) {
      return {
        teamA: words[0],
        teamB: words[1],
        isTeamAHome: true
      };
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
          content: "I couldn't understand the team names. Please use format like:\n\n- Oilers @ Avalanche (Oilers away, Avs home)\n- Maple Leafs at Bruins\n- Panthers vs Lightning\n- Rangers Islanders\n\nTry again!",
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, errorMessage]);
        setIsLoading(false);
        return;
      }

      const teamA = findTeam(teams.teamA);
      const teamB = findTeam(teams.teamB);

      if (!teamA || !teamB) {
        const suggestions: { teamA?: NHLTeamStats[]; teamB?: NHLTeamStats[] } = {};
        const notFound: { teamA?: string; teamB?: string } = {};

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
          content: `Team not found`,
          timestamp: Date.now(),
          suggestions,
          notFound
        };
        setMessages(prev => [...prev, errorMessage]);
        setIsLoading(false);
        return;
      }

      // Determine home/away teams
      const homeTeam = teams.isTeamAHome ? teamA : teamB;
      const awayTeam = teams.isTeamAHome ? teamB : teamA;

      const formatSign = (val: number) => val > 0 ? `+${val.toFixed(2)}` : val.toFixed(2);

      const statsText = `
**${awayTeam.team} @ ${homeTeam.team}**

**${homeTeam.team} (${homeTeam.abbreviation}) - HOME**
- xGF/60: ${homeTeam.xgf60.toFixed(2)}
- xGA/60: ${homeTeam.xga60.toFixed(2)}
- GSAx/60: ${formatSign(homeTeam.gsax60)}
- HDCF/60: ${homeTeam.hdcf60.toFixed(1)}

**${awayTeam.team} (${awayTeam.abbreviation}) - AWAY**
- xGF/60: ${awayTeam.xgf60.toFixed(2)}
- xGA/60: ${awayTeam.xga60.toFixed(2)}
- GSAx/60: ${formatSign(awayTeam.gsax60)}
- HDCF/60: ${awayTeam.hdcf60.toFixed(1)}

Click "Transfer to Estimator" to calculate over/under probability.
`;

      const assistantMessage: Message = {
        id: Date.now() + 2,
        role: 'assistant',
        content: statsText,
        timestamp: Date.now(),
        stats: {
          homeTeam,
          awayTeam
        }
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      const errorMessage: Message = {
        id: Date.now() + 3,
        role: 'assistant',
        content: `Error: ${error.message}\n\nPlease try again with valid NHL team names.`,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTransfer = (stats: Message['stats']) => {
    if (onTransferToEstimator && stats) {
      onTransferToEstimator({
        homeXgf60: stats.homeTeam.xgf60,
        homeXga60: stats.homeTeam.xga60,
        homeGsax60: stats.homeTeam.gsax60,
        homeHdcf60: stats.homeTeam.hdcf60,
        awayXgf60: stats.awayTeam.xgf60,
        awayXga60: stats.awayTeam.xga60,
        awayGsax60: stats.awayTeam.gsax60,
        awayHdcf60: stats.awayTeam.hdcf60,
        homeTeamName: stats.homeTeam.abbreviation,
        awayTeamName: stats.awayTeam.abbreviation,
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
        content: "Chat cleared! Ready to analyze a new NHL matchup. What teams would you like to compare?",
        timestamp: Date.now()
      }
    ]);
  };

  if (loadError) {
    return (
      <div className="sports-matchup-container">
        <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>
          <p>Failed to load NHL stats: {loadError}</p>
          <p style={{ fontSize: '.85rem', color: 'var(--text-muted)' }}>
            Make sure the CSV files exist in the public/stats/nhl folder.
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
          <p>Loading NHL stats...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sports-matchup-container">
      {/* Quick Examples */}
      <div className="quick-examples">
        <span style={{ fontSize: '.85rem', color: 'var(--text-muted)', marginRight: '.5rem' }}>Quick Examples:</span>
        <button className="example-btn" onClick={() => loadExample('Oilers @ Avalanche')}>Oilers @ Avalanche</button>
        <button className="example-btn" onClick={() => loadExample('Leafs at Bruins')}>Leafs at Bruins</button>
        <button className="example-btn" onClick={() => loadExample('Panthers vs Lightning')}>Panthers vs Lightning</button>
      </div>

      {/* Chat Messages */}
      <div className="chat-messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-message ${msg.role}`}>
            <div className="message-header">
              <span className="message-role">
                {msg.role === 'user' ? 'You' : 'NHL Analyst'}
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
                if (line.startsWith('-')) {
                  return <div key={i} style={{ paddingLeft: '1rem' }}>{line}</div>;
                }
                if (line.startsWith('*') && line.endsWith('*')) {
                  return <div key={i} style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.9rem' }}>{line.slice(1, -1)}</div>;
                }
                if (line === '---') {
                  return <hr key={i} style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', margin: '0.75rem 0' }} />;
                }
                return <div key={i}>{line || <br />}</div>;
              })}

              {/* Show clickable suggestions if available */}
              {msg.suggestions && (
                <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                  <div style={{ marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Did you mean:
                  </div>
                  {msg.suggestions.teamA && msg.suggestions.teamA.length > 0 && msg.suggestions.teamB && msg.suggestions.teamB.length > 0 ? (
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
                  onClick={() => handleTransfer(msg.stats)}
                  style={{ marginTop: '1rem', width: '100%' }}
                >
                  Transfer to Estimator
                </button>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="chat-message assistant">
            <div className="message-header">
              <span className="message-role">NHL Analyst</span>
            </div>
            <div className="message-content">
              <span className="loading-spinner"></span>
              Analyzing matchup...
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
          placeholder="Enter teams (e.g., Oilers @ Avalanche)..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isLoading}
        />
        <button type="submit" className="chat-submit-btn" disabled={isLoading || !input.trim()}>
          {isLoading ? '...' : 'Go'}
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
