/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Internationalization (i18n) support for MCP server
 */

// Supported locales
export const SUPPORTED_LOCALES = [
  'en',    // English
  'en-US', // English (United States)
  'en-GB', // English (United Kingdom)
  'es',    // Spanish
  'es-ES', // Spanish (Spain)
  'es-419', // Spanish (Latin America)
  'fr',    // French
  'de',    // German
  'ja',    // Japanese
  'zh',    // Chinese
  'pt',    // Portuguese
  'it',    // Italian
];

// Translation dictionaries
type TranslationKey =
  // Kelly Calculator
  | 'kelly_calculating'
  | 'kelly_calculated'
  | 'kelly_stake_text'
  | 'kelly_no_value'
  | 'kelly_analyst_insight'
  // Probability Estimator
  | 'probability_estimating'
  | 'probability_estimated'
  | 'probability_result_text'
  | 'probability_predicted_margin'
  | 'probability_use_with_kelly'
  // Common
  | 'bankroll'
  | 'stake'
  | 'percentage'
  | 'odds'
  | 'probability'
  | 'spread'
  // Error messages
  | 'error_invalid_input'
  | 'error_invalid_bankroll'
  | 'error_invalid_odds'
  | 'error_invalid_probability'
  | 'error_bankroll_range'
  | 'error_odds_range'
  | 'error_stat_validation'
  // Validation messages
  | 'validation_bankroll_positive'
  | 'validation_odds_american'
  | 'validation_probability_range'
  | 'validation_stat_range'
  // Units and formatting
  | 'currency_usd'
  | 'points'
  | 'yards'
  | 'games';

type TranslationDictionary = Record<TranslationKey, string>;

