/**
 * Google Gemini AI configuration for betting analysis
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

let genAI: GoogleGenerativeAI | null = null;
let model: GenerativeModel | null = null;

/**
 * Initialize Gemini AI client
 */
export function initializeGemini(): GenerativeModel {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }

  if (!genAI) {
    genAI = new GoogleGenerativeAI(apiKey);
  }

  if (!model) {
    model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 600,
        topP: 0.8,
        topK: 40
      }
    });
  }

  return model;
}

/**
 * Get initialized Gemini model
 */
export function getGeminiModel(): GenerativeModel {
  if (!model) {
    return initializeGemini();
  }
  return model;
}

/**
 * Check if Gemini is configured
 */
export function isGeminiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

/**
 * System instruction for betting analysis
 */
export const BETTING_ANALYST_INSTRUCTION = `You are a professional sports betting analyst for Betgistics.
You provide objective, data-driven analysis for sports betting decisions.

Guidelines:
- Always be objective and avoid emotional language
- Focus on statistical factors and historical trends
- Acknowledge uncertainty and variance in sports
- Never guarantee outcomes
- Provide probability estimates based on available data
- Consider factors like injuries, weather, venue, and recent form
- Format responses as structured JSON when requested`;

/**
 * Generate betting analysis using Gemini
 */
export async function generateBettingAnalysis(prompt: string): Promise<string> {
  const geminiModel = getGeminiModel();

  const result = await geminiModel.generateContent({
    contents: [{
      role: 'user',
      parts: [{ text: prompt }]
    }],
    systemInstruction: BETTING_ANALYST_INSTRUCTION
  });

  const response = result.response;
  return response.text();
}

/**
 * Generate probability estimate for a matchup
 */
export async function estimateProbabilityAI(
  sport: string,
  teamA: string,
  teamB: string,
  spread: number,
  venue: 'home' | 'away' | 'neutral',
  additionalContext?: string
): Promise<AIProbabilityResult> {
  const prompt = `Analyze this ${sport} matchup and estimate the probability that ${teamA} covers a ${spread} point spread against ${teamB}.

Venue: ${teamA} is playing ${venue === 'home' ? 'at home' : venue === 'away' ? 'on the road' : 'at a neutral site'}
${additionalContext ? `Additional context: ${additionalContext}` : ''}

Respond with ONLY a JSON object in this exact format (no markdown, no explanation):
{
  "probability": <number between 1-99>,
  "confidence": "<low|medium|high>",
  "keyFactors": ["<factor1>", "<factor2>", "<factor3>"],
  "analysis": "<2-3 sentence analysis>"
}`;

  const geminiModel = getGeminiModel();

  const result = await geminiModel.generateContent({
    contents: [{
      role: 'user',
      parts: [{ text: prompt }]
    }],
    systemInstruction: BETTING_ANALYST_INSTRUCTION
  });

  const responseText = result.response.text();

  try {
    // Extract JSON from response (handle potential markdown wrapping)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]) as AIProbabilityResult;

    // Validate probability is in range
    parsed.probability = Math.max(1, Math.min(99, parsed.probability));

    return parsed;
  } catch (error) {
    console.error('[Gemini] Failed to parse response:', responseText);
    throw new Error(`Failed to parse AI response: ${error}`);
  }
}

export interface AIProbabilityResult {
  probability: number;
  confidence: 'low' | 'medium' | 'high';
  keyFactors: string[];
  analysis: string;
}

/**
 * Generate detailed matchup analysis
 */
export async function analyzeMatchup(
  sport: string,
  teamA: { name: string; stats?: Record<string, number> },
  teamB: { name: string; stats?: Record<string, number> },
  spread?: number
): Promise<MatchupAnalysis> {
  const statsContextA = teamA.stats
    ? Object.entries(teamA.stats).map(([k, v]) => `${k}: ${v}`).join(', ')
    : 'No stats available';
  const statsContextB = teamB.stats
    ? Object.entries(teamB.stats).map(([k, v]) => `${k}: ${v}`).join(', ')
    : 'No stats available';

  const prompt = `Analyze this ${sport} matchup between ${teamA.name} and ${teamB.name}.

${teamA.name} stats: ${statsContextA}
${teamB.name} stats: ${statsContextB}
${spread !== undefined ? `Point spread: ${teamA.name} ${spread > 0 ? '+' : ''}${spread}` : ''}

Provide a comprehensive analysis. Respond with ONLY a JSON object in this exact format:
{
  "favoredTeam": "<team name>",
  "predictedMargin": <number>,
  "probability": <number 1-99>,
  "keyMatchups": ["<matchup1>", "<matchup2>", "<matchup3>"],
  "teamAStrengths": ["<strength1>", "<strength2>"],
  "teamAWeaknesses": ["<weakness1>", "<weakness2>"],
  "teamBStrengths": ["<strength1>", "<strength2>"],
  "teamBWeaknesses": ["<weakness1>", "<weakness2>"],
  "bettingInsight": "<2-3 sentence betting recommendation>",
  "confidence": "<low|medium|high>"
}`;

  const geminiModel = getGeminiModel();

  const result = await geminiModel.generateContent({
    contents: [{
      role: 'user',
      parts: [{ text: prompt }]
    }],
    systemInstruction: BETTING_ANALYST_INSTRUCTION
  });

  const responseText = result.response.text();

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    return JSON.parse(jsonMatch[0]) as MatchupAnalysis;
  } catch (error) {
    console.error('[Gemini] Failed to parse matchup analysis:', responseText);
    throw new Error(`Failed to parse AI matchup analysis: ${error}`);
  }
}

export interface MatchupAnalysis {
  favoredTeam: string;
  predictedMargin: number;
  probability: number;
  keyMatchups: string[];
  teamAStrengths: string[];
  teamAWeaknesses: string[];
  teamBStrengths: string[];
  teamBWeaknesses: string[];
  bettingInsight: string;
  confidence: 'low' | 'medium' | 'high';
}
