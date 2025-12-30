import React, { useState } from 'react';

type BetgisticsWidgetProps = {
  apiEndpoint?: string;
};

type FormDataState = {
  userText: string;
  bankroll: string;
  americanOdds: string;
  kellyFraction: string;
  logBet: boolean;
  userId: string;
};

type AnalysisResult = {
  coverProbability: number;
  impliedProbability: number;
  edge: number;
  recommendedStake: number;
  expectedPayout: number;
  logged: boolean;
  betId?: string;
  teamA?: string;
  teamB?: string;
  spread?: number | null;
  americanOdds?: number;
};

type ApiResponse = Partial<{
  calculatedProbability: number;
  impliedProbability: number;
  edge: number;
  recommendedStake: number;
  expectedPayout: number;
  americanOdds: number;
  betId: string;
  pointSpread: number;
  spread: number;
  teamA: { name?: string } | string;
  teamB: { name?: string } | string;
  logged: boolean;
}>;

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const withFallback = (value: unknown, fallback: number): number => {
  const parsed = toNumber(value);
  return parsed === null ? fallback : parsed;
};

const SparklesIcon: React.FC<React.SVGProps<SVGSVGElement>> = props => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M12 3 10.2 8.5 4.5 10.2l5.7 1.7L12 17.5l1.8-5.6 5.7-1.7-5.7-1.7Z" />
    <path d="M5 19.5 4.2 22l-2.5.8 2.5.8.8 2.5.8-2.5 2.5-.8-2.5-.8Z" />
    <path d="M19 2.5 18.2 5l-2.5.8 2.5.8.8 2.5.8-2.5 2.5-.8-2.5-.8Z" />
  </svg>
);

const calculateExpectedPayout = (stake: number, americanOdds: number): number => {
  if (!Number.isFinite(stake) || !Number.isFinite(americanOdds)) {
    return 0;
  }

  const oddsRatio = americanOdds > 0 ? americanOdds / 100 : 100 / Math.abs(americanOdds || 1);
  return stake * (1 + oddsRatio);
};

