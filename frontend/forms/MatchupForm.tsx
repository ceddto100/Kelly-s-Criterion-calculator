import React, { useState, useEffect } from "react";

export default function MatchupForm() {
  const [team1, setTeam1] = useState("");
  const [team2, setTeam2] = useState("");
  const [sport, setSport] = useState("Football");
  const [provider, setProvider] = useState("openai");
  const [result, setResult] = useState("");
  const [sources, setSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState("");

  // Backend URL from environment variable
  // For local development with proxy: use empty string to use relative paths
  // For production: set VITE_BACKEND_URL in Vercel environment variables
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "";

  // Generate or retrieve user ID on component mount
  useEffect(() => {
    let storedUserId = localStorage.getItem("userId");
    if (!storedUserId) {
      storedUserId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem("userId", storedUserId);
    }
    setUserId(storedUserId);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult("");
    setSources([]);

    try {
      const res = await fetch(`${BACKEND_URL}/api/matchup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId
        },
        body: JSON.stringify({
          team1,
          team2,
          sport: sport.toLowerCase(),
          provider
        }),
      });

      const data = await res.json();

      if (data.success && data.data) {
        // Check if response has analysis format (from Responses API)
        if (data.data.analysis) {
          setResult(data.data.analysis);
          setSources(data.data.sources || []);
        } else {
          // Original format (JSON object)
          setResult(JSON.stringify(data.data, null, 2));
        }
      } else if (data.error) {
        setResult(`Error: ${data.message || data.error}`);
      } else {
        setResult("No data returned from the AI service.");
      }
    } catch (error) {
      console.error(error);
      if (!BACKEND_URL && window.location.hostname !== 'localhost') {
        setResult("Backend URL not configured. Please set VITE_BACKEND_URL environment variable in your deployment settings.");
      } else {
        setResult(`Error contacting backend: ${error instanceof Error ? error.message : 'Unknown error'}. This could be a CORS issue or the backend may be down. Please check your environment configuration.`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel" style={{ maxWidth: 900 }}>
      <h2 style={{ marginTop: 0, marginBottom: '1.5rem', textAlign: 'center' }}>
        AI Matchup Analyzer
      </h2>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="input-group">
          <label htmlFor="sport">Sport</label>
          <select
            id="sport"
            value={sport}
            onChange={(e) => setSport(e.target.value)}
            className="input-field"
          >
            <option>Football</option>
            <option>Basketball</option>
          </select>
        </div>

        <div className="input-group">
          <label htmlFor="team1">Your Team</label>
          <input
            id="team1"
            placeholder="e.g., Kansas City Chiefs"
            value={team1}
            onChange={(e) => setTeam1(e.target.value)}
            className="input-field"
            required
          />
        </div>

        <div className="input-group">
          <label htmlFor="team2">Opponent Team</label>
          <input
            id="team2"
            placeholder="e.g., Buffalo Bills"
            value={team2}
            onChange={(e) => setTeam2(e.target.value)}
            className="input-field"
            required
          />
        </div>

        <div className="input-group">
          <label htmlFor="provider">AI Provider</label>
          <select
            id="provider"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="input-field"
          >
            <option value="openai">OpenAI (GPT-4 + ESPN Search)</option>
            <option value="claude">Anthropic Claude</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={loading || !team1 || !team2}
          className="btn-primary"
        >
          {loading ? "Analyzing..." : "Analyze Matchup"}
        </button>
      </form>

      {result && (
        <div className="results" style={{ marginTop: '1.5rem' }}>
          <h3 style={{ marginTop: 0 }}>Analysis Results</h3>
          <div style={{ whiteSpace: 'pre-line', lineHeight: '1.6' }}>
            {result}
          </div>

          {sources.length > 0 && (
            <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
              <h4 style={{ marginTop: 0, marginBottom: '0.75rem' }}>📊 ESPN Sources ({sources.length})</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {sources.map((source: any, index: number) => (
                  <a
                    key={index}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: 'var(--accent-2)',
                      textDecoration: 'none',
                      fontSize: '0.9rem'
                    }}
                  >
                    🔗 {source.title || source.url}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
