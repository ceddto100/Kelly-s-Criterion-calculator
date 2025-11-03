import React, { useState } from "react";

export default function MatchupForm() {
  const [team1, setTeam1] = useState("");
  const [team2, setTeam2] = useState("");
  const [sport, setSport] = useState("Football");
  const [provider, setProvider] = useState("openai");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  // 🔹 Change this to your Render backend URL
  // For development, you can use relative path if both are on same domain
  // For production, use your actual Render URL
  const BACKEND_URL = process.env.VITE_BACKEND_URL || "https://your-render-backend-url.onrender.com";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult("");

    try {
      const res = await fetch(`${BACKEND_URL}/api/matchup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team1,
          team2,
          sport: sport.toLowerCase(),
          provider
        }),
      });

      const data = await res.json();

      if (data.success && data.data) {
        // Format the AI response nicely
        setResult(data.data);
      } else if (data.error) {
        setResult(`Error: ${data.message || data.error}`);
      } else {
        setResult("No data returned from the AI service.");
      }
    } catch (error) {
      console.error(error);
      setResult("Error contacting backend. Please ensure your backend is running.");
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
            <option value="openai">OpenAI (GPT-4)</option>
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
        </div>
      )}
    </div>
  );
}
