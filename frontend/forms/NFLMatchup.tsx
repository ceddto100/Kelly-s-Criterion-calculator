/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useRef, useEffect } from 'react';

// NFL Team Stats interface
interface NFLTeamStats {
  team: string;
  abbreviation: string;
  ppg: number;
  allowed: number;
  off_yards: number;
  def_yards: number;
  turnover_diff: number;
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
    teamA: NFLTeamStats;
    teamB: NFLTeamStats;
  };
}

interface NFLMatchupProps {
  onTransferToEstimator?: (matchupData: any) => void;
}

export default function NFLMatchup({ onTransferToEstimator }: NFLMatchupProps) {
  const [nflTeams, setNflTeams] = useState<NFLTeamStats[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      role: 'assistant',
      content: "Welcome to the NFL Matchup Analyzer! Enter two teams you want to compare (e.g., 'Chiefs vs Bills' or 'Cowboys Eagles') and I'll show their stats for the probability estimator.",
      timestamp: Date.now()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load CSV data on mount
  useEffect(() => {
    async function loadNFLData() {
      try {
        const [ppgRes, allowedRes, offYardsRes, defYardsRes, turnoverRes] = await Promise.all([
          fetch('/stats/nfl_ppg.csv'),
          fetch('/stats/nfl_allowed.csv'),
          fetch('/stats/nfl_off_yards.csv'),
          fetch('/stats/nfl_def_yards.csv'),
          fetch('/stats/nfl_turnover_diff.csv'),
        ]);

        const [ppgCsv, allowedCsv, offYardsCsv, defYardsCsv, turnoverCsv] = await Promise.all([
          ppgRes.text(),
          allowedRes.text(),
          offYardsRes.text(),
          defYardsRes.text(),
          turnoverRes.text(),
        ]);

        const ppgData = parseCsv(ppgCsv);
        const allowedData = parseCsv(allowedCsv);
        const offYardsData = parseCsv(offYardsCsv);
        const defYardsData = parseCsv(defYardsCsv);
        const turnoverData = parseCsv(turnoverCsv);

        const allowedMap = new Map(allowedData.map(d => [d.abbreviation, d.allowed]));
        const offYardsMap = new Map(offYardsData.map(d => [d.abbreviation, d.off_yards]));
        const defYardsMap = new Map(defYardsData.map(d => [d.abbreviation, d.def_yards]));
        const turnoverMap = new Map(turnoverData.map(d => [d.abbreviation, d.turnover_diff]));

        const teams = ppgData.map(team => ({
          team: team.team as string,
          abbreviation: team.abbreviation as string,
          ppg: team.ppg as number,
          allowed: (allowedMap.get(team.abbreviation) as number) || 0,
          off_yards: (offYardsMap.get(team.abbreviation) as number) || 0,
          def_yards: (defYardsMap.get(team.abbreviation) as number) || 0,
          turnover_diff: (turnoverMap.get(team.abbreviation) as number) || 0,
        }));

        setNflTeams(teams);
        setDataLoaded(true);
      } catch (err: any) {
        console.error('Failed to load NFL data:', err);
        setLoadError(err.message || 'Failed to load NFL stats');
      }
    }

    loadNFLData();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Find team by name or abbreviation
  const findTeam = (query: string): NFLTeamStats | null => {
    const normalizedQuery = query.toLowerCase().trim();

    const abbrevMatch = nflTeams.find(t => t.abbreviation.toLowerCase() === normalizedQuery);
    if (abbrevMatch) return abbrevMatch;

    const nameMatch = nflTeams.find(t =>
      t.team.toLowerCase().includes(normalizedQuery) ||
      normalizedQuery.includes(t.team.split(' ').pop()?.toLowerCase() || '')
    );
    if (nameMatch) return nameMatch;

    const fuzzyMatches: { [key: string]: string } = {
      'niners': 'SF',
      '49ers': 'SF',
      'pats': 'NE',
      'cards': 'ARI',
      'pack': 'GB',
      'packers': 'GB',
      'fins': 'MIA',
      'bolts': 'LAC',
      'jags': 'JAX',
      'bucs': 'TB',
      'skins': 'WAS',
      'commanders': 'WAS',
      'vikes': 'MIN',
    };

    const fuzzyKey = Object.keys(fuzzyMatches).find(k => normalizedQuery.includes(k));
    if (fuzzyKey) {
      return nflTeams.find(t => t.abbreviation === fuzzyMatches[fuzzyKey]) || null;
    }

    return null;
  };

  const parseTeamInput = (input: string): { teamA: string; teamB: string } | null => {
    const vsPattern = /(.+)\s+vs\.?\s+(.+)/i;
    const match = input.match(vsPattern);

    if (match) {
      return { teamA: match[1].trim(), teamB: match[2].trim() };
    }

    const words = input.trim().split(/\s+/);
    if (words.length === 2) {
      return { teamA: words[0], teamB: words[1] };
    }

    const atPattern = /(.+)\s+(?:at|@)\s+(.+)/i;
    const atMatch = input.match(atPattern);
    if (atMatch) {
      return { teamA: atMatch[1].trim(), teamB: atMatch[2].trim() };
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
          content: "I couldn't understand the team names. Please use format like:\n\n• Chiefs vs Bills\n• Cowboys vs Eagles\n• Dolphins at Rams\n\nTry again!",
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, errorMessage]);
        setIsLoading(false);
        return;
      }

      const teamA = findTeam(teams.teamA);
      const teamB = findTeam(teams.teamB);

      if (!teamA || !teamB) {
        const notFoundTeam = !teamA ? teams.teamA : teams.teamB;
        const errorMessage: Message = {
          id: Date.now() + 1,
          role: 'assistant',
          content: `Couldn't find team "${notFoundTeam}". Try using the full city name or abbreviation:\n\n• Kansas City Chiefs or KC\n• San Francisco 49ers or SF\n• New England Patriots or NE\n\nAll 32 NFL teams are available!`,
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, errorMessage]);
        setIsLoading(false);
        return;
      }

      const formatSign = (val: number) => val > 0 ? `+${val}` : val.toString();

      const statsText = `
**${teamA.team} vs ${teamB.team}**

**${teamA.team} (${teamA.abbreviation})**
• Points Per Game: ${teamA.ppg.toFixed(1)}
• Points Allowed: ${teamA.allowed.toFixed(1)}
• Offensive Yards/Game: ${teamA.off_yards.toFixed(1)}
• Defensive Yards Allowed: ${teamA.def_yards.toFixed(1)}
• Turnover Differential: ${formatSign(teamA.turnover_diff)}

**${teamB.team} (${teamB.abbreviation})**
• Points Per Game: ${teamB.ppg.toFixed(1)}
• Points Allowed: ${teamB.allowed.toFixed(1)}
• Offensive Yards/Game: ${teamB.off_yards.toFixed(1)}
• Defensive Yards Allowed: ${teamB.def_yards.toFixed(1)}
• Turnover Differential: ${formatSign(teamB.turnover_diff)}
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
        content: `Error: ${error.message}\n\nPlease try again with valid NFL team names.`,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTransfer = (stats: { teamA: NFLTeamStats; teamB: NFLTeamStats }) => {
    if (onTransferToEstimator) {
      onTransferToEstimator({
        teamPointsFor: stats.teamA.ppg.toString(),
        opponentPointsFor: stats.teamB.ppg.toString(),
        teamPointsAgainst: stats.teamA.allowed.toString(),
        opponentPointsAgainst: stats.teamB.allowed.toString(),
        teamOffYards: stats.teamA.off_yards.toString(),
        opponentOffYards: stats.teamB.off_yards.toString(),
        teamDefYards: stats.teamA.def_yards.toString(),
        opponentDefYards: stats.teamB.def_yards.toString(),
        teamTurnoverDiff: stats.teamA.turnover_diff.toString(),
        opponentTurnoverDiff: stats.teamB.turnover_diff.toString(),
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
        content: "Chat cleared! Ready to analyze a new NFL matchup. What teams would you like to compare?",
        timestamp: Date.now()
      }
    ]);
  };

  if (loadError) {
    return (
      <div className="sports-matchup-container">
        <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>
          <p>Failed to load NFL stats: {loadError}</p>
          <p style={{ fontSize: '.85rem', color: 'var(--text-muted)' }}>
            Make sure the CSV files exist in the public/stats folder.
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
          <p>Loading NFL stats...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sports-matchup-container">
      {/* Quick Examples */}
      <div className="quick-examples">
        <span style={{ fontSize: '.85rem', color: 'var(--text-muted)', marginRight: '.5rem' }}>Quick Examples:</span>
        <button className="example-btn" onClick={() => loadExample('Chiefs vs Bills')}>Chiefs vs Bills</button>
        <button className="example-btn" onClick={() => loadExample('Cowboys vs Eagles')}>Cowboys vs Eagles</button>
        <button className="example-btn" onClick={() => loadExample('49ers vs Lions')}>49ers vs Lions</button>
      </div>

      {/* Chat Messages */}
      <div className="chat-messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-message ${msg.role}`}>
            <div className="message-header">
              <span className="message-role">
                {msg.role === 'user' ? 'You' : 'NFL Analyst'}
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
              {msg.role === 'assistant' && msg.stats && onTransferToEstimator && (
                <button
                  className="btn-primary"
                  onClick={() => handleTransfer(msg.stats!)}
                  style={{ marginTop: '1rem', width: '100%' }}
                >
                  Use in Football Probability Estimator
                </button>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="chat-message assistant">
            <div className="message-header">
              <span className="message-role">NFL Analyst</span>
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
          placeholder="Enter teams (e.g., Chiefs vs Bills)..."
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
