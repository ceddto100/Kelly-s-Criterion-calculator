/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useRef, useEffect } from 'react';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  stats?: any;
}

interface SportsMatchupProps {
  backendUrl: string;
  onTransferToEstimator?: (matchupData: any) => void;
}

export default function SportsMatchup({ backendUrl, onTransferToEstimator }: SportsMatchupProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      role: 'assistant',
      content: "👋 Hi! I'm your NBA Matchup Analyzer. Enter two teams you want to compare (e.g., 'Lakers vs Warriors' or 'Celtics vs Heat') and I'll analyze their stats and matchup dynamics.",
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

  const parseTeamInput = (input: string): { teamA: string; teamB: string } | null => {
    // Normalize whitespace
    const normalized = input.trim().replace(/\s+/g, ' ');

    // Try "vs", "vs.", or "versus" pattern
    const vsPattern = /(.+)\s+(?:vs\.?|versus)\s+(.+)/i;
    const vsMatch = normalized.match(vsPattern);
    if (vsMatch) {
      return {
        teamA: vsMatch[1].trim(),
        teamB: vsMatch[2].trim()
      };
    }

    // Try "at" or "@" pattern
    const atPattern = /(.+)\s+(?:at|@)\s+(.+)/i;
    const atMatch = normalized.match(atPattern);
    if (atMatch) {
      return {
        teamA: atMatch[1].trim(),
        teamB: atMatch[2].trim()
      };
    }

    // Try space-separated (e.g., "Lakers Warriors")
    const words = normalized.split(/\s+/);
    if (words.length === 2) {
      return {
        teamA: words[0],
        teamB: words[1]
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

    try {
      const teams = parseTeamInput(userMessage.content);

      if (!teams) {
        // If we can't parse, provide helpful feedback
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

      // Fetch matchup analysis
      const response = await fetch(
        `${backendUrl}/api/analyze?teamA=${encodeURIComponent(teams.teamA)}&teamB=${encodeURIComponent(teams.teamB)}`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to fetch matchup data');
      }

      const data = await response.json();

      // Format the response with stats and analysis
      const statsText = `
**${data.teamA} vs ${data.teamB}**

**${data.stats.teamA.team || teams.teamA}**
• Points Per Game: ${data.stats.teamA.points_per_game?.toFixed(1) || 'N/A'}
• Points Allowed: ${data.stats.teamA.points_allowed?.toFixed(1) || 'N/A'}
• Field Goal %: ${data.stats.teamA.field_goal_pct?.toFixed(1) || 'N/A'}%
• Rebound Margin: ${data.stats.teamA.rebound_margin !== null ? (data.stats.teamA.rebound_margin > 0 ? '+' : '') + data.stats.teamA.rebound_margin?.toFixed(1) : 'N/A'}
• Turnover Margin: ${data.stats.teamA.turnover_margin !== null ? (data.stats.teamA.turnover_margin > 0 ? '+' : '') + data.stats.teamA.turnover_margin?.toFixed(1) : 'N/A'}

**${data.stats.teamB.team || teams.teamB}**
• Points Per Game: ${data.stats.teamB.points_per_game?.toFixed(1) || 'N/A'}
• Points Allowed: ${data.stats.teamB.points_allowed?.toFixed(1) || 'N/A'}
• Field Goal %: ${data.stats.teamB.field_goal_pct?.toFixed(1) || 'N/A'}%
• Rebound Margin: ${data.stats.teamB.rebound_margin !== null ? (data.stats.teamB.rebound_margin > 0 ? '+' : '') + data.stats.teamB.rebound_margin?.toFixed(1) : 'N/A'}
• Turnover Margin: ${data.stats.teamB.turnover_margin !== null ? (data.stats.teamB.turnover_margin > 0 ? '+' : '') + data.stats.teamB.turnover_margin?.toFixed(1) : 'N/A'}
${data.analysis ? '\n**AI Analysis:**\n' + data.analysis : ''}
`;

      const assistantMessage: Message = {
        id: Date.now() + 2,
        role: 'assistant',
        content: statsText,
        timestamp: Date.now(),
        stats: data.stats
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      const errorMessage: Message = {
        id: Date.now() + 3,
        role: 'assistant',
        content: `⚠️ Error: ${error.message}\n\nPlease make sure:\n• The team names are spelled correctly\n• You're using current NBA teams\n• The backend server is running\n\nTry teams like: Lakers, Warriors, Celtics, Heat, Bucks, Nets, etc.`,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
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
        content: "Chat cleared! Ready to analyze a new matchup. What teams would you like to compare?",
        timestamp: Date.now()
      }
    ]);
  };

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
                {msg.role === 'user' ? '👤 You' : '🤖 NBA Analyst'}
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
                  onClick={() => onTransferToEstimator(msg.stats)}
                  style={{ marginTop: '1rem', width: '100%' }}
                >
                  📊 Use in Probability Estimator →
                </button>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="chat-message assistant">
            <div className="message-header">
              <span className="message-role">🤖 NBA Analyst</span>
            </div>
            <div className="message-content">
              <span className="loading-spinner"></span>
              Analyzing matchup and fetching live stats from ESPN...
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
