/**
 * SEO Component - Dynamic metadata management for each tab/page
 * Uses react-helmet-async to update title and meta tags when switching tabs
 */
import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title: string;
  description: string;
  keywords?: string;
  canonical?: string;
  ogImage?: string;
  ogType?: string;
  twitterCard?: string;
  jsonLd?: object;
}

export const SEO: React.FC<SEOProps> = ({
  title,
  description,
  keywords,
  canonical = 'https://betgistics.com/',
  ogImage = 'https://betgistics.com/betgistics.png',
  ogType = 'website',
  twitterCard = 'summary_large_image',
  jsonLd,
}) => {
  const fullTitle = `${title} | Betgistics`;

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="title" content={fullTitle} />
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      <link rel="canonical" href={canonical} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={canonical} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />

      {/* Twitter */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:url" content={canonical} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {/* JSON-LD Structured Data */}
      {jsonLd && (
        <script type="application/ld+json">
          {JSON.stringify(jsonLd)}
        </script>
      )}
    </Helmet>
  );
};

/**
 * Pre-configured SEO metadata for each page/tab
 */
export const SEO_CONFIG = {
  kelly: {
    title: 'Kelly Criterion Calculator',
    description: 'Calculate optimal bet sizing using the Kelly Criterion formula. Determine the perfect stake percentage based on your bankroll, odds, and win probability for maximum long-term growth.',
    keywords: 'kelly criterion, kelly formula, bet sizing calculator, optimal stake, bankroll management, expected value, kelly percentage, fractional kelly, sports betting math',
    canonical: 'https://betgistics.com/#kelly',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Kelly Criterion Calculator',
      description: 'Calculate optimal bet sizing using the Kelly Criterion formula for sports betting and investment decisions.',
      url: 'https://betgistics.com/#kelly',
      mainEntity: {
        '@type': 'SoftwareApplication',
        name: 'Kelly Criterion Calculator',
        applicationCategory: 'FinanceApplication',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
      },
    },
  },
  estimator: {
    title: 'Probability Estimator - NBA & NFL Betting',
    description: 'Estimate win probabilities for NBA and NFL games using advanced statistical models. Analyze team matchups with points per game, defensive stats, and historical data to calculate accurate betting odds.',
    keywords: 'probability estimator, NBA predictions, NFL predictions, win probability calculator, sports betting odds, team statistics, point spread calculator, betting edge calculator',
    canonical: 'https://betgistics.com/#estimator',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Probability Estimator',
      description: 'Estimate win probabilities for NBA and NFL games using statistical analysis and team performance data.',
      url: 'https://betgistics.com/#estimator',
    },
  },
  nba_matchup: {
    title: 'NBA Matchup Analysis Tool',
    description: 'Compare NBA teams head-to-head with detailed statistics including PPG, points allowed, field goal percentage, rebound margin, and turnover differential. Make data-driven betting decisions.',
    keywords: 'NBA matchup, NBA team comparison, NBA statistics, basketball analytics, NBA betting tool, team stats NBA, NBA game analysis, basketball matchup predictor',
    canonical: 'https://betgistics.com/#matchup',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'NBA Matchup Analysis',
      description: 'Advanced NBA team comparison tool with comprehensive statistics for informed betting decisions.',
      url: 'https://betgistics.com/#matchup',
      about: {
        '@type': 'SportsEvent',
        name: 'NBA Basketball Games',
        sport: 'Basketball',
      },
    },
  },
  nfl_matchup: {
    title: 'NFL Matchup Analysis Tool',
    description: 'Compare NFL teams with in-depth statistics including offensive yards, defensive yards, points per game, points allowed, and turnover differential. Analyze football matchups for smarter betting.',
    keywords: 'NFL matchup, NFL team comparison, NFL statistics, football analytics, NFL betting tool, team stats NFL, NFL game analysis, football matchup predictor',
    canonical: 'https://betgistics.com/#nfl_matchup',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'NFL Matchup Analysis',
      description: 'Advanced NFL team comparison tool with comprehensive statistics for informed betting decisions.',
      url: 'https://betgistics.com/#nfl_matchup',
      about: {
        '@type': 'SportsEvent',
        name: 'NFL Football Games',
        sport: 'American Football',
      },
    },
  },
  bet_history: {
    title: 'Bet History Tracker & Analytics',
    description: 'Track your betting performance with comprehensive bet logging and analytics. Monitor win rate, ROI, profit/loss, and betting patterns to improve your sports betting strategy over time.',
    keywords: 'bet tracker, betting history, bet log, sports betting analytics, win rate calculator, ROI tracker, betting performance, bankroll tracker, betting journal',
    canonical: 'https://betgistics.com/#bet_history',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Bet History Tracker',
      description: 'Track and analyze your betting performance with detailed statistics and insights.',
      url: 'https://betgistics.com/#bet_history',
    },
  },
  stats: {
    title: 'NBA & NFL Team Statistics',
    description: 'View live NBA and NFL team statistics including PPG, defensive stats, field goal percentages, yards, and turnover margins. Real-time data for informed betting analysis.',
    keywords: 'NBA stats, NFL stats, team statistics, basketball stats, football stats, NBA team rankings, NFL team rankings, sports data, live team stats',
    canonical: 'https://betgistics.com/#stats',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Team Statistics',
      description: 'Comprehensive NBA and NFL team statistics for sports betting analysis.',
      url: 'https://betgistics.com/#stats',
    },
  },
  account: {
    title: 'Account Settings',
    description: 'Manage your Betgistics account settings, customize themes, and personalize your betting calculator experience.',
    keywords: 'account settings, user profile, theme customization, betting calculator settings',
    canonical: 'https://betgistics.com/#account',
  },
  promo: {
    title: 'Sportsbook Promotions & Bonuses',
    description: 'Discover the latest sportsbook promotions, welcome bonuses, and betting offers from top bookmakers. Maximize your bankroll with exclusive deals.',
    keywords: 'sportsbook promos, betting bonuses, welcome bonus, sportsbook offers, betting deals, free bets, deposit bonus',
    canonical: 'https://betgistics.com/#promo',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Sportsbook Promotions',
      description: 'Latest sportsbook promotions and betting bonuses from top bookmakers.',
      url: 'https://betgistics.com/#promo',
    },
  },
};