export const translations: Record<string, TranslationDictionary> = {
  en: {
    // Kelly Calculator
    kelly_calculating: 'Calculating optimal stake...',
    kelly_calculated: 'Calculated Kelly stake',
    kelly_stake_text: 'Kelly Criterion recommends staking {stake} ({percentage}% of bankroll) on this bet.',
    kelly_no_value: 'No Value - Do Not Bet. The Kelly Criterion indicates negative expected value for this bet.',
    kelly_analyst_insight: 'Analyst Insight',
    // Probability Estimator
    probability_estimating: 'Estimating probability...',
    probability_estimated: 'Estimated probability',
    probability_result_text: 'Based on the team statistics, your team has an estimated {probability}% probability of covering the {spread} point spread.',
    probability_predicted_margin: 'Predicted Margin',
    probability_use_with_kelly: 'You can use this probability ({probability}%) in the Kelly Criterion calculator to determine your optimal bet size.',
    // Common
    bankroll: 'Bankroll',
    stake: 'Stake',
    percentage: 'Percentage',
    odds: 'Odds',
    probability: 'Probability',
    spread: 'Spread',
    // Error messages
    error_invalid_input: 'Invalid input',
    error_invalid_bankroll: 'Invalid bankroll',
    error_invalid_odds: 'Invalid odds',
    error_invalid_probability: 'Invalid probability',
    error_bankroll_range: 'Bankroll must be between 0 and 1,000,000,000',
    error_odds_range: 'American odds must be <= -100 for favorites or >= 100 for underdogs',
    error_stat_validation: 'Validation error',
    // Validation messages
    validation_bankroll_positive: 'Bankroll must be a valid positive number',
    validation_odds_american: 'Odds must be a valid number in American format',
    validation_probability_range: 'Probability must be a valid number between 0.1 and 99.9',
    validation_stat_range: '{stat} must be between {min} and {max}',
    // Units and formatting
    currency_usd: 'USD',
    points: 'points',
    yards: 'yards',
    games: 'games'
  },
  es: {
    // Kelly Calculator
    kelly_calculating: 'Calculando apuesta óptima...',
    kelly_calculated: 'Apuesta Kelly calculada',
    kelly_stake_text: 'El Criterio de Kelly recomienda apostar {stake} ({percentage}% del bankroll) en esta apuesta.',
    kelly_no_value: 'Sin Valor - No Apostar. El Criterio de Kelly indica un valor esperado negativo para esta apuesta.',
    kelly_analyst_insight: 'Análisis del Experto',
    // Probability Estimator
    probability_estimating: 'Estimando probabilidad...',
    probability_estimated: 'Probabilidad estimada',
    probability_result_text: 'Basado en las estadísticas del equipo, su equipo tiene una probabilidad estimada del {probability}% de cubrir el spread de {spread} puntos.',
    probability_predicted_margin: 'Margen Previsto',
    probability_use_with_kelly: 'Puede usar esta probabilidad ({probability}%) en la calculadora del Criterio de Kelly para determinar su tamaño de apuesta óptimo.',
    // Common
    bankroll: 'Bankroll',
    stake: 'Apuesta',
    percentage: 'Porcentaje',
    odds: 'Cuotas',
    probability: 'Probabilidad',
    spread: 'Spread',
    // Error messages
    error_invalid_input: 'Entrada inválida',
    error_invalid_bankroll: 'Bankroll inválido',
    error_invalid_odds: 'Cuotas inválidas',
    error_invalid_probability: 'Probabilidad inválida',
    error_bankroll_range: 'El bankroll debe estar entre 0 y 1,000,000,000',
    error_odds_range: 'Las cuotas americanas deben ser <= -100 para favoritos o >= 100 para no favoritos',
    error_stat_validation: 'Error de validación',
    // Validation messages
    validation_bankroll_positive: 'El bankroll debe ser un número positivo válido',
    validation_odds_american: 'Las cuotas deben ser un número válido en formato americano',
    validation_probability_range: 'La probabilidad debe ser un número válido entre 0.1 y 99.9',
    validation_stat_range: '{stat} debe estar entre {min} y {max}',
    // Units and formatting
    currency_usd: 'USD',
    points: 'puntos',
    yards: 'yardas',
    games: 'juegos'
  },
  fr: {
    // Kelly Calculator
    kelly_calculating: 'Calcul de la mise optimale...',
    kelly_calculated: 'Mise Kelly calculée',
    kelly_stake_text: 'Le Critère de Kelly recommande de miser {stake} ({percentage}% du bankroll) sur ce pari.',
    kelly_no_value: 'Pas de Valeur - Ne Pas Parier. Le Critère de Kelly indique une valeur attendue négative pour ce pari.',
    kelly_analyst_insight: 'Analyse Experte',
    // Probability Estimator
    probability_estimating: 'Estimation de la probabilité...',
    probability_estimated: 'Probabilité estimée',
    probability_result_text: 'Basé sur les statistiques de l\'équipe, votre équipe a une probabilité estimée de {probability}% de couvrir le spread de {spread} points.',
    probability_predicted_margin: 'Marge Prévue',
    probability_use_with_kelly: 'Vous pouvez utiliser cette probabilité ({probability}%) dans la calculatrice du Critère de Kelly pour déterminer votre taille de mise optimale.',
    // Common
    bankroll: 'Bankroll',
    stake: 'Mise',
    percentage: 'Pourcentage',
    odds: 'Cotes',
    probability: 'Probabilité',
    spread: 'Spread',
    // Error messages
    error_invalid_input: 'Entrée invalide',
    error_invalid_bankroll: 'Bankroll invalide',
    error_invalid_odds: 'Cotes invalides',
    error_invalid_probability: 'Probabilité invalide',
    error_bankroll_range: 'Le bankroll doit être entre 0 et 1,000,000,000',
    error_odds_range: 'Les cotes américaines doivent être <= -100 pour les favoris ou >= 100 pour les outsiders',
    error_stat_validation: 'Erreur de validation',
    // Validation messages
    validation_bankroll_positive: 'Le bankroll doit être un nombre positif valide',
    validation_odds_american: 'Les cotes doivent être un nombre valide au format américain',
    validation_probability_range: 'La probabilité doit être un nombre valide entre 0.1 et 99.9',
    validation_stat_range: '{stat} doit être entre {min} et {max}',
    // Units and formatting
    currency_usd: 'USD',
    points: 'points',
    yards: 'yards',
    games: 'matchs'
  },
  de: {
    // Kelly Calculator
    kelly_calculating: 'Optimaler Einsatz wird berechnet...',
    kelly_calculated: 'Kelly-Einsatz berechnet',
    kelly_stake_text: 'Das Kelly-Kriterium empfiehlt einen Einsatz von {stake} ({percentage}% der Bankroll) für diese Wette.',
    kelly_no_value: 'Kein Wert - Nicht Wetten. Das Kelly-Kriterium zeigt einen negativen erwarteten Wert für diese Wette an.',
    kelly_analyst_insight: 'Expertenanalyse',
    // Probability Estimator
    probability_estimating: 'Wahrscheinlichkeit wird geschätzt...',
    probability_estimated: 'Wahrscheinlichkeit geschätzt',
    probability_result_text: 'Basierend auf den Teamstatistiken hat Ihr Team eine geschätzte Wahrscheinlichkeit von {probability}%, den Spread von {spread} Punkten zu decken.',
    probability_predicted_margin: 'Vorhergesagte Marge',
    probability_use_with_kelly: 'Sie können diese Wahrscheinlichkeit ({probability}%) im Kelly-Kriterium-Rechner verwenden, um Ihre optimale Einsatzgröße zu bestimmen.',
    // Common
    bankroll: 'Bankroll',
    stake: 'Einsatz',
    percentage: 'Prozentsatz',
    odds: 'Quoten',
    probability: 'Wahrscheinlichkeit',
    spread: 'Spread',
    // Error messages
    error_invalid_input: 'Ungültige Eingabe',
    error_invalid_bankroll: 'Ungültige Bankroll',
    error_invalid_odds: 'Ungültige Quoten',
    error_invalid_probability: 'Ungültige Wahrscheinlichkeit',
    error_bankroll_range: 'Bankroll muss zwischen 0 und 1,000,000,000 liegen',
    error_odds_range: 'Amerikanische Quoten müssen <= -100 für Favoriten oder >= 100 für Außenseiter sein',
    error_stat_validation: 'Validierungsfehler',
    // Validation messages
    validation_bankroll_positive: 'Bankroll muss eine gültige positive Zahl sein',
    validation_odds_american: 'Quoten müssen eine gültige Zahl im amerikanischen Format sein',
    validation_probability_range: 'Wahrscheinlichkeit muss eine gültige Zahl zwischen 0.1 und 99.9 sein',
    validation_stat_range: '{stat} muss zwischen {min} und {max} liegen',
    // Units and formatting
    currency_usd: 'USD',
    points: 'Punkte',
    yards: 'Yards',
    games: 'Spiele'
  },
  ja: {
    // Kelly Calculator
    kelly_calculating: '最適な賭け金を計算中...',
    kelly_calculated: 'ケリー賭け金を計算しました',
    kelly_stake_text: 'ケリー基準は、この賭けに{stake}（バンクロールの{percentage}%）を賭けることを推奨します。',
    kelly_no_value: '価値なし - 賭けないでください。ケリー基準は、この賭けの期待値が負であることを示しています。',
    kelly_analyst_insight: 'アナリストの見解',
    // Probability Estimator
    probability_estimating: '確率を推定中...',
    probability_estimated: '確率を推定しました',
    probability_result_text: 'チームの統計に基づくと、あなたのチームは{spread}点のスプレッドをカバーする確率が{probability}%と推定されます。',
    probability_predicted_margin: '予測マージン',
    probability_use_with_kelly: 'この確率（{probability}%）をケリー基準計算機で使用して、最適な賭け金サイズを決定できます。',
    // Common
    bankroll: 'バンクロール',
    stake: '賭け金',
    percentage: 'パーセンテージ',
    odds: 'オッズ',
    probability: '確率',
    spread: 'スプレッド',
    // Error messages
    error_invalid_input: '無効な入力',
    error_invalid_bankroll: '無効なバンクロール',
    error_invalid_odds: '無効なオッズ',
    error_invalid_probability: '無効な確率',
    error_bankroll_range: 'バンクロールは0から1,000,000,000の間でなければなりません',
    error_odds_range: 'アメリカンオッズは、本命の場合<=-100、アンダードッグの場合>=100でなければなりません',
    error_stat_validation: '検証エラー',
    // Validation messages
    validation_bankroll_positive: 'バンクロールは有効な正の数でなければなりません',
    validation_odds_american: 'オッズはアメリカ形式の有効な数でなければなりません',
    validation_probability_range: '確率は0.1から99.9の間の有効な数でなければなりません',
    validation_stat_range: '{stat}は{min}から{max}の間でなければなりません',
    // Units and formatting
    currency_usd: 'USD',
    points: 'ポイント',
    yards: 'ヤード',
    games: 'ゲーム'
  }
};

