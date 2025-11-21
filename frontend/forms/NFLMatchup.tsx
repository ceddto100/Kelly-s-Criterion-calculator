/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useRef, useEffect, useMemo } from 'react';

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

// All 32 NFL teams with placeholder stats (embedded for no backend dependency)
const NFL_TEAMS: NFLTeamStats[] = [
  { team: "Arizona Cardinals", abbreviation: "ARI", ppg: 21.5, allowed: 25.8, off_yards: 325.5, def_yards: 365.8, turnover_diff: -5 },
  { team: "Atlanta Falcons", abbreviation: "ATL", ppg: 24.2, allowed: 24.5, off_yards: 358.2, def_yards: 352.5, turnover_diff: 2 },
  { team: "Baltimore Ravens", abbreviation: "BAL", ppg: 28.5, allowed: 19.2, off_yards: 392.5, def_yards: 298.2, turnover_diff: 12 },
  { team: "Buffalo Bills", abbreviation: "BUF", ppg: 27.8, allowed: 20.1, off_yards: 385.8, def_yards: 312.1, turnover_diff: 8 },
  { team: "Carolina Panthers", abbreviation: "CAR", ppg: 18.9, allowed: 27.2, off_yards: 298.9, def_yards: 378.2, turnover_diff: -8 },
  { team: "Chicago Bears", abbreviation: "CHI", ppg: 20.1, allowed: 23.8, off_yards: 312.1, def_yards: 345.8, turnover_diff: -2 },
  { team: "Cincinnati Bengals", abbreviation: "CIN", ppg: 25.4, allowed: 22.4, off_yards: 365.4, def_yards: 332.4, turnover_diff: 5 },
  { team: "Cleveland Browns", abbreviation: "CLE", ppg: 22.3, allowed: 21.5, off_yards: 342.3, def_yards: 318.5, turnover_diff: 1 },
  { team: "Dallas Cowboys", abbreviation: "DAL", ppg: 26.1, allowed: 23.2, off_yards: 378.1, def_yards: 342.2, turnover_diff: 6 },
  { team: "Denver Broncos", abbreviation: "DEN", ppg: 21.8, allowed: 20.8, off_yards: 328.8, def_yards: 315.8, turnover_diff: 3 },
  { team: "Detroit Lions", abbreviation: "DET", ppg: 29.2, allowed: 21.8, off_yards: 398.2, def_yards: 328.8, turnover_diff: 10 },
  { team: "Green Bay Packers", abbreviation: "GB", ppg: 25.6, allowed: 22.1, off_yards: 362.6, def_yards: 335.1, turnover_diff: 4 },
  { team: "Houston Texans", abbreviation: "HOU", ppg: 26.8, allowed: 21.2, off_yards: 375.8, def_yards: 322.2, turnover_diff: 7 },
  { team: "Indianapolis Colts", abbreviation: "IND", ppg: 22.5, allowed: 24.8, off_yards: 338.5, def_yards: 358.8, turnover_diff: -1 },
  { team: "Jacksonville Jaguars", abbreviation: "JAX", ppg: 21.2, allowed: 23.5, off_yards: 322.2, def_yards: 348.5, turnover_diff: -4 },
  { team: "Kansas City Chiefs", abbreviation: "KC", ppg: 28.9, allowed: 19.8, off_yards: 395.9, def_yards: 305.8, turnover_diff: 11 },
  { team: "Las Vegas Raiders", abbreviation: "LV", ppg: 20.7, allowed: 25.2, off_yards: 318.7, def_yards: 368.2, turnover_diff: -6 },
  { team: "Los Angeles Chargers", abbreviation: "LAC", ppg: 24.8, allowed: 22.8, off_yards: 358.8, def_yards: 342.8, turnover_diff: 2 },
  { team: "Los Angeles Rams", abbreviation: "LAR", ppg: 23.4, allowed: 24.1, off_yards: 345.4, def_yards: 355.1, turnover_diff: -3 },
  { team: "Miami Dolphins", abbreviation: "MIA", ppg: 27.2, allowed: 22.5, off_yards: 388.2, def_yards: 338.5, turnover_diff: 5 },
  { team: "Minnesota Vikings", abbreviation: "MIN", ppg: 24.5, allowed: 21.8, off_yards: 355.5, def_yards: 325.8, turnover_diff: 6 },
  { team: "New England Patriots", abbreviation: "NE", ppg: 19.8, allowed: 22.1, off_yards: 305.8, def_yards: 332.1, turnover_diff: -3 },
  { team: "New Orleans Saints", abbreviation: "NO", ppg: 23.1, allowed: 24.2, off_yards: 342.1, def_yards: 358.2, turnover_diff: 0 },
  { team: "New York Giants", abbreviation: "NYG", ppg: 18.5, allowed: 26.5, off_yards: 295.5, def_yards: 372.5, turnover_diff: -7 },
  { team: "New York Jets", abbreviation: "NYJ", ppg: 19.2, allowed: 24.8, off_yards: 302.2, def_yards: 365.8, turnover_diff: -5 },
  { team: "Philadelphia Eagles", abbreviation: "PHI", ppg: 26.5, allowed: 20.2, off_yards: 372.5, def_yards: 308.2, turnover_diff: 9 },
  { team: "Pittsburgh Steelers", abbreviation: "PIT", ppg: 22.8, allowed: 21.2, off_yards: 335.8, def_yards: 318.2, turnover_diff: 4 },
  { team: "San Francisco 49ers", abbreviation: "SF", ppg: 27.5, allowed: 18.5, off_yards: 382.5, def_yards: 285.5, turnover_diff: 13 },
  { team: "Seattle Seahawks", abbreviation: "SEA", ppg: 24.1, allowed: 23.8, off_yards: 352.1, def_yards: 348.8, turnover_diff: 1 },
  { team: "Tampa Bay Buccaneers", abbreviation: "TB", ppg: 25.2, allowed: 22.8, off_yards: 365.2, def_yards: 338.8, turnover_diff: 3 },
  { team: "Tennessee Titans", abbreviation: "TEN", ppg: 21.6, allowed: 25.1, off_yards: 328.6, def_yards: 362.1, turnover_diff: -4 },
  { team: "Washington Commanders", abbreviation: "WAS", ppg: 23.8, allowed: 23.5, off_yards: 348.8, def_yards: 345.5, turnover_diff: 2 },
];

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Find team by name or abbreviation
  const findTeam = (query: string): NFLTeamStats | null => {
    const normalizedQuery = query.toLowerCase().trim();

    // Try exact abbreviation match first
    const abbrevMatch = NFL_TEAMS.find(t => t.abbreviation.toLowerCase() === normalizedQuery);
    if (abbrevMatch) return abbrevMatch;

    // Try team name contains (e.g., "Chiefs" matches "Kansas City Chiefs")
    const nameMatch = NFL_TEAMS.find(t =>
      t.team.toLowerCase().includes(normalizedQuery) ||
      normalizedQuery.includes(t.team.split(' ').pop()?.toLowerCase() || '')
    );
    if (nameMatch) return nameMatch;

    // Try fuzzy matching for common names
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
      return NFL_TEAMS.find(t => t.abbreviation === fuzzyMatches[fuzzyKey]) || null;
    }

    return null;
  };

  const parseTeamInput = (input: string): { teamA: string; teamB: string } | null => {
    // Try to parse input like "Chiefs vs Bills" or "Cowboys Eagles"
    const vsPattern = /(.+)\s+vs\.?\s+(.+)/i;
    const match = input.match(vsPattern);

    if (match) {
      return {
        teamA: match[1].trim(),
        teamB: match[2].trim()
      };
    }

    // Try space-separated (e.g., "Cowboys Eagles")
    const words = input.trim().split(/\s+/);
    if (words.length === 2) {
      return {
        teamA: words[0],
        teamB: words[1]
      };
    }

    // Try with "at" or "@" (e.g., "Chiefs at Bills")
    const atPattern = /(.+)\s+(?:at|@)\s+(.+)/i;
    const atMatch = input.match(atPattern);
    if (atMatch) {
      return {
        teamA: atMatch[1].trim(),
        teamB: atMatch[2].trim()
      };
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Simulate brief loading for UX
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

      // Format the response with stats
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
      // Transform to football estimator format
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
                // Bold text between **
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
                // Bullet points
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