const BetgisticsWidget: React.FC<BetgisticsWidgetProps> = ({ apiEndpoint = '/api/analyze-matchup' }) => {
  const [formData, setFormData] = useState<FormDataState>({
    userText: '',
    bankroll: '1000',
    americanOdds: '-110',
    kellyFraction: '0.5',
    logBet: true,
    userId: ''
  });

  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    if (error) {
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        userText: formData.userText,
        bankroll: parseFloat(formData.bankroll),
        americanOdds: parseFloat(formData.americanOdds),
        kellyFraction: parseFloat(formData.kellyFraction),
        logBet: formData.logBet,
        userId: formData.userId || undefined
      };

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = (await response.json()) as ApiResponse;
      const americanOdds = withFallback(data.americanOdds, payload.americanOdds);
      const recommendedStake = withFallback(data.recommendedStake, 0);
      const coverProbability = withFallback(
        data.calculatedProbability,
        withFallback((data as Record<string, unknown>).coverProbability, 0)
      );
      const impliedProbability = withFallback(data.impliedProbability, 0);
      const edge = withFallback(data.edge, coverProbability - impliedProbability);
      const expectedPayout = withFallback(
        data.expectedPayout,
        calculateExpectedPayout(recommendedStake, americanOdds || payload.americanOdds)
      );

      setResult({
        coverProbability,
        impliedProbability,
        edge,
        recommendedStake,
        expectedPayout,
        logged: typeof data.logged === 'boolean' ? data.logged : formData.logBet,
        betId: typeof data.betId === 'string' ? data.betId : undefined,
        teamA: typeof data.teamA === 'string' ? data.teamA : data.teamA?.name,
        teamB: typeof data.teamB === 'string' ? data.teamB : data.teamB?.name,
        spread: toNumber(data.pointSpread ?? data.spread),
        americanOdds
      });
    } catch (err) {
      console.error('Error analyzing bet:', err);
      setError(err instanceof Error ? err.message : 'Failed to analyze bet. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      userText: '',
      bankroll: '1000',
      americanOdds: '-110',
      kellyFraction: '0.5',
      logBet: true,
      userId: ''
    });
    setResult(null);
    setError(null);
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
      <div
        className="p-6"
        style={{
          background: 'linear-gradient(135deg, #0ea5e9, #312e81)'
        }}
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-white bg-opacity-20 flex items-center justify-center">
            <SparklesIcon className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-white text-xl font-semibold">Betgistics</h1>
            <p className="text-white text-sm opacity-90">
              Insert game details such as team names, point spread, venue (Away/Home) for a prediction
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div>
          <textarea
            name="userText"
            value={formData.userText}
            onChange={handleInputChange}
            placeholder="NFL — Bills vs Jets, Bills -2.5, backing Bills at -110. Bankroll $1000."
            required
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bankroll ($)</label>
            <input
              type="number"
              step="0.01"
              name="bankroll"
              value={formData.bankroll}
              onChange={handleInputChange}
              placeholder="1000"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">American odds</label>
            <input
              type="number"
              name="americanOdds"
              value={formData.americanOdds}
              onChange={handleInputChange}
              placeholder="-110"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kelly fraction</label>
            <input
              type="number"
              step="0.01"
              name="kellyFraction"
              value={formData.kellyFraction}
              onChange={handleInputChange}
              placeholder="0.5"
              min="0.1"
              max="1"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="logBet"
              checked={formData.logBet}
              onChange={handleInputChange}
              className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Log bet</span>
          </label>

          <div className="flex-1 hidden sm:block" />

          <input
            type="text"
            name="userId"
            value={formData.userId}
            onChange={handleInputChange}
            placeholder="@handle (optional)"
            className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />

          <div className="flex gap-2 w-full sm:w-auto">
            {result && (
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 sm:flex-none px-4 py-2 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition-colors"
              >
                Reset
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="flex-1 sm:flex-none px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Analyzing...' : 'Analyze & Log'}
            </button>
          </div>
        </div>

        <div className="border-t border-gray-200" />

        <p className="text-sm text-gray-500">
          After submit: you&apos;ll get cover %, implied %, edge, stake, payout, and logging status.
        </p>

        {result && (
          <div className="mt-6 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
            <div className="flex justify-between items-start mb-4">
              <h3 className="font-semibold text-gray-900 text-lg">📊 Analysis Results</h3>
              {result.betId && (
                <span className="text-xs text-gray-500 font-mono">ID: {result.betId.slice(0, 8)}...</span>
              )}
            </div>

            {(result.teamA || result.teamB) && (
              <div className="mb-4 p-3 bg-white rounded-lg">
                <p className="text-sm font-medium text-gray-700">
                  {result.teamA || 'Team A'} vs {result.teamB || 'Team B'}
                  {typeof result.spread === 'number' && !Number.isNaN(result.spread)
                    ? ` (${result.spread > 0 ? '+' : ''}${result.spread})`
                    : ''}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="flex justify-between p-3 bg-white rounded-lg shadow-sm">
                <span className="text-gray-600 font-medium">Cover Probability:</span>
                <span className="font-bold text-gray-900">{result.coverProbability.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between p-3 bg-white rounded-lg shadow-sm">
                <span className="text-gray-600 font-medium">Implied Probability:</span>
                <span className="font-bold text-gray-900">{result.impliedProbability.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between p-3 bg-white rounded-lg shadow-sm">
                <span className="text-gray-600 font-medium">Edge:</span>
                <span className={`font-bold ${result.edge > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {result.edge > 0 ? '+' : ''}
                  {result.edge.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between p-3 bg-white rounded-lg shadow-sm">
                <span className="text-gray-600 font-medium">Recommended Stake:</span>
                <span className="font-bold text-gray-900">${result.recommendedStake.toFixed(2)}</span>
              </div>
              <div className="flex justify-between p-3 bg-white rounded-lg shadow-sm">
                <span className="text-gray-600 font-medium">Expected Payout:</span>
                <span className="font-bold text-gray-900">${result.expectedPayout.toFixed(2)}</span>
              </div>
              <div className="flex justify-between p-3 bg-white rounded-lg shadow-sm">
                <span className="text-gray-600 font-medium">Logging Status:</span>
                <span className={`font-bold ${result.logged ? 'text-green-600' : 'text-gray-500'}`}>
                  {result.logged ? '✓ Logged' : '✗ Not Logged'}
                </span>
              </div>
            </div>

            {result.edge > 0 && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800">
                  <span className="font-semibold">Positive Edge Detected:</span> This bet shows value based on your
                  estimated probability vs implied odds.
                </p>
              </div>
            )}
            {result.edge < 0 && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <span className="font-semibold">Negative Edge:</span> The implied probability is higher than your
                  estimated probability. Consider avoiding this bet.
                </p>
              </div>
            )}
          </div>
        )}
      </form>
    </div>
  );
};

export default BetgisticsWidget;