/**
 * Negotiate the best supported locale using RFC 4647 lookup rules
 * @param requested - The locale requested by the client
 * @returns The best matching supported locale, defaulting to 'en'
 */
export function negotiateLocale(requested: string): string {
  if (!requested) {
    return 'en';
  }

  // Normalize locale format
  const normalizedRequested = requested.replace('_', '-');

  // 1. Exact match
  if (SUPPORTED_LOCALES.includes(normalizedRequested)) {
    return normalizedRequested;
  }

  // 2. Try language-only match (e.g., "es" for "es-MX")
  const language = normalizedRequested.split('-')[0];
  if (SUPPORTED_LOCALES.includes(language)) {
    return language;
  }

  // 3. Try regional variants (e.g., "es-ES" for "es-MX")
  const regionalMatch = SUPPORTED_LOCALES.find(locale =>
    locale.startsWith(language + '-')
  );
  if (regionalMatch) {
    return regionalMatch;
  }

  // 4. Fallback to English
  return 'en';
}

/**
 * Translate a key to the given locale with optional parameter substitution
 * @param key - The translation key
 * @param locale - The target locale
 * @param params - Optional parameters for string interpolation
 * @returns The translated string
 */
export function t(
  key: TranslationKey,
  locale: string = 'en',
  params?: Record<string, string | number>
): string {
  // Get language from locale (e.g., 'en' from 'en-US')
  const language = locale.split('-')[0];

  // Get translation with fallback to English
  let text = translations[language]?.[key] || translations['en'][key] || key;

  // Support parameter substitution
  if (params) {
    Object.entries(params).forEach(([param, value]) => {
      text = text.replace(new RegExp(`\\{${param}\\}`, 'g'), String(value));
    });
  }

  return text;
}

/**
 * Format a date according to the locale
 * @param date - The date to format
 * @param locale - The target locale
 * @returns The formatted date string
 */
export function formatDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

/**
 * Format a number according to the locale
 * @param num - The number to format
 * @param locale - The target locale
 * @returns The formatted number string
 */
export function formatNumber(num: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(num);
}

/**
 * Format currency according to the locale
 * @param amount - The amount to format
 * @param locale - The target locale
 * @param currency - The currency code (default: USD)
 * @returns The formatted currency string
 */
export function formatCurrencyLocalized(
  amount: number,
  locale: string,
  currency: string = 'USD'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency
  }).format(amount);
}
