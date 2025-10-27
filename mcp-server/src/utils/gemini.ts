/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Gemini AI integration for betting insights
 */

export interface InsightParams {
  stake: number;
  stakePercentage: number;
  hasValue: boolean;
  bankroll: number;
  odds: number;
  probability: number;
}

/**
 * Generates betting insight using Gemini AI
 * @param params - Calculation parameters
 * @returns AI-generated insight text or empty string on error
 *
 * SECURITY: API key is kept server-side only and never exposed to clients.
 * Only the generated text response is returned to the client.
 */
export async function getAnalystInsight(params: InsightParams): Promise<string> {
  // SECURITY: Load API key from environment (server-side only)
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    return ''; // Skip AI insights if no API key configured
  }

  try {
    const systemInstruction =
      "You are a seasoned betting analyst. Provide brief (1-2 sentences), insightful, and varied explanations for Kelly Criterion recommendations. Your tone should be responsible and clear. Never repeat the same explanation. Focus on the core reason for the recommendation.";

    const userPrompt = params.hasValue
      ? `A user's inputs (Bankroll: $${params.bankroll}, Odds: ${params.odds}, Win Probability: ${params.probability}%) result in a recommended stake of $${params.stake.toFixed(2)} (${params.stakePercentage.toFixed(2)}%). Provide a concise, 1-2 sentence explanation for why this is a good bet according to the Kelly Criterion.`
      : `A user's inputs (Bankroll: $${params.bankroll}, Odds: ${params.odds}, Win Probability: ${params.probability}%) indicate a "No Value" bet. Provide a concise, 1-2 sentence explanation emphasizing bankroll protection.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: userPrompt }]
          }],
          systemInstruction: {
            parts: [{ text: systemInstruction }]
          },
          generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 100,
          }
        })
      }
    );

    if (!response.ok) {
      console.error('Gemini API error:', response.status);
      return '';
    }

    const data = await response.json() as any;
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return text.trim();
  } catch (error) {
    console.error('Error generating insight:', error);
    return '';
  }
}
