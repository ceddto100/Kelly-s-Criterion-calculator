/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * UPDATED: With Bet Logging Integration + Performance Optimizations + SEO
*/
import React, { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';

/* === Native Bridge for Android (Capacitor) === */
import {
  initializeNativeBridge,
  isNative,
  hapticLight,
  hapticSuccess,
  hapticError,
  getNetworkStatus,
  onNetworkChange,
  onBackButton,
  showToast,
} from './native-bridge';

/* === Lazy load tab components for better performance === */
const FootballEstimator = lazy(() => import("./forms/FootballEstimator"));
const BasketballEstimator = lazy(() => import("./forms/BasketballEstimator"));
const HockeyEstimator = lazy(() => import("./forms/HockeyEstimator"));
const ConsolidatedSportsMatchup = lazy(() => import("./forms/ConsolidatedSportsMatchup"));
const WaltersEstimator = lazy(() => import("./forms/WaltersEstimator"));

/* === NEW: Import Bet Logger components (eager for now, used in Kelly calc) === */
import { LogBetButton, BetHistory, BetLoggerStyles } from './components/BetLogger';

/* === Audio Orb Component === */
import { AudioOrbStyles } from './components/AudioOrb';
import { SwipeableAudioOrbs } from './components/SwipeableAudioOrbs';

/* === Bottom Navigation and New Pages === */
import { BottomNavigation } from './components/BottomNavigation';
import { AccountSettings } from './components/AccountSettings';
import { PromoPage } from './components/PromoPage';
import { StatsPage } from './components/StatsPage';

/* === SEO Component === */
import { SEO, SEO_CONFIG } from './components/SEO';

/* === Backend URL configuration === */
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "";

const THEME_OPTIONS = [
  {
    key: 'midnight',
    label: 'Midnight Neon',
    description: 'Cyan + violet glow with the original look',
    accent: '#8b5cf6',
    preview: 'linear-gradient(135deg, #06b6d4, #3b82f6, #8b5cf6)',
  },
  {
    key: 'deep-sea',
    label: 'Deep Sea',
    description: 'Ocean gradients with aqua orbs',
    accent: '#0ea5e9',
    preview: 'linear-gradient(135deg, #0ea5e9, #14b8a6, #22d3ee)',
  },
  {
    key: 'crimson',
    label: 'Crimson Pulse',
    description: 'Rich magenta reds with neon glows',
    accent: '#f43f5e',
    preview: 'linear-gradient(135deg, #f43f5e, #fb7185, #e11d48)',
  },
  {
    key: 'gamma',
    label: 'Gamma Hulk',
    description: 'Radioactive green with gamma energy',
    accent: '#3ECF54',
    preview: 'linear-gradient(135deg, #22c55e, #3ECF54, #84cc16)',
  },
  {
    key: 'gold-mouth',
    label: 'Gold Mouth',
    description: 'Luxurious gold with amber shine',
    accent: '#FFD700',
    preview: 'linear-gradient(135deg, #DAA520, #FFD700, #FFA500)',
  },
] as const;

type ThemeKey = typeof THEME_OPTIONS[number]['key'];

/* =========================== Inline theme tweaks - GLASSMORPHISM =========================== */
const GlobalStyle = () => (
  <style>{`
    /* Additional glassmorphism styles for components not in main CSS */
    .site-bg {
      position: relative;
      min-height: 100vh;
      width: 100%;
      max-width: 100vw;
      background: #050510;
      -webkit-overflow-scrolling: touch;
    }

    .site-bg img.bg-fallback {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      opacity: 0.15;
      pointer-events: none;
      z-index: 0;
    }

    .bg-overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(
        90deg,
        rgba(6, 182, 212, 0.05),
        rgba(139, 92, 246, 0.05)
      );
      z-index: 0;
      pointer-events: none;
    }

    .page-wrap {
      position: relative;
      z-index: 1;
      padding:
        max(3rem, env(safe-area-inset-top, 3rem))
        max(1rem, env(safe-area-inset-right, 1rem))
        max(120px, calc(120px + env(safe-area-inset-bottom, 0px)))
        max(1rem, env(safe-area-inset-left, 1rem));
      max-width: 1100px;
      margin: 0 auto;
      width: 100%;
    }

    @media (max-width: 480px) {
      .page-wrap {
        padding:
          max(2rem, env(safe-area-inset-top, 2rem))
          max(0.75rem, env(safe-area-inset-right, 0.75rem))
          max(120px, calc(120px + env(safe-area-inset-bottom, 0px)))
          max(0.75rem, env(safe-area-inset-left, 0.75rem));
      }
    }
    @media (max-width: 360px) {
      .page-wrap {
        padding:
          max(1.5rem, env(safe-area-inset-top, 1.5rem))
          max(0.5rem, env(safe-area-inset-right, 0.5rem))
          max(120px, calc(120px + env(safe-area-inset-bottom, 0px)))
          max(0.5rem, env(safe-area-inset-left, 0.5rem));
      }
    }

    /* Panel Overrides for Glass Effect */
    .panel {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 24px;
      padding: 1.5rem;
      box-shadow:
        0 24px 48px rgba(0, 0, 0, 0.5),
        0 0 0 1px rgba(255, 255, 255, 0.05) inset;
      margin: 0 auto 1rem;
      max-width: 900px;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    }

    .panel-strong {
      background: rgba(255, 255, 255, 0.04);
    }

    .info-panel {
      max-width: 1100px;
    }

    /* Footer Glass Panel */
    .footer {
      color: rgba(255, 255, 255, 0.7);
      text-align: center;
      padding: 2rem 1rem calc(80px + env(safe-area-inset-bottom, 0px));
      font-size: 0.95rem;
      display: flex;
      justify-content: center;
      position: relative;
      z-index: 2;
    }

    .footer-card {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 20px;
      padding: 1rem 1.5rem;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      max-width: 820px;
      width: 100%;
    }

    /* Documentation Toggle */
    .doc-toggle {
      background: transparent;
      border: none;
      color: var(--text-secondary);
      font-weight: 700;
      font-size: 1rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      justify-content: center;
      width: 100%;
      padding: 0.5rem 0.75rem;
      border-radius: 12px;
      transition: 0.3s ease;
    }

    .doc-toggle:hover {
      color: var(--text-primary);
      background: var(--surface-1);
    }

    .doc-toggle:focus-visible {
      outline: 2px solid var(--control-focus);
      outline-offset: 2px;
    }

    .doc-chevron {
      transition: transform 0.2s ease;
    }

    .doc-chevron.open {
      transform: rotate(180deg);
    }

    .doc-hint {
      margin: 0.5rem 0 0;
      color: var(--text-muted);
      font-size: 0.9rem;
    }

    .doc-panel-wrapper {
      max-width: 1100px;
      margin: 0 auto 1rem;
      transition: all 0.25s ease;
      overflow: hidden;
    }

    .doc-panel-wrapper.closed {
      max-height: 0;
      opacity: 0;
      transform: translateY(8px);
      pointer-events: none;
    }

    .doc-panel-wrapper.open {
      max-height: 1200px;
      opacity: 1;
      transform: translateY(0);
    }

    .doc-panel {
      position: relative;
    }

    .doc-close {
      position: absolute;
      top: 1rem;
      right: 1rem;
      background: var(--surface-1);
      border: 1px solid var(--border-subtle);
      color: var(--text-secondary);
      border-radius: 10px;
      padding: 0.5rem 0.8rem;
      cursor: pointer;
      font-weight: 700;
      transition: 0.25s ease;
      backdrop-filter: blur(5px);
      -webkit-backdrop-filter: blur(5px);
    }

    /* Mobile-first tab styling to mirror the compact layout */
    .tabs {
      display: flex;
      gap: 0.5rem;
      justify-content: center;
      margin: 1rem auto 1.25rem;
      flex-wrap: wrap;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }
    @media (min-width: 768px) {
      .tabs {
        flex-wrap: nowrap;
        overflow-x: visible;
      }
    }

    .tab {
      background: var(--surface-1);
      color: var(--text-secondary);
      border: 1px solid var(--border-subtle);
      padding: 0.6rem 1rem;
      border-radius: 0.75rem;
      cursor: pointer;
      transition: 0.25s ease;
      font-weight: 600;
    }

    .tab:hover {
      background: var(--surface-2);
      color: var(--text-primary);
    }

    .tab.active {
      color: var(--text-primary);
      background: var(--button-primary);
      border-color: transparent;
      box-shadow: var(--button-glow);
    }

    /* Main top tab row (Kelly / Estimator / Walters / etc.) */
    .app-tabs {
      justify-content: flex-start;
      flex-wrap: nowrap;
      overflow-x: auto;
      overflow-y: hidden;
      padding: 0.25rem;
      border-radius: 16px;
      scrollbar-width: thin;
      -webkit-overflow-scrolling: touch;
    }

    .app-tabs .tab {
      flex: 0 0 auto;
      min-width: fit-content;
      white-space: nowrap;
      text-wrap: nowrap;
      padding: 0.8rem 1rem;
      border-radius: 12px;
      line-height: 1.2;
    }

    @media (max-width: 640px) {
      .app-tabs .tab {
        font-size: 0.95rem;
        padding: 0.78rem 0.9rem;
      }
    }

    .doc-close:hover {
      background: rgba(255, 255, 255, 0.08);
      color: rgba(255, 255, 255, 1);
    }

    /* Brand Logo Circle */
    .brand-logo-container {
      position: absolute;
      top: 1rem;
      left: 1rem;
      z-index: 100;
    }

    .brand-logo {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      border: 2px solid color-mix(in srgb, var(--accent-electric) 45%, transparent);
      box-shadow: 0 4px 12px rgba(var(--accent-electric-rgb), 0.3);
      object-fit: cover;
      display: block;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      transform: translate3d(0, 0, 0);
      -webkit-backface-visibility: hidden;
      backface-visibility: hidden;
      contain: layout paint;
    }

    .brand-logo:hover {
      transform: translate3d(0, 0, 0) scale(1.05);
      box-shadow: 0 6px 16px rgba(var(--accent-electric-rgb), 0.4);
    }

    /* Auth Container Glass */
    .auth-container {
      position: absolute;
      top: 1rem;
      right: 1rem;
      z-index: 100;
    }

    .auth-btn {
      background: var(--button-primary);
      color: #fff;
      border: none;
      padding: 0.75rem 1.25rem;
      border-radius: 12px;
      cursor: pointer;
      font-weight: 600;
      transition: 0.25s ease;
      box-shadow:
        0 6px 20px rgba(var(--accent-electric-rgb), 0.4),
        0 0 0 1px rgba(255, 255, 255, 0.2) inset;
      font-size: 0.95rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      text-decoration: none;
      backdrop-filter: blur(5px);
      -webkit-backdrop-filter: blur(5px);
    }

    .auth-btn:hover {
      transform: translateY(-2px);
      box-shadow:
        0 8px 24px rgba(var(--accent-electric-rgb), 0.5),
        0 0 0 1px rgba(255, 255, 255, 0.3) inset;
    }

    .user-info {
      background: var(--surface-2);
      border: 1px solid var(--border-subtle);
      border-radius: 14px;
      padding: 0.75rem 1rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    }

    .user-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: 2px solid color-mix(in srgb, var(--accent-electric) 45%, transparent);
    }

    .user-details {
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
    }

    .user-name {
      color: var(--text-primary);
      font-weight: 600;
      font-size: 0.9rem;
      line-height: 1.2;
    }

    .user-email {
      color: var(--text-muted);
      font-size: 0.75rem;
      line-height: 1.2;
    }

    .logout-btn {
      background: color-mix(in srgb, var(--danger-color) 16%, transparent);
      border: 1px solid color-mix(in srgb, var(--danger-color) 45%, transparent);
      color: color-mix(in srgb, var(--danger-color) 70%, #fff 30%);
      padding: 0.4rem 0.8rem;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      transition: 0.25s ease;
      font-size: 0.85rem;
      margin-left: 0.5rem;
      text-decoration: none;
    }

    .logout-btn:hover {
      background: color-mix(in srgb, var(--danger-color) 28%, transparent);
    }

    /* Chat & Sports Matchup Glass Panels */
    .sports-matchup-container {
      display: flex;
      flex-direction: column;
      height: 600px;
      max-height: 70vh;
    }

    .quick-examples {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1rem;
      flex-wrap: wrap;
      align-items: center;
      padding: 0.75rem;
      background: var(--surface-2);
      border-radius: 12px;
      border: 1px solid var(--border-subtle);
      backdrop-filter: blur(5px);
      -webkit-backdrop-filter: blur(5px);
    }

    .example-btn {
      background: var(--surface-1);
      border: 1px solid var(--border-subtle);
      color: var(--text-secondary);
      padding: 0.4rem 0.8rem;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.8rem;
      font-weight: 600;
      transition: 0.2s ease;
    }

    .example-btn:hover {
      background: var(--surface-2);
      transform: translateY(-1px);
      color: var(--text-primary);
    }

    .chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 1rem;
      background: var(--surface-2);
      border-radius: 16px;
      border: 1px solid var(--border-subtle);
      margin-bottom: 1rem;
      backdrop-filter: blur(5px);
      -webkit-backdrop-filter: blur(5px);
    }

    .chat-messages::-webkit-scrollbar {
      width: 8px;
    }

    .chat-messages::-webkit-scrollbar-track {
      background: rgba(255, 255, 255, 0.05);
      border-radius: 4px;
    }

    .chat-messages::-webkit-scrollbar-thumb {
      background: rgba(59, 130, 246, 0.4);
      border-radius: 4px;
    }

    .chat-messages::-webkit-scrollbar-thumb:hover {
      background: rgba(59, 130, 246, 0.6);
    }

    .chat-message {
      margin-bottom: 1.25rem;
      padding: 0.75rem 1rem;
      border-radius: 14px;
      animation: fadeInScale 0.3s ease-out;
      backdrop-filter: blur(5px);
      -webkit-backdrop-filter: blur(5px);
    }

    .chat-message.user {
      background: rgba(59, 130, 246, 0.15);
      border: 1px solid rgba(59, 130, 246, 0.3);
      margin-left: 2rem;
    }

    .chat-message.assistant {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      margin-right: 2rem;
    }

    .message-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
      font-size: 0.8rem;
    }

    .message-role {
      font-weight: 700;
      color: var(--accent-cyan);
    }

    .message-time {
      color: var(--text-muted);
      font-size: 0.75rem;
    }

    .message-content {
      color: var(--text-primary);
      line-height: 1.6;
      white-space: pre-wrap;
      word-wrap: break-word;
    }

    .chat-input-form {
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }

    .chat-input {
      flex: 1;
      background: var(--surface-1);
      border: 1px solid var(--border-subtle);
      color: var(--text-primary);
      padding: 0.75rem 1rem;
      border-radius: 12px;
      outline: none;
      transition: all 0.25s ease;
      backdrop-filter: blur(5px);
      -webkit-backdrop-filter: blur(5px);
    }

    .chat-input:focus {
      border-color: var(--control-focus);
      box-shadow: 0 0 0 1px var(--control-focus);
    }

    .chat-input:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .chat-submit-btn {
      background: var(--button-primary);
      color: #fff;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 12px;
      cursor: pointer;
      font-weight: 700;
      font-size: 1.2rem;
      transition: 0.2s ease;
      box-shadow: 0 6px 18px rgba(var(--accent-electric-rgb), 0.35);
      min-width: 60px;
    }

    .chat-submit-btn:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 8px 24px rgba(var(--accent-electric-rgb), 0.45);
    }

    .chat-submit-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .clear-chat-btn {
      background: color-mix(in srgb, var(--danger-color) 16%, transparent);
      border: 1px solid color-mix(in srgb, var(--danger-color) 45%, transparent);
      color: color-mix(in srgb, var(--danger-color) 70%, #fff 30%);
      padding: 0.75rem 1rem;
      border-radius: 12px;
      cursor: pointer;
      font-weight: 600;
      transition: 0.2s ease;
    }

    .clear-chat-btn:hover {
      background: color-mix(in srgb, var(--danger-color) 28%, transparent);
    }

    /* Team Name Label for forms */
    .team-name-label {
      position: absolute;
      top: 0.35rem;
      left: 0.75rem;
      font-size: 0.65rem;
      font-weight: 600;
      color: var(--accent-cyan);
      pointer-events: none;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      opacity: 0.8;
      line-height: 1;
    }

    /* Responsive Overrides */
    @media (max-width: 640px) {
      .brand-logo-container {
        position: relative;
        left: auto;
        right: auto;
        top: auto;
        margin: 0 auto 1rem;
        display: flex;
        justify-content: center;
      }

      .brand-logo {
        width: 56px;
        height: 56px;
      }

      .auth-container {
        position: relative;
        left: auto;
        right: auto;
        top: auto;
        margin: 0 auto 1rem;
        display: flex;
        justify-content: center;
      }

      .user-info {
        flex-wrap: wrap;
        justify-content: center;
      }

      .user-details {
        text-align: center;
      }

      .sports-matchup-container {
        height: 500px;
      }

      .chat-message.user {
        margin-left: 0.5rem;
      }

      .chat-message.assistant {
        margin-right: 0.5rem;
      }
    }

    @media (min-width: 768px) {
      .page-wrap {
        padding: 3.5rem 1.5rem max(120px, calc(120px + env(safe-area-inset-bottom, 0px))) 1.5rem;
      }

      .panel {
        padding: 2rem;
      }

      .chat-message.user {
        margin-left: 3rem;
      }

      .chat-message.assistant {
        margin-right: 3rem;
      }

      .sports-matchup-container {
        height: 650px;
        max-height: 75vh;
      }
    }

    @media (min-width: 1024px) {
      .page-wrap {
        padding: 4rem 2rem max(120px, calc(120px + env(safe-area-inset-bottom, 0px))) 2rem;
      }

      .panel {
        padding: 2.5rem;
        max-width: 1000px;
      }

      .chat-message.user {
        margin-left: 4rem;
      }

      .chat-message.assistant {
        margin-right: 4rem;
      }

      .chat-message {
        padding: 1rem 1.25rem;
      }

      .message-content {
        font-size: 1.05rem;
        line-height: 1.7;
      }

      .sports-matchup-container {
        height: 700px;
        max-height: 80vh;
      }
    }

    @media (min-width: 1440px) {
      .page-wrap {
        padding: 4.5rem 2.5rem max(120px, calc(120px + env(safe-area-inset-bottom, 0px))) 2.5rem;
      }

      .panel {
        max-width: 1100px;
      }

      .sports-matchup-container {
        height: 750px;
      }
    }

    /* NEW: Include Bet Logger Styles */
    ${BetLoggerStyles}

    /* Audio Orb Styles */
    ${AudioOrbStyles()}

    /* Demo Popover Button & Popover */
    .demo-btn {
      padding: 10px 14px;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      background: rgba(255, 255, 255, 0.06);
      color: var(--text-primary);
      cursor: pointer;
      font-weight: 600;
      font-size: 0.9rem;
      transition: 0.25s ease;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
    }

    .demo-btn:hover {
      background: rgba(255, 255, 255, 0.10);
      transform: translateY(-1px);
    }

    /* Popover */
    .demo-popover {
      position: absolute;
      margin-top: 10px;
      width: min(420px, calc(100vw - 24px));
      border-radius: 16px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      background: rgba(10, 12, 18, 0.92);
      box-shadow: 0 18px 55px rgba(0, 0, 0, 0.55);
      padding: 10px;
      display: none;
      z-index: 9999;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    }

    .demo-popover.is-open {
      display: block;
    }

    .demo-popover__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 6px 10px;
    }

    .demo-popover__title {
      font-size: 14px;
      color: var(--text-primary);
      font-weight: 600;
      opacity: 0.9;
    }

    .demo-popover__close {
      width: 32px;
      height: 32px;
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      background: rgba(255, 255, 255, 0.08);
      color: var(--text-primary);
      cursor: pointer;
      font-size: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: 0.2s ease;
    }

    .demo-popover__close:hover {
      background: rgba(255, 255, 255, 0.14);
    }

    .demo-popover__video {
      width: 100%;
      aspect-ratio: 9 / 16;
      border-radius: 14px;
      overflow: hidden;
      background: #000;
    }

    .demo-popover__video iframe {
      width: 100%;
      height: 100%;
      border: 0;
    }

    @media (max-width: 640px) {
      .demo-popover {
        width: calc(100vw - 32px);
      }
    }
  `}</style>
);

/* =============================== App Constants ============================= */
const CONSTANTS = {
  TABS: {
    KELLY: 'kelly',
    ESTIMATOR: 'estimator',
    WALTERS: 'walters',
    SPORTS_MATCHUP: 'sports_matchup',  // Consolidated NBA/NFL/NHL matchup
    BET_HISTORY: 'bet_history',  // Bet tracking
    STATS: 'stats',  // NBA/NFL/NHL statistics
    ACCOUNT: 'account',  // Account settings
    PROMO: 'promo'  // Promotional links
  },
  SPORTS: { FOOTBALL: 'football', BASKETBALL: 'basketball', HOCKEY: 'hockey' },
};

/* ========================= API helper (Kelly insight) ====================== */
async function fetchFromApi(prompt: string, systemInstruction: string) {
  const response = await fetch(`${BACKEND_URL}/api/calculate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, systemInstruction }),
  });
  if (!response.ok) {
    let message = 'API request failed';
    try { const body = await response.json(); message = body.message || message; } catch {}
    throw new Error(message);
  }
  return response.json();
}

/* ======================== Probability engine (Normal) ====================== */
function normCdf(x: number): number {
  const a1=0.254829592,a2=-0.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=0.3275911;
  const sign = x < 0 ? -1 : 1, z = Math.abs(x) / Math.SQRT2, t = 1 / (1 + p * z);
  const y = 1 - (((((a5*t + a4)*t) + a3)*t + a2)*t + a1)*t*Math.exp(-z*z);
  return 0.5 * (1 + sign * y);
}

function coverProbabilityFromMargin(predictedMargin: number, spread: number, sigma: number): number {
  const Z = (predictedMargin + spread) / sigma;
  const p = normCdf(Z);
  return Math.max(1, Math.min(99, p * 100));
}

/* ========================== Sport-specific margin math ===================== */
function predictedMarginFootball(stats: any, isHome: boolean | null = null): number {
  const teamAPointDiff = parseFloat(stats.teamPointsFor) - parseFloat(stats.teamPointsAgainst);
  const teamBPointDiff = parseFloat(stats.opponentPointsFor) - parseFloat(stats.opponentPointsAgainst);
  const pointDiffComponent = (teamAPointDiff - teamBPointDiff) * 0.4;

  const teamAYardDiff = parseFloat(stats.teamOffYards) - parseFloat(stats.teamDefYards);
  const teamBYardDiff = parseFloat(stats.opponentOffYards) - parseFloat(stats.opponentDefYards);
  const yardDiffComponent = ((teamAYardDiff - teamBYardDiff) / 25) * 0.25;

  let teamTO = parseFloat(stats.teamTurnoverDiff) || 0;
  let oppTO = parseFloat(stats.opponentTurnoverDiff) || 0;
  teamTO = Math.max(-10, Math.min(10, teamTO));
  oppTO = Math.max(-10, Math.min(10, oppTO));
  const turnoverComponent = (teamTO - oppTO) * 4 * 0.5 * 0.2;

  const homeFieldAdvantage = isHome === null ? 0 : (isHome ? 2.5 : -2.5);

  return pointDiffComponent + yardDiffComponent + turnoverComponent + homeFieldAdvantage;
}

function predictedMarginBasketball(stats: any, isHome: boolean | null = null): number {
  const teamAPointDiff = parseFloat(stats.teamPointsFor) - parseFloat(stats.teamPointsAgainst);
  const teamBPointDiff = parseFloat(stats.opponentPointsFor) - parseFloat(stats.opponentPointsAgainst);
  const pointDiffComponent = (teamAPointDiff - teamBPointDiff) * 0.30;

  // FG% with realistic scaling: 1% FG diff ≈ 2 points per game
  const teamAFg = parseFloat(stats.teamFgPct) || 0;
  const teamBFg = parseFloat(stats.opponentFgPct) || 0;
  const fgDiffComponent = (teamAFg - teamBFg) * 2.0 * 0.25;

  // 3-point shooting component (if provided)
  let threePointComponent = 0;
  const teamA3PPct = parseFloat(stats.team3PPct) || 0;
  const teamB3PPct = parseFloat(stats.opponent3PPct) || 0;
  if (teamA3PPct > 0 || teamB3PPct > 0) {
    const pctDiff = (teamA3PPct - teamB3PPct) * 1.0;
    const teamA3PRate = parseFloat(stats.team3PRate) || 0;
    const teamB3PRate = parseFloat(stats.opponent3PRate) || 0;
    const rateDiff = (teamA3PRate - teamB3PRate) * 15;
    threePointComponent = (pctDiff + rateDiff) * 0.15;
  }

  const teamAReb = parseFloat(stats.teamReboundMargin) || 0;
  const teamBReb = parseFloat(stats.opponentReboundMargin) || 0;
  const reboundComponent = (teamAReb - teamBReb) * 0.5 * 0.17;

  // Turnovers: positive margin = team forces more TOs than it commits (good)
  const teamATov = parseFloat(stats.teamTurnoverMargin) || 0;
  const teamBTov = parseFloat(stats.opponentTurnoverMargin) || 0;
  const turnoverComponent = (teamATov - teamBTov) * 1.0 * 0.13;

  const homeCourtAdvantage = isHome === null ? 0 : (isHome ? 3.0 : -3.0);

  let margin = pointDiffComponent + fgDiffComponent + threePointComponent + reboundComponent + turnoverComponent + homeCourtAdvantage;

  // Pace multiplier when available
  const teamAPace = parseFloat(stats.teamPace) || 0;
  const teamBPace = parseFloat(stats.opponentPace) || 0;
  if (teamAPace > 0 && teamBPace > 0) {
    const expectedPace = (teamAPace + teamBPace) / 2;
    const paceFactor = expectedPace / 100; // 100 = league average possessions
    margin *= paceFactor;
  }

  return margin;
}

/* ================================= Utilities ============================== */
const formatCurrency = (v: any) => isNaN(Number(v)) ? '$0.00' :
  new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(v));

const formatBankrollValue = (value: string | number) => {
  if (value === '') return '';
  const numValue = typeof value === 'number' ? value : parseFloat(value);
  if (isNaN(numValue)) return '';
  return numValue.toFixed(2);
};

export const initialFootballState = {
  teamPointsFor: '', opponentPointsFor: '',
  teamPointsAgainst: '', opponentPointsAgainst: '',
  teamOffYards: '', opponentOffYards: '',
  teamDefYards: '', opponentDefYards: '',
  teamTurnoverDiff: '', opponentTurnoverDiff: '',
  teamAName: '', teamBName: '',
};
export const initialBasketballState = {
  teamPointsFor: '', opponentPointsFor: '',
  teamPointsAgainst: '', opponentPointsAgainst: '',
  teamFgPct: '', opponentFgPct: '',
  teamReboundMargin: '', opponentReboundMargin: '',
  teamTurnoverMargin: '', opponentTurnoverMargin: '',
  teamPace: '', opponentPace: '',
  team3PRate: '', opponent3PRate: '',
  team3PPct: '', opponent3PPct: '',
  teamAName: '', teamBName: '',
};

export const initialHockeyState = {
  // Home team stats
  homeXgf60: '',      // Expected Goals For per 60
  homeXga60: '',      // Expected Goals Against per 60
  homeGsax60: '',     // Goalie Goals Saved Above Expected per 60
  homeHdcf60: '',     // High Danger Chances For per 60
  homePP: '',         // Power Play Percentage
  homePK: '',         // Penalty Kill Percentage
  homeTimesShorthanded: '',  // Times Shorthanded Per Game
  // Away team stats
  awayXgf60: '',
  awayXga60: '',
  awayGsax60: '',
  awayHdcf60: '',
  awayPP: '',         // Power Play Percentage
  awayPK: '',         // Penalty Kill Percentage
  awayTimesShorthanded: '',  // Times Shorthanded Per Game
  // Team names
  teamAName: '', teamBName: '',
};

/* ======================== NEW: Types for Bet Logging ======================= */
interface MatchupData {
  sport: 'football' | 'basketball' | 'hockey';
  teamA: {
    name: string;
    abbreviation?: string;
    stats: Record<string, number>;
  };
  teamB: {
    name: string;
    abbreviation?: string;
    stats: Record<string, number>;
  };
  venue: 'home' | 'away' | 'neutral';
}

interface EstimationData {
  pointSpread: number;
  calculatedProbability: number;
  expectedMargin?: number;
}

/* ========================= Probability Estimator panel ===================== */
function ProbabilityEstimator({
  setProbability,
  setActiveTab,
  activeSport,
  setActiveSport,
  footballStats,
  setFootballStats,
  basketballStats,
  setBasketballStats,
  hockeyStats,
  setHockeyStats,
  pointSpread,
  setPointSpread,
  totalGoalsLine,
  setTotalGoalsLine,
  calculatedProb,
  setCalculatedProb,
  expectedDiff,
  setExpectedDiff,
  isTeamAHome,
  setIsTeamAHome,
  isAuthenticated,
  onLoginRequired,
  // NEW: Callbacks to store data for bet logging
  setCurrentMatchup,
  setCurrentEstimation
}: {
  setProbability:(v:string)=>void;
  setActiveTab:(t:string)=>void;
  activeSport: string;
  setActiveSport: (v:string)=>void;
  footballStats: any;
  setFootballStats: (v:any)=>void;
  basketballStats: any;
  setBasketballStats: (v:any)=>void;
  hockeyStats: any;
  setHockeyStats: (v:any)=>void;
  pointSpread: string;
  setPointSpread: (v:string)=>void;
  totalGoalsLine: string;
  setTotalGoalsLine: (v:string)=>void;
  calculatedProb: number|null;
  setCalculatedProb: (v:number|null)=>void;
  expectedDiff: number|null;
  setExpectedDiff: (v:number|null)=>void;
  isTeamAHome: boolean|null;
  setIsTeamAHome: (v:boolean|null)=>void;
  isAuthenticated: boolean;
  onLoginRequired: () => void;
  // NEW props
  setCurrentMatchup: (v: MatchupData | null) => void;
  setCurrentEstimation: (v: EstimationData | null) => void;
}) {
  const [showFreeCalcModal, setShowFreeCalcModal] = useState(false);
  const [freeCalculationsLeft, setFreeCalculationsLeft] = useState<number | null>(null);
  const [isUpgradeLoading, setIsUpgradeLoading] = useState(false);
  const [isOverBet, setIsOverBet] = useState(true); // true = Over, false = Under
  const resultsRef = React.useRef<HTMLDivElement | null>(null);
  const modalRef = React.useRef<HTMLDivElement | null>(null);

  const isFormValid = useMemo(() => {
    const isHockey = activeSport === CONSTANTS.SPORTS.HOCKEY;
    const current = activeSport === CONSTANTS.SPORTS.FOOTBALL
      ? footballStats
      : activeSport === CONSTANTS.SPORTS.BASKETBALL
        ? basketballStats
        : hockeyStats;
    const requiredFields = Object.entries(current)
      .filter(([key]) => key !== 'teamAName' && key !== 'teamBName')
      .map(([, value]) => value);
    const ok = requiredFields.every(v => v !== '');
    // Hockey uses totalGoalsLine, others use pointSpread
    const hasLine = isHockey ? totalGoalsLine !== '' : pointSpread !== '';
    return ok && hasLine;
  }, [activeSport, footballStats, basketballStats, hockeyStats, pointSpread, totalGoalsLine]);

  const progress = useMemo(() => {
    const isHockey = activeSport === CONSTANTS.SPORTS.HOCKEY;
    const current = activeSport === CONSTANTS.SPORTS.FOOTBALL
      ? footballStats
      : activeSport === CONSTANTS.SPORTS.BASKETBALL
        ? basketballStats
        : hockeyStats;
    const statEntries = Object.entries(current).filter(([key]) => key !== 'teamAName' && key !== 'teamBName');
    const filledFields = statEntries.filter(([, v]) => v !== '').length;
    const totalFields = statEntries.length;
    const hasLine = isHockey ? totalGoalsLine !== '' : pointSpread !== '';
    return {
      stats: filledFields,
      totalStats: totalFields,
      spread: hasLine,
      allComplete: filledFields === totalFields && hasLine
    };
  }, [activeSport, footballStats, basketballStats, hockeyStats, pointSpread, totalGoalsLine]);

  const loadExample = () => {
    if (activeSport === CONSTANTS.SPORTS.FOOTBALL) {
      setFootballStats({
        teamPointsFor: '28.5', opponentPointsFor: '24.2',
        teamPointsAgainst: '21.3', opponentPointsAgainst: '26.8',
        teamOffYards: '395', opponentOffYards: '362',
        teamDefYards: '315', opponentDefYards: '385',
        teamTurnoverDiff: '8', opponentTurnoverDiff: '-3',
        teamAName: 'KC', teamBName: 'BUF'
      });
      setPointSpread('-6.5');
    } else if (activeSport === CONSTANTS.SPORTS.BASKETBALL) {
      setBasketballStats({
        teamPointsFor: '112.5', opponentPointsFor: '108.3',
        teamPointsAgainst: '106.2', opponentPointsAgainst: '110.8',
        teamFgPct: '47.8', opponentFgPct: '45.2',
        teamReboundMargin: '4.2', opponentReboundMargin: '-1.5',
        teamTurnoverMargin: '2.8', opponentTurnoverMargin: '-1.2',
        teamAName: 'Lakers', teamBName: 'Warriors'
      });
      setPointSpread('-4.5');
    } else {
      // Hockey
      setHockeyStats({
        homeXgf60: '2.95', homeXga60: '2.55', homeGsax60: '0.12', homeHdcf60: '12.8',
        homePP: '26.8', homePK: '81.3', homeTimesShorthanded: '2.9',
        awayXgf60: '2.78', awayXga60: '2.72', awayGsax60: '-0.05', awayHdcf60: '11.5',
        awayPP: '28.5', awayPK: '79.8', awayTimesShorthanded: '3.2',
        teamAName: 'COL', teamBName: 'EDM'
      });
      setTotalGoalsLine('5.5');
    }
  };

  const handleCalculate = async () => {
    if (!isAuthenticated) {
      onLoginRequired();
      return;
    }

    try {
      const accessResponse = await fetch(`${BACKEND_URL}/api/stripe/calculation-access`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (accessResponse.status === 401) {
        onLoginRequired();
        return;
      }

      if (!accessResponse.ok) {
        throw new Error('Unable to verify calculation access');
      }

      const accessData = await accessResponse.json();

      if (!accessData.allowed) {
        if (accessData.url) {
          window.location.assign(accessData.url);
          return;
        }
        throw new Error(accessData.reason || 'Subscription required');
      }

      if (accessData.showPopup) {
        setFreeCalculationsLeft(accessData.remainingCalculations);
        setShowFreeCalcModal(true);
      }

      if (activeSport === CONSTANTS.SPORTS.HOCKEY) {
        // NHL Over/Under calculation using complete 4-step algorithm
        const line = parseFloat(totalGoalsLine);
        if (Number.isNaN(line)) throw new Error('Invalid total goals line');

        // Parse all hockey stats (14 total: 7 per team)
        // Core stats
        const H_xGF = parseFloat(hockeyStats.homeXgf60) || 0;
        const H_xGA = parseFloat(hockeyStats.homeXga60) || 0;
        const A_xGF = parseFloat(hockeyStats.awayXgf60) || 0;
        const A_xGA = parseFloat(hockeyStats.awayXga60) || 0;
        const H_GSAx = parseFloat(hockeyStats.homeGsax60) || 0;
        const A_GSAx = parseFloat(hockeyStats.awayGsax60) || 0;
        const H_HDCF = parseFloat(hockeyStats.homeHdcf60) || 0;
        const A_HDCF = parseFloat(hockeyStats.awayHdcf60) || 0;
        // Special teams stats
        const H_PP = parseFloat(hockeyStats.homePP) || 0;
        const H_PK = parseFloat(hockeyStats.homePK) || 0;
        const H_TimesShorthanded = parseFloat(hockeyStats.homeTimesShorthanded) || 0;
        const A_PP = parseFloat(hockeyStats.awayPP) || 0;
        const A_PK = parseFloat(hockeyStats.awayPK) || 0;
        const A_TimesShorthanded = parseFloat(hockeyStats.awayTimesShorthanded) || 0;

        // Step 1: Calculate Projected Home Goals
        // Home_Score = ((Home_xGF + Away_xGA) / 2) - Away_Goalie_GSAx
        const projectedHomeGoals = (H_xGF + A_xGA) / 2 - A_GSAx;

        // Step 2: Calculate Projected Away Goals
        // Away_Score = ((Away_xGF + Home_xGA) / 2) - Home_Goalie_GSAx
        const projectedAwayGoals = (A_xGF + H_xGA) / 2 - H_GSAx;

        // Step 3: Pace Adjustment based on combined HDCF
        const HDC_sum = H_HDCF + A_HDCF;
        const paceAdjustment = HDC_sum > 25 ? 0.25 : 0;

        // Step 4: Special Teams Mismatch Adjustment
        // Home Advantage: IF (Home_PP + (100 - Away_PK)) * Away_Times_Shorthanded > 150
        // Away Advantage: IF (Away_PP + (100 - Home_PK)) * Home_Times_Shorthanded > 150
        let specialTeamsAdjustment = 0;
        const homeSpecialTeamsScore = (H_PP + (100 - A_PK)) * A_TimesShorthanded;
        if (homeSpecialTeamsScore > 150) {
          specialTeamsAdjustment += 0.35;
        }
        const awaySpecialTeamsScore = (A_PP + (100 - H_PK)) * H_TimesShorthanded;
        if (awaySpecialTeamsScore > 150) {
          specialTeamsAdjustment += 0.35;
        }

        // Step 5: Final Total
        const projectedTotal = Math.max(0, projectedHomeGoals + projectedAwayGoals + paceAdjustment + specialTeamsAdjustment);

        // Calculate over probability using normal CDF
        // Standard deviation based on sqrt of projected total (Poisson-like variance)
        const sigma = Math.sqrt(projectedTotal);
        const z = (projectedTotal - line) / sigma;
        // CDF gives probability of going OVER when projected > line
        const overProb = normCdf(z) * 100;

        // Calculate final probability based on user's Over/Under selection
        const finalProb = isOverBet ? overProb : (100 - overProb);

        setCalculatedProb(finalProb);
        setExpectedDiff(projectedTotal);
      } else {
        // Football/Basketball spread calculation
        const spread = parseFloat(pointSpread);
        if (Number.isNaN(spread)) throw new Error('Invalid spread');

        const m = activeSport === CONSTANTS.SPORTS.FOOTBALL
          ? predictedMarginFootball(footballStats, isTeamAHome)
          : predictedMarginBasketball(basketballStats, isTeamAHome);

        const sigma = activeSport === CONSTANTS.SPORTS.FOOTBALL ? 13.5 : 12.0;
        const p = coverProbabilityFromMargin(m, spread, sigma);

        setCalculatedProb(p);
        setExpectedDiff(m);
      }
    } catch (e) {
      console.error(e);
      setCalculatedProb(null);
      setExpectedDiff(null);
    }
  };

  useEffect(() => {
    if (calculatedProb === null || !resultsRef.current) return;
    requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [calculatedProb]);

  useEffect(() => {
    if (!showFreeCalcModal || !modalRef.current) return;
    requestAnimationFrame(() => {
      modalRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      modalRef.current?.focus();
    });
  }, [showFreeCalcModal]);

  const handleUpgrade = async () => {
    setIsUpgradeLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/stripe/create-checkout-session`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Unable to start checkout');
      }

      const data = await response.json();

      if (data.url) {
        window.location.assign(data.url);
        return;
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsUpgradeLoading(false);
    }
  };

  const selectedTeamName = useMemo(() => {
    if (activeSport === CONSTANTS.SPORTS.HOCKEY) {
      const home = hockeyStats.teamAName?.trim() || 'Home';
      const away = hockeyStats.teamBName?.trim() || 'Away';
      return `${away} @ ${home}`;
    }
    const current = activeSport === CONSTANTS.SPORTS.FOOTBALL ? footballStats : basketballStats;
    return current.teamAName?.trim() || 'Your Team';
  }, [activeSport, basketballStats, footballStats, hockeyStats]);

  const formattedMargin = useMemo(() => {
    if (expectedDiff === null) return null;
    return `${expectedDiff > 0 ? '+' : ''}${expectedDiff.toFixed(1)}`;
  }, [expectedDiff]);

  // UPDATED: Store matchup data when applying to Kelly
  const handleApplyAndSwitch = (prob: number) => {
    setProbability(prob.toFixed(2));

    // Build matchup data for bet logging
    let matchupData: MatchupData;

    if (activeSport === CONSTANTS.SPORTS.HOCKEY) {
      matchupData = {
        sport: 'hockey',
        teamA: {
          name: hockeyStats.teamAName || 'Home Team',
          abbreviation: hockeyStats.teamAName || undefined,
          stats: {
            xgf60: parseFloat(hockeyStats.homeXgf60) || 0,
            xga60: parseFloat(hockeyStats.homeXga60) || 0,
            gsax60: parseFloat(hockeyStats.homeGsax60) || 0,
            hdcf60: parseFloat(hockeyStats.homeHdcf60) || 0
          }
        },
        teamB: {
          name: hockeyStats.teamBName || 'Away Team',
          abbreviation: hockeyStats.teamBName || undefined,
          stats: {
            xgf60: parseFloat(hockeyStats.awayXgf60) || 0,
            xga60: parseFloat(hockeyStats.awayXga60) || 0,
            gsax60: parseFloat(hockeyStats.awayGsax60) || 0,
            hdcf60: parseFloat(hockeyStats.awayHdcf60) || 0
          }
        },
        venue: 'home' // Hockey always shows home/away
      };
    } else {
      const stats = activeSport === CONSTANTS.SPORTS.FOOTBALL ? footballStats : basketballStats;
      matchupData = {
        sport: activeSport as 'football' | 'basketball',
        teamA: {
          name: stats.teamAName || 'Team A',
          abbreviation: stats.teamAName || undefined,
          stats: activeSport === CONSTANTS.SPORTS.FOOTBALL
            ? {
                pointsFor: parseFloat(stats.teamPointsFor) || 0,
                pointsAgainst: parseFloat(stats.teamPointsAgainst) || 0,
                offYards: parseFloat(stats.teamOffYards) || 0,
                defYards: parseFloat(stats.teamDefYards) || 0,
                turnoverDiff: parseFloat(stats.teamTurnoverDiff) || 0
              }
            : {
                pointsFor: parseFloat(stats.teamPointsFor) || 0,
                pointsAgainst: parseFloat(stats.teamPointsAgainst) || 0,
                fgPct: parseFloat(stats.teamFgPct) || 0,
                reboundMargin: parseFloat(stats.teamReboundMargin) || 0,
                turnoverMargin: parseFloat(stats.teamTurnoverMargin) || 0
              }
        },
        teamB: {
          name: stats.teamBName || 'Team B',
          abbreviation: stats.teamBName || undefined,
          stats: activeSport === CONSTANTS.SPORTS.FOOTBALL
            ? {
                pointsFor: parseFloat(stats.opponentPointsFor) || 0,
                pointsAgainst: parseFloat(stats.opponentPointsAgainst) || 0,
                offYards: parseFloat(stats.opponentOffYards) || 0,
                defYards: parseFloat(stats.opponentDefYards) || 0,
                turnoverDiff: parseFloat(stats.opponentTurnoverDiff) || 0
              }
            : {
                pointsFor: parseFloat(stats.opponentPointsFor) || 0,
                pointsAgainst: parseFloat(stats.opponentPointsAgainst) || 0,
                fgPct: parseFloat(stats.opponentFgPct) || 0,
                reboundMargin: parseFloat(stats.opponentReboundMargin) || 0,
                turnoverMargin: parseFloat(stats.opponentTurnoverMargin) || 0
              }
        },
        venue: isTeamAHome === null ? 'neutral' : isTeamAHome ? 'home' : 'away'
      };
    }

    const estimationData: EstimationData = {
      pointSpread: activeSport === CONSTANTS.SPORTS.HOCKEY ? parseFloat(totalGoalsLine) : parseFloat(pointSpread),
      calculatedProbability: prob,
      expectedMargin: expectedDiff || undefined
    };

    setCurrentMatchup(matchupData);
    setCurrentEstimation(estimationData);
    setActiveTab(CONSTANTS.TABS.KELLY);
  };

  const handleSwap = () => {
    if (activeSport === CONSTANTS.SPORTS.HOCKEY) {
      // For hockey, swap home and away teams
      setHockeyStats({
        homeXgf60: hockeyStats.awayXgf60,
        homeXga60: hockeyStats.awayXga60,
        homeGsax60: hockeyStats.awayGsax60,
        homeHdcf60: hockeyStats.awayHdcf60,
        awayXgf60: hockeyStats.homeXgf60,
        awayXga60: hockeyStats.homeXga60,
        awayGsax60: hockeyStats.homeGsax60,
        awayHdcf60: hockeyStats.homeHdcf60,
        teamAName: hockeyStats.teamBName,
        teamBName: hockeyStats.teamAName,
      });
    } else if (activeSport === CONSTANTS.SPORTS.FOOTBALL) {
      setFootballStats({
        teamPointsFor: footballStats.opponentPointsFor,
        opponentPointsFor: footballStats.teamPointsFor,
        teamPointsAgainst: footballStats.opponentPointsAgainst,
        opponentPointsAgainst: footballStats.teamPointsAgainst,
        teamOffYards: footballStats.opponentOffYards,
        opponentOffYards: footballStats.teamOffYards,
        teamDefYards: footballStats.opponentDefYards,
        opponentDefYards: footballStats.teamDefYards,
        teamTurnoverDiff: footballStats.opponentTurnoverDiff,
        opponentTurnoverDiff: footballStats.teamTurnoverDiff,
        teamAName: footballStats.teamBName,
        teamBName: footballStats.teamAName,
      });
    } else {
      setBasketballStats({
        teamPointsFor: basketballStats.opponentPointsFor,
        opponentPointsFor: basketballStats.teamPointsFor,
        teamPointsAgainst: basketballStats.opponentPointsAgainst,
        opponentPointsAgainst: basketballStats.teamPointsAgainst,
        teamFgPct: basketballStats.opponentFgPct,
        opponentFgPct: basketballStats.teamFgPct,
        teamReboundMargin: basketballStats.opponentReboundMargin,
        opponentReboundMargin: basketballStats.teamReboundMargin,
        teamTurnoverMargin: basketballStats.opponentTurnoverMargin,
        opponentTurnoverMargin: basketballStats.teamTurnoverMargin,
        teamAName: basketballStats.teamBName,
        teamBName: basketballStats.teamAName,
      });
    }

    if (pointSpread !== '') {
      const currentSpread = parseFloat(pointSpread);
      if (!isNaN(currentSpread)) {
        setPointSpread((-currentSpread).toString());
      }
    }

    if (isTeamAHome !== null) {
      setIsTeamAHome(!isTeamAHome);
    }
  };

  return (
    <div className="panel panel-strong">
      <div className="tabs nested-tabs" role="tablist" aria-label="Sport selector">
        <button className={`tab ${activeSport === CONSTANTS.SPORTS.FOOTBALL ? 'active' : ''}`}
                onClick={()=>setActiveSport(CONSTANTS.SPORTS.FOOTBALL)}>Football</button>
        <button className={`tab ${activeSport === CONSTANTS.SPORTS.BASKETBALL ? 'active' : ''}`}
                onClick={()=>setActiveSport(CONSTANTS.SPORTS.BASKETBALL)}>Basketball</button>
        <button className={`tab ${activeSport === CONSTANTS.SPORTS.HOCKEY ? 'active' : ''}`}
                onClick={()=>setActiveSport(CONSTANTS.SPORTS.HOCKEY)}>NHL</button>
      </div>

      <div className="progress-container">
        <div className={`progress-step ${progress.spread ? 'completed' : progress.stats === 0 ? 'active' : ''}`}>
          {progress.spread ? '✓' : '1'} {activeSport === CONSTANTS.SPORTS.HOCKEY ? 'Total Goals Line' : 'Point Spread'}
        </div>
        <div className={`progress-step ${progress.allComplete ? 'completed' : progress.spread ? 'active' : ''}`}>
          {progress.allComplete ? '✓' : progress.stats}/{progress.totalStats} Team Stats
        </div>
      </div>

      {progress.stats === 0 && (activeSport === CONSTANTS.SPORTS.HOCKEY ? !totalGoalsLine : !pointSpread) && (
        <div className="empty-state">
          <h3>Get Started</h3>
          <p>Enter team statistics and {activeSport === CONSTANTS.SPORTS.HOCKEY ? 'total goals line to calculate over/under probability' : 'point spread to calculate win probability'}</p>
          <button className="try-example-btn" onClick={loadExample}>
            Try Example Data
          </button>
        </div>
      )}

      {activeSport === CONSTANTS.SPORTS.HOCKEY ? (
        <div className="input-group">
          <label htmlFor="totalGoalsLine">
            Total Goals (Over/Under)
            <span className="tooltip">
              <span className="help-icon">?</span>
              <span className="tooltiptext">The sportsbook's total goals line for the game (e.g., 5.5, 6.0)</span>
            </span>
          </label>
          <input id="totalGoalsLine" type="number" name="totalGoalsLine" value={totalGoalsLine}
                 onChange={(e)=>setTotalGoalsLine(e.target.value)} className="input-field" placeholder="e.g., 5.5 or 6" step="0.5" />
          <p style={{fontSize:'.8rem', color:'var(--text-muted)'}}>
            Positive = Over, Negative = Under
          </p>
        </div>
      ) : (
        <>
          <div className="input-group">
            <label htmlFor="pointSpread">
              Point Spread (Your Team)
              <span className="tooltip">
                <span className="help-icon">?</span>
                <span className="tooltiptext">Negative = your team favored (e.g., -6.5 means your team must win by more than 6.5). Positive = underdog</span>
              </span>
            </label>
            <input id="pointSpread" type="number" name="pointSpread" value={pointSpread}
                   onChange={(e)=>setPointSpread(e.target.value)} className="input-field" placeholder="e.g., -6.5 or 3" step="0.5" />
            <p style={{fontSize:'.8rem', color:'var(--text-muted)'}}>
              Negative = your team favored, Positive = your team underdog
            </p>
          </div>

          <div className="input-group">
            <label htmlFor="venue">
              Venue
              <span className="tooltip">
                <span className="help-icon">?</span>
                <span className="tooltiptext">Home field advantage is worth ~2.5 pts (NFL) or ~3 pts (NBA)</span>
              </span>
            </label>
            <select
              id="venue"
              className="input-field"
              value={isTeamAHome === null ? 'neutral' : isTeamAHome ? 'home' : 'away'}
          onChange={(e) => {
            const val = e.target.value;
            setIsTeamAHome(val === 'neutral' ? null : val === 'home');
          }}
        >
          <option value="neutral">Neutral Site</option>
          <option value="home">Your Team is Home</option>
          <option value="away">Your Team is Away</option>
            </select>
          </div>
        </>
      )}

      <Suspense fallback={<div style={{padding:'2rem', textAlign:'center', color:'var(--text-muted)'}}>Loading...</div>}>
        {activeSport === CONSTANTS.SPORTS.FOOTBALL ? (
          <FootballEstimator
            stats={footballStats}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setFootballStats({ ...footballStats, [e.target.name]: e.target.value })}
          />
        ) : activeSport === CONSTANTS.SPORTS.BASKETBALL ? (
          <BasketballEstimator
            stats={basketballStats}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setBasketballStats({ ...basketballStats, [e.target.name]: e.target.value })}
          />
        ) : (
          <HockeyEstimator
            stats={hockeyStats}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setHockeyStats({ ...hockeyStats, [e.target.name]: e.target.value })}
          />
        )}
      </Suspense>

      {/* Over/Under Toggle for NHL */}
      {activeSport === CONSTANTS.SPORTS.HOCKEY && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          marginBottom: '1rem'
        }}>
          <button
            type="button"
            onClick={() => setIsOverBet(true)}
            style={{
              flex: '1',
              maxWidth: '140px',
              padding: '0.85rem 1.5rem',
              fontSize: '1rem',
              fontWeight: 700,
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'all 0.25s ease',
              border: 'none',
              background: isOverBet
                ? 'var(--accent-gradient)'
                : 'var(--glass-surface)',
              color: 'var(--text-primary)',
              boxShadow: isOverBet
                ? '0 8px 24px rgba(59, 130, 246, 0.35)'
                : 'none'
            }}
          >
            OVER
          </button>
          <span style={{
            color: 'var(--text-secondary)',
            fontWeight: 600,
            fontSize: '0.95rem'
          }}>
            OR
          </span>
          <button
            type="button"
            onClick={() => setIsOverBet(false)}
            style={{
              flex: '1',
              maxWidth: '140px',
              padding: '0.85rem 1.5rem',
              fontSize: '1rem',
              fontWeight: 700,
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'all 0.25s ease',
              border: 'none',
              background: !isOverBet
                ? 'var(--accent-gradient)'
                : 'var(--glass-surface)',
              color: 'var(--text-primary)',
              boxShadow: !isOverBet
                ? '0 8px 24px rgba(59, 130, 246, 0.35)'
                : 'none'
            }}
          >
            UNDER
          </button>
        </div>
      )}

      <div style={{display:'flex', gap:'.75rem', flexWrap:'wrap'}}>
        <button className="btn-primary" onClick={handleCalculate} disabled={!isFormValid} style={{flex:'1'}}>
          Calculate Probability
        </button>
        {activeSport !== CONSTANTS.SPORTS.HOCKEY && (
          <button
            className="btn-secondary"
            onClick={handleSwap}
            style={{flex:'0 0 auto', minWidth:'150px'}}
            title="Swap team and opponent values to see probability from the other perspective"
          >
            ⇄ Swap Teams
          </button>
        )}
      </div>

      {calculatedProb !== null && (
        <div ref={resultsRef} className="results" role="status" aria-live="polite">
          <p>{activeSport === CONSTANTS.SPORTS.HOCKEY ? `Estimated ${isOverBet ? 'Over' : 'Under'} Probability` : 'Estimated Cover Probability'}</p>
          <h2 className="results-team" style={{margin:'0.25rem 0 0.35rem'}}>{selectedTeamName}</h2>
          <div className="matchup-result-stats">
            <div className="matchup-result-value">
              {calculatedProb.toFixed(2)}%
            </div>
            {formattedMargin !== null && (
              <div className="matchup-result-margin">
                {activeSport === CONSTANTS.SPORTS.HOCKEY
                  ? `Projected Total: ${expectedDiff?.toFixed(2)} goals`
                  : `Predicted Margin: ${formattedMargin} pts`}
              </div>
            )}
          </div>
          <div style={{marginTop:'.6rem'}}>
            <button className="btn-primary" onClick={()=>handleApplyAndSwitch(calculatedProb!)}>
              Use in Kelly Calculator →
            </button>
          </div>
        </div>
      )}

      {showFreeCalcModal && (
        <div style={styles.freeCalcOverlay} role="dialog" aria-live="polite">
          <div style={styles.freeCalcModal} tabIndex={-1} ref={modalRef}>
            <div style={styles.freeCalcBadge}>✨ Free Core Preview</div>
            <h3 style={styles.freeCalcTitle}>You have {freeCalculationsLeft ?? 0} free probability checks left</h3>
            <p style={styles.freeCalcDescription}>
              Upgrade to Core Access for unlimited calculations, premium insights, and uninterrupted flow.
            </p>
            <div style={styles.freeCalcActions}>
              <button
                type="button"
                onClick={() => setShowFreeCalcModal(false)}
                style={styles.freeCalcGhostButton}
              >
                Continue free
              </button>
              <button
                type="button"
                onClick={handleUpgrade}
                style={styles.freeCalcPrimaryButton}
                disabled={isUpgradeLoading}
              >
                {isUpgradeLoading ? 'Redirecting...' : 'Upgrade to Core Access'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  freeCalcOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(5, 5, 16, 0.82)',
    backdropFilter: 'blur(6px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    zIndex: 9999,
  },
  freeCalcModal: {
    maxWidth: '420px',
    width: '100%',
    background: 'linear-gradient(160deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.95))',
    borderRadius: '24px',
    padding: '28px',
    border: '1px solid rgba(148, 163, 184, 0.2)',
    boxShadow: '0 25px 60px rgba(0, 0, 0, 0.55)',
    textAlign: 'center',
  },
  freeCalcBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '6px 12px',
    borderRadius: '999px',
    background: 'rgba(59, 130, 246, 0.2)',
    color: '#bfdbfe',
    fontWeight: 600,
    fontSize: '0.8rem',
    letterSpacing: '0.02em',
    marginBottom: '16px',
  },
  freeCalcTitle: {
    color: '#f8fafc',
    fontSize: '1.4rem',
    margin: '0 0 12px',
  },
  freeCalcDescription: {
    color: 'rgba(226, 232, 240, 0.8)',
    fontSize: '0.95rem',
    marginBottom: '22px',
    lineHeight: 1.5,
  },
  freeCalcActions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  freeCalcGhostButton: {
    padding: '10px 18px',
    borderRadius: '12px',
    border: '1px solid rgba(148, 163, 184, 0.4)',
    background: 'transparent',
    color: '#e2e8f0',
    fontWeight: 600,
    cursor: 'pointer',
  },
  freeCalcPrimaryButton: {
    padding: '10px 18px',
    borderRadius: '12px',
    border: 'none',
    background: 'linear-gradient(135deg, #38bdf8, #6366f1)',
    color: '#fff',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 12px 30px rgba(59, 130, 246, 0.45)',
  },
};

/* ============================== Kelly Calculator =========================== */
const calculateImpliedProbability = (americanOdds: string): number | null => {
  const odds = parseFloat(americanOdds);
  if (isNaN(odds)) return null;
  if (odds < 0) {
    return (-odds) / (-odds + 100) * 100;
  }
  return 100 / (odds + 100) * 100;
};

type HistoryEntry = { bankroll:string; odds:string; probability:string; stake:number; timestamp:number };

const DEFAULT_BANKROLL = '1000.00';

function KellyCalculator({
  probability,
  setProbability,
  // NEW: Props for bet logging
  isAuthenticated,
  matchupData,
  estimationData,
  onLoginRequired,
  bankrollRefreshTrigger
}: {
  probability: string;
  setProbability: (v: string) => void;
  isAuthenticated: boolean;
  matchupData: MatchupData | null;
  estimationData: EstimationData | null;
  onLoginRequired: () => void;
  bankrollRefreshTrigger?: number;
}) {
  const [bankroll, setBankroll] = useState(DEFAULT_BANKROLL);
  const [savedBankroll, setSavedBankroll] = useState(DEFAULT_BANKROLL); // Track saved value
  const [isSavingBankroll, setIsSavingBankroll] = useState(false);
  const [odds, setOdds] = useState('-110');
  const [fraction, setFraction] = useState('1');
  const [explanation, setExplanation] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Check if bankroll has been manually changed
  const hasBankrollChanged = bankroll !== savedBankroll;

  // Load persisted bankroll on mount
  useEffect(() => {
    const storedBankroll = localStorage.getItem('kelly-bankroll');
    if (storedBankroll !== null) {
      setBankroll(storedBankroll);
      setSavedBankroll(storedBankroll);
    }
  }, []);

  // Persist bankroll changes without interfering with typing (debounced)
  useEffect(() => {
    const handle = setTimeout(() => {
      localStorage.setItem('kelly-bankroll', bankroll);
    }, 500);

    return () => clearTimeout(handle);
  }, [bankroll]);

  const validation = useMemo(() => {
    const numBankroll = parseFloat(bankroll);
    const americanOdds = parseFloat(odds);
    const numProbability = parseFloat(probability);

    return {
      bankroll: bankroll === '' ? null : (numBankroll > 0),
      odds: odds === '' ? null : (americanOdds <= -100 || americanOdds >= 100),
      probability: probability === '' ? null : (numProbability > 0 && numProbability < 100)
    };
  }, [bankroll, odds, probability]);

  const { stake, stakePercentage, hasValue } = useMemo(() => {
    const numBankroll = parseFloat(bankroll);
    const americanOdds = parseFloat(odds);
    const numProbability = parseFloat(probability) / 100;
    const numFraction = parseFloat(fraction);

    if (isNaN(numBankroll) || numBankroll <= 0 ||
        isNaN(americanOdds) || (americanOdds > -100 && americanOdds < 100) ||
        isNaN(numProbability) || numProbability <= 0 || numProbability >= 1) {
      return { stake:0, stakePercentage:0, hasValue:false };
    }
    const decimalOdds = americanOdds > 0 ? (americanOdds/100)+1 : (100/Math.abs(americanOdds))+1;
    const b = decimalOdds - 1;
    const k = ((b * numProbability) - (1 - numProbability)) / b;
    if (k <= 0) return { stake:0, stakePercentage:0, hasValue:false };
    const calculatedStake = numBankroll * k * numFraction;
    const calculatedPercentage = k*100*numFraction;
    return {
      stake: calculatedStake,
      stakePercentage: calculatedPercentage,
      hasValue:true
    };
  }, [bankroll, odds, probability, fraction]);

  const { impliedProb, edge, edgeColor } = useMemo(() => {
    const implied = calculateImpliedProbability(odds);
    const userProb = parseFloat(probability);

    if (!implied || isNaN(userProb)) return { impliedProb: null, edge: null, edgeColor: 'grey' };

    const currentEdge = userProb - implied;
    const color = currentEdge > 0 ? '#10b981' : '#ef4444';

    return {
      impliedProb: implied,
      edge: currentEdge,
      edgeColor: color
    };
  }, [odds, probability]);

  useEffect(() => {
    if (hasValue && stake > 0) {
      const newEntry: HistoryEntry = {
        bankroll, odds, probability, stake, timestamp: Date.now()
      };
      setHistory(prev => [newEntry, ...prev.slice(0, 4)]);
    }
  }, [stake, hasValue, bankroll, odds, probability]);

  const handleBankrollChange = (value: string) => {
    setBankroll(value);
  };

  // Function to fetch bankroll from backend
  const fetchBankroll = async () => {
    if (!isAuthenticated) return;

    try {
      const response = await fetch(`${BACKEND_URL}/auth/bankroll`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        if (data.bankroll !== undefined) {
          const bankrollValue = formatBankrollValue(data.bankroll);
          setBankroll(bankrollValue);
          setSavedBankroll(bankrollValue); // Also update saved value
        } else {
          setBankroll(DEFAULT_BANKROLL);
          setSavedBankroll(DEFAULT_BANKROLL);
        }
      }
    } catch (error) {
      console.error('Failed to fetch bankroll:', error);
    }
  };

  // Fetch bankroll when authenticated or when refresh is triggered
  useEffect(() => {
    fetchBankroll();
  }, [isAuthenticated, bankrollRefreshTrigger]);

  useEffect(() => {
    if (!probability) return;
    const getExplanation = async () => {
      setIsGenerating(true); setExplanation('');
      try {
        const systemInstruction =
          "You are an elite betting analyst. Give sharp, 1–2 sentence insights explaining each Kelly Criterion recommendation. Be confident, direct, and responsibly bold with a touch of sass. Keep explanations concise, varied, and never repetitive.";
        const userPrompt = hasValue
          ? `A user's inputs (Bankroll: ${formatCurrency(bankroll)}, Odds: ${odds}, Win Probability: ${probability}%) result in a recommended stake of ${formatCurrency(stake)} (${stakePercentage.toFixed(2)}%). Provide a concise, 1-2 sentence explanation.`
          : `A user's inputs (Bankroll: ${formatCurrency(bankroll)}, Odds: ${odds}, Win Probability: ${probability}%) indicate a "No Value" bet. Provide a concise explanation emphasizing bankroll protection.`;
        const response = await fetchFromApi(userPrompt, systemInstruction);
        setExplanation(response.text);
      } catch (e:any) {
        setExplanation(e?.message || "Could not generate an analysis at this time.");
      } finally { setIsGenerating(false); }
    };
    const t = setTimeout(getExplanation, 500);
    return () => clearTimeout(t);
  }, [stake, stakePercentage, hasValue, bankroll, odds, probability]);

  const loadHistoryItem = (item: HistoryEntry) => {
    setBankroll(formatBankrollValue(item.bankroll));
    setOdds(item.odds);
    setProbability(item.probability);
  };

  const getValidationClass = (isValid: boolean|null) => {
    if (isValid === null) return '';
    return isValid ? 'valid' : 'invalid';
  };

  // Save bankroll to backend when user clicks Save button
  const handleSaveBankroll = async () => {
    if (!isAuthenticated) {
      alert('Please login to save your bankroll.');
      return;
    }

    const numBankroll = parseFloat(bankroll);
    if (isNaN(numBankroll) || numBankroll < 0) {
      alert('Please enter a valid positive bankroll amount.');
      return;
    }

    // Confirm save
    if (!confirm(`Save bankroll as $${numBankroll.toFixed(2)}?`)) {
      return;
    }

    setIsSavingBankroll(true);
    try {
      const response = await fetch(`${BACKEND_URL}/auth/bankroll`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ bankroll: numBankroll })
      });

      if (response.ok) {
        setSavedBankroll(bankroll); // Update saved value
        alert('Bankroll saved successfully!');
      } else {
        alert('Failed to save bankroll. Please try again.');
      }
    } catch (error) {
      console.error('Failed to save bankroll:', error);
      alert('Failed to save bankroll. Please try again.');
    } finally {
      setIsSavingBankroll(false);
    }
  };

  // Check if we have complete data for bet logging
  const canLogBet = hasValue && matchupData && estimationData;

  return (
    <div className="panel">
      <div className="input-group">
        <label htmlFor="bankroll">
          Bankroll
          <span className="tooltip">
            <span className="help-icon">?</span>
            <span className="tooltiptext">Total amount of money available for betting</span>
          </span>
        </label>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
          <input
            id="bankroll"
            type="text"
            className={`input-field ${getValidationClass(validation.bankroll)}`}
            value={bankroll}
            onChange={(e)=>handleBankrollChange(e.target.value)}
            placeholder="e.g., 1000"
            style={{ flex: 1 }}
            inputMode="decimal"
          />
          {isAuthenticated && hasBankrollChanged && (
            <button
              onClick={handleSaveBankroll}
              disabled={isSavingBankroll || validation.bankroll === false}
              className="save-bankroll-btn"
              style={{
                padding: '0.5rem 1rem',
                background: 'var(--accent)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: isSavingBankroll ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: '0.875rem',
                whiteSpace: 'nowrap',
                opacity: validation.bankroll === false ? 0.5 : 1
              }}
            >
              {isSavingBankroll ? 'Saving...' : 'Save'}
            </button>
          )}
        </div>
        {validation.bankroll === false && <div className="error-message">⚠ Bankroll must be positive</div>}
        {isAuthenticated && hasBankrollChanged && validation.bankroll !== false && (
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            💡 Click "Save" to update your bankroll
          </div>
        )}
        {!isAuthenticated && (
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Default bankroll is set to $1,000. Sign in with Google to save your preferred bankroll size.
          </div>
        )}
      </div>

      <div className="input-group">
        <label htmlFor="odds">
          American Odds
          <span className="tooltip">
            <span className="help-icon">?</span>
            <span className="tooltiptext">Negative = favorite (e.g., -110), Positive = underdog (e.g., +150)</span>
          </span>
        </label>
        <input
          id="odds"
          type="number"
          className={`input-field ${getValidationClass(validation.odds)}`}
          value={odds}
          onChange={(e)=>setOdds(e.target.value)}
          placeholder="e.g., -110 or 150"
        />
        {validation.odds === false && <div className="error-message">⚠ Odds must be ≤-100 or ≥100</div>}
      </div>

      <div className="input-group">
        <label htmlFor="probability">
          Win Probability (%)
          <span className="tooltip">
            <span className="help-icon">?</span>
            <span className="tooltiptext">Your estimated probability of winning (0-100%)</span>
          </span>
        </label>
        <div className="slider-group">
          <input
            id="probability"
            type="number"
            className={`input-field ${getValidationClass(validation.probability)}`}
            value={probability}
            onChange={(e)=>setProbability(e.target.value)}
            min="0"
            max="100"
            step="0.1"
          />
          <input type="range" min="0" max="100" value={probability} step="0.1" className="slider" onChange={(e)=>setProbability(e.target.value)} />
        </div>
        {validation.probability === false && <div className="error-message">⚠ Probability must be between 0 and 100</div>}
      </div>

      <div className="input-group">
        <label htmlFor="fraction">
          Kelly Fraction
          <span className="tooltip">
            <span className="help-icon">?</span>
            <span className="tooltiptext">Half Kelly (0.5x) reduces volatility</span>
          </span>
        </label>
        <select id="fraction" className="input-field" value={fraction} onChange={(e)=>setFraction(e.target.value)}>
          <option value="1">Full Kelly (1x)</option>
          <option value="0.5">Half Kelly (0.5x)</option>
          <option value="0.25">Quarter Kelly (0.25x)</option>
        </select>
      </div>

      {hasValue ? (
        <div className="results">
          <p>Recommended Stake</p>
          <h2>{formatCurrency(stake)}</h2>
          <div className="results-details">
            <span>{stakePercentage.toFixed(2)}% of Bankroll</span>
          </div>

          {/* NEW: Log Bet Button */}
          {canLogBet && (
            <LogBetButton
              sport={matchupData!.sport}
              teamA={matchupData!.teamA}
              teamB={matchupData!.teamB}
              venue={matchupData!.venue}
              pointSpread={estimationData!.pointSpread}
              calculatedProbability={estimationData!.calculatedProbability}
              expectedMargin={estimationData!.expectedMargin}
              impliedProbability={impliedProb || undefined}
              edge={edge || undefined}
              bankroll={parseFloat(bankroll)}
              americanOdds={parseFloat(odds)}
              kellyFraction={parseFloat(fraction)}
              recommendedStake={stake}
              stakePercentage={stakePercentage}
              isAuthenticated={isAuthenticated}
              onLoginRequired={onLoginRequired}
              onBankrollUpdate={fetchBankroll}
            />
          )}

          {/* Show sign-in prompt if no matchup data or not authenticated */}
          {!canLogBet && hasValue && (
            <div style={{ marginTop: '1rem', padding: '.75rem', background: 'rgba(99,102,241,.1)', borderRadius: '.5rem', textAlign: 'center' }}>
              {!isAuthenticated ? (
                <button className="log-bet-btn" style={{ opacity: 0.8 }} onClick={onLoginRequired}>
                  🔒 Sign in to Log Bets
                </button>
              ) : (
                <p style={{ color: 'var(--text-muted)', fontSize: '.9rem', margin: 0 }}>
                  💡 Use the Probability Estimator first to enable bet logging with full matchup data
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="results no-value"><h2>No Value - Do Not Bet</h2></div>
      )}

      {impliedProb !== null && edge !== null && (
        <div style={{
          marginTop: '1rem',
          padding: '.75rem',
          borderRadius: '.6rem',
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.9rem'
        }}>
          <div>
            <span style={{color: 'var(--text-muted)', display:'block', fontSize:'.75rem'}}>Implied Win %</span>
            <strong>{impliedProb.toFixed(1)}%</strong>
          </div>
          <div style={{textAlign: 'right'}}>
            <span style={{color: 'var(--text-muted)', display:'block', fontSize:'.75rem'}}>Your Edge</span>
            <strong style={{color: edgeColor}}>
              {edge > 0 ? '+' : ''}{edge.toFixed(1)}%
            </strong>
          </div>
        </div>
      )}

      <div className="analyst-insight">
        <h3 style={{marginTop:0}}>Analyst's Insight</h3>
        {isGenerating && (
          <p style={{display:'flex', alignItems:'center'}}>
            <span className="loading-spinner"></span>
            Analyst is analyzing your bet...
          </p>
        )}
        {!isGenerating && explanation && <p>{explanation}</p>}
      </div>

      {history.length > 0 && (
        <div className="history-panel">
          <h3 style={{marginTop:0, marginBottom:'.75rem', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <span>Recent Calculations</span>
            <button
              className="btn-secondary"
              style={{width:'auto', padding:'.3rem .6rem', fontSize:'.8rem'}}
              onClick={() => setShowHistory(!showHistory)}
            >
              {showHistory ? 'Hide' : 'Show'}
            </button>
          </h3>
          {showHistory && history.map((item, i) => (
            <div key={item.timestamp} className="history-item" onClick={() => loadHistoryItem(item)}>
              <div>
                <strong>{formatCurrency(item.stake)}</strong>
                <div style={{fontSize:'.75rem', color:'var(--text-muted)'}}>
                  Bankroll: {formatCurrency(item.bankroll)} | Odds: {item.odds} | Prob: {item.probability}%
                </div>
              </div>
              <span style={{fontSize:'.75rem', color:'var(--text-muted)'}}>Load</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
/* ================================== App =================================== */
function App() {
  const [activeTab, setActiveTab] = useState(CONSTANTS.TABS.KELLY);
  const [probability, setProbability] = useState('60');

  const [theme, setTheme] = useState<ThemeKey>('midnight');

  // Probability estimator state
  const [activeSport, setActiveSport] = useState(CONSTANTS.SPORTS.FOOTBALL);
  const [footballStats, setFootballStats] = useState(initialFootballState);
  const [basketballStats, setBasketballStats] = useState(initialBasketballState);
  const [hockeyStats, setHockeyStats] = useState(initialHockeyState);
  const [pointSpread, setPointSpread] = useState<string>('');
  const [totalGoalsLine, setTotalGoalsLine] = useState<string>('');
  const [calculatedProb, setCalculatedProb] = useState<number|null>(null);
  const [expectedDiff, setExpectedDiff] = useState<number|null>(null);
  const [isTeamAHome, setIsTeamAHome] = useState<boolean | null>(null);

  // Authentication state
  const [authUser, setAuthUser] = useState<{name: string; email: string; avatar: string} | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Documentation visibility
  const [isDocOpen, setIsDocOpen] = useState(false);

  useEffect(() => {
    const savedTheme = (localStorage.getItem('betgistics-theme') as ThemeKey | null);
    if (savedTheme && THEME_OPTIONS.some((option) => option.key === savedTheme)) {
      setTheme(savedTheme);
    }
  }, []);

  // Scroll to top when switching tabs for better UX
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Initialize native bridge for Android app
  useEffect(() => {
    initializeNativeBridge();

    // Handle Android back button
    const backHandler = onBackButton(() => {
      if (activeTab !== CONSTANTS.TABS.KELLY) {
        setActiveTab(CONSTANTS.TABS.KELLY);
      }
    });

    // Monitor network connectivity
    const networkHandler = onNetworkChange((status) => {
      if (!status.connected) {
        showToast('No internet connection. Some features may be unavailable.', 'long');
      }
    });

    return () => {
      backHandler.remove();
      networkHandler.remove();
    };
  }, [activeTab]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    localStorage.setItem('betgistics-theme', theme);
  }, [theme]);

  // NEW: State for bet logging data flow
  const [currentMatchup, setCurrentMatchup] = useState<MatchupData | null>(null);
  const [currentEstimation, setCurrentEstimation] = useState<EstimationData | null>(null);

  // Bankroll refresh trigger - increment to force refresh
  const [bankrollRefreshTrigger, setBankrollRefreshTrigger] = useState(0);

  // Check authentication status on mount
  useEffect(() => {
    async function checkAuth() {
      try {
        const response = await fetch(`${BACKEND_URL}/auth/status`, {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          if (data.authenticated && data.user) {
            setAuthUser(data.user);
          }
        }
      } catch (error) {
        console.error('Auth check failed:', error);
      } finally {
        setAuthLoading(false);
      }
    }
    checkAuth();
  }, []);

  // Demo Popover functionality
  useEffect(() => {
    const VIDEO_ID = "A6RZpBjjIns";

    const btn = document.getElementById("demoPopoverBtn");
    const popover = document.getElementById("demoPopover");
    const closeBtn = document.getElementById("demoPopoverClose");
    const iframe = document.getElementById("demoPopoverIframe") as HTMLIFrameElement | null;

    if (!btn || !popover || !closeBtn || !iframe) return;

    function setPopoverPosition() {
      if (!btn || !popover) return;
      const r = btn.getBoundingClientRect();
      const scrollX = window.scrollX || window.pageXOffset;
      const scrollY = window.scrollY || window.pageYOffset;

      // Left aligned to button, but keep on-screen
      const desiredLeft = r.left + scrollX;
      const maxLeft = scrollX + document.documentElement.clientWidth - popover.offsetWidth - 12;
      const left = Math.max(scrollX + 12, Math.min(desiredLeft, maxLeft));

      // Position above the button
      const top = r.top + scrollY - popover.offsetHeight - 10;

      popover.style.left = `${left}px`;
      popover.style.top = `${top}px`;
    }

    function openPopover(pushUrl = true) {
      if (!popover || !iframe) return;
      popover.classList.add("is-open");
      popover.setAttribute("aria-hidden", "false");

      setPopoverPosition();

      // load video only when open
      iframe.src = `https://www.youtube.com/embed/${VIDEO_ID}`;

      // set shareable URL: ?demo=1
      if (pushUrl) {
        const url = new URL(window.location.href);
        url.searchParams.set("demo", "1");
        history.pushState({ demo: true }, "", url.toString());
      }
    }

    function closePopover(pushUrl = true) {
      if (!popover || !iframe) return;
      popover.classList.remove("is-open");
      popover.setAttribute("aria-hidden", "true");

      // stop playback
      iframe.src = "";

      // remove param
      if (pushUrl) {
        const url = new URL(window.location.href);
        url.searchParams.delete("demo");
        history.pushState({ demo: false }, "", url.toString());
      }
    }

    const handleBtnClick = () => {
      if (!popover) return;
      const isOpen = popover.classList.contains("is-open");
      if (isOpen) closePopover(true);
      else openPopover(true);
    };

    const handleCloseClick = () => closePopover(true);

    const handleDocumentClick = (e: MouseEvent) => {
      if (!popover || !btn) return;
      if (!popover.classList.contains("is-open")) return;
      if (popover.contains(e.target as Node) || btn.contains(e.target as Node)) return;
      closePopover(true);
    };

    const handleKeydown = (e: KeyboardEvent) => {
      if (!popover) return;
      if (e.key === "Escape" && popover.classList.contains("is-open")) closePopover(true);
    };

    const handleResize = () => {
      if (!popover) return;
      if (popover.classList.contains("is-open")) setPopoverPosition();
    };

    const handleScroll = () => {
      if (!popover) return;
      if (popover.classList.contains("is-open")) setPopoverPosition();
    };

    const handlePopstate = () => {
      if (!popover) return;
      const url = new URL(window.location.href);
      const shouldOpen = url.searchParams.get("demo") === "1";
      const isOpen = popover.classList.contains("is-open");

      if (shouldOpen && !isOpen) openPopover(false);
      if (!shouldOpen && isOpen) closePopover(false);
    };

    // auto-open if page loads with ?demo=1
    const url = new URL(window.location.href);
    if (url.searchParams.get("demo") === "1") openPopover(false);

    // Add event listeners
    btn.addEventListener("click", handleBtnClick);
    closeBtn.addEventListener("click", handleCloseClick);
    document.addEventListener("click", handleDocumentClick);
    window.addEventListener("keydown", handleKeydown);
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, { passive: true } as any);
    window.addEventListener("popstate", handlePopstate);

    // Cleanup
    return () => {
      btn.removeEventListener("click", handleBtnClick);
      closeBtn.removeEventListener("click", handleCloseClick);
      document.removeEventListener("click", handleDocumentClick);
      window.removeEventListener("keydown", handleKeydown);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("popstate", handlePopstate);
    };
  }, []);

  // Authentication handlers
  const handleGoogleLogin = () => {
    window.location.href = `${BACKEND_URL}/auth/google`;
  };

  const handleLogout = () => {
    window.location.href = `${BACKEND_URL}/auth/logout`;
  };

  const getTeamAbbreviation = (fullName: string): string => {
    if (!fullName) return '';
    const words = fullName.trim().split(' ');
    return words[words.length - 1];
  };

  // Handler to transfer NBA matchup data to Basketball Estimator
  const handleTransferToEstimator = (matchupData: any) => {
    setBasketballStats({
      teamPointsFor: matchupData.teamA.points_per_game?.toFixed(1) || '',
      opponentPointsFor: matchupData.teamB.points_per_game?.toFixed(1) || '',
      teamPointsAgainst: matchupData.teamA.points_allowed?.toFixed(1) || '',
      opponentPointsAgainst: matchupData.teamB.points_allowed?.toFixed(1) || '',
      teamFgPct: matchupData.teamA.field_goal_pct?.toFixed(1) || '',
      opponentFgPct: matchupData.teamB.field_goal_pct?.toFixed(1) || '',
      teamReboundMargin: matchupData.teamA.rebound_margin?.toFixed(1) || '',
      opponentReboundMargin: matchupData.teamB.rebound_margin?.toFixed(1) || '',
      teamTurnoverMargin: matchupData.teamA.turnover_margin?.toFixed(1) || '',
      opponentTurnoverMargin: matchupData.teamB.turnover_margin?.toFixed(1) || '',
      teamAName: getTeamAbbreviation(matchupData.teamA.team || ''),
      teamBName: getTeamAbbreviation(matchupData.teamB.team || ''),
    });
    setActiveSport(CONSTANTS.SPORTS.BASKETBALL);
    setActiveTab(CONSTANTS.TABS.ESTIMATOR);
  };

  // Handler to transfer NFL matchup data to Football Estimator
  const handleNFLTransferToEstimator = (matchupData: any) => {
    setFootballStats({
      teamPointsFor: matchupData.teamPointsFor || '',
      opponentPointsFor: matchupData.opponentPointsFor || '',
      teamPointsAgainst: matchupData.teamPointsAgainst || '',
      opponentPointsAgainst: matchupData.opponentPointsAgainst || '',
      teamOffYards: matchupData.teamOffYards || '',
      opponentOffYards: matchupData.opponentOffYards || '',
      teamDefYards: matchupData.teamDefYards || '',
      opponentDefYards: matchupData.opponentDefYards || '',
      teamTurnoverDiff: matchupData.teamTurnoverDiff || '',
      opponentTurnoverDiff: matchupData.opponentTurnoverDiff || '',
      teamAName: matchupData.teamAName || '',
      teamBName: matchupData.teamBName || '',
    });
    setActiveSport(CONSTANTS.SPORTS.FOOTBALL);
    setActiveTab(CONSTANTS.TABS.ESTIMATOR);
  };

  // Handler to transfer NHL matchup data to Hockey Estimator
  const handleNHLTransferToEstimator = (matchupData: any) => {
    setHockeyStats({
      homeXgf60: matchupData.homeXgf60?.toFixed(2) || '',
      homeXga60: matchupData.homeXga60?.toFixed(2) || '',
      homeGsax60: matchupData.homeGsax60?.toFixed(2) || '',
      homeHdcf60: matchupData.homeHdcf60?.toFixed(1) || '',
      homePP: matchupData.homePP?.toFixed(1) || '',
      homePK: matchupData.homePK?.toFixed(1) || '',
      homeTimesShorthanded: matchupData.homeTimesShorthanded?.toFixed(1) || '',
      awayXgf60: matchupData.awayXgf60?.toFixed(2) || '',
      awayXga60: matchupData.awayXga60?.toFixed(2) || '',
      awayGsax60: matchupData.awayGsax60?.toFixed(2) || '',
      awayHdcf60: matchupData.awayHdcf60?.toFixed(1) || '',
      awayPP: matchupData.awayPP?.toFixed(1) || '',
      awayPK: matchupData.awayPK?.toFixed(1) || '',
      awayTimesShorthanded: matchupData.awayTimesShorthanded?.toFixed(1) || '',
      teamAName: matchupData.homeTeamName || '',
      teamBName: matchupData.awayTeamName || '',
    });
    setActiveSport(CONSTANTS.SPORTS.HOCKEY);
    setActiveTab(CONSTANTS.TABS.ESTIMATOR);
  };

  // Handler for Walters Protocol to apply to Kelly Calculator
  const handleWaltersApplyToKelly = (probability: number, matchupData: any, estimationData: any) => {
    setProbability(probability.toFixed(2));
    setCurrentMatchup(matchupData);
    setCurrentEstimation(estimationData);
    setActiveTab(CONSTANTS.TABS.KELLY);
  };

  // Login redirect handler
  const handleLoginRequired = () => {
    window.location.href = `${BACKEND_URL}/auth/google`;
  };

  // Get SEO config based on active tab
  const getSEOForTab = () => {
    switch (activeTab) {
      case CONSTANTS.TABS.KELLY:
        return SEO_CONFIG.kelly;
      case CONSTANTS.TABS.ESTIMATOR:
        return SEO_CONFIG.estimator;
      case CONSTANTS.TABS.SPORTS_MATCHUP:
        return SEO_CONFIG.sports_matchup;
      case CONSTANTS.TABS.BET_HISTORY:
        return SEO_CONFIG.bet_history;
      case CONSTANTS.TABS.STATS:
        return SEO_CONFIG.stats;
      case CONSTANTS.TABS.ACCOUNT:
        return SEO_CONFIG.account;
      case CONSTANTS.TABS.PROMO:
        return SEO_CONFIG.promo;
      default:
        return SEO_CONFIG.kelly;
    }
  };

  const currentSEO = getSEOForTab();

  return (
    <>
      {/* Dynamic SEO meta tags based on active tab */}
      <SEO {...currentSEO} />

      <div className="site-bg">
        <div className="bg-overlay" />
        <div className="blob blob-a" />
        <div className="blob blob-b" />

        {/* Brand Logo */}
        <div className="brand-logo-container">
          <img
            src="/betgistics.png"
            alt="Betgistics Logo"
            className="brand-logo"
            title="Betgistics - Point Spread Betting Analytics"
            loading="eager"
            fetchpriority="high"
            width="64"
            height="64"
          />
        </div>

        {/* Authentication UI */}
        <div className="auth-container">
          {authLoading ? (
            <div style={{color: 'var(--text-muted)', fontSize: '.9rem'}}>Loading...</div>
          ) : authUser ? (
            <div className="user-info">
              {authUser.avatar && <img src={authUser.avatar} alt={authUser.name} className="user-avatar" />}
              <div className="user-details">
                <div className="user-name">{authUser.name}</div>
                <div className="user-email">{authUser.email}</div>
              </div>
              <a href={`${BACKEND_URL}/auth/logout`} className="logout-btn">Logout</a>
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <a href={`${BACKEND_URL}/auth/google`} className="auth-btn">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9.003 18c2.43 0 4.467-.806 5.956-2.18L12.05 13.56c-.806.54-1.836.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9.003 18z" fill="#34A853"/>
                  <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9.003 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.464.891 11.426 0 9.003 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29c.708-2.127 2.692-3.71 5.036-3.71z" fill="#EA4335"/>
                </svg>
                Sign in with Google
              </a>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem', maxWidth: '240px' }}>
                By signing in, you agree to our{' '}
                <a href="/privacy.html" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-cyan)', textDecoration: 'none' }}>
                  Privacy Policy
                </a>
                {' '}and{' '}
                <a href="/terms.html" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-cyan)', textDecoration: 'none' }}>
                  Terms of Service
                </a>
              </p>
            </div>
          )}
        </div>

        <div className="page-wrap">
          <header className="header">
            <h1 className="title">
              <span className="title-part-1">Bet Like A Pro</span>
              <span className="title-part-2">Betgistics</span>
            </h1>
            <SwipeableAudioOrbs
              orbs={[
                {
                  audioSrc: '/intro.mp3',
                  label: 'Introduction',
                  icon: '🎙️',
                },
                {
                  audioSrc: '/mission_statement.mp3',
                  label: 'Mission Statement',
                  icon: '🎯',
                },
                {
                  audioSrc: '/quick_guide.mp3',
                  label: 'Quick Start Guide',
                  icon: '🎧',
                },
                {
                  audioSrc: '/math_stats.mp3',
                  label: 'Magnify Stats',
                  icon: '🔍',
                },
              ]}
            />
          </header>

          <div className="panel" style={{maxWidth:900}}>
            <div className="tabs app-tabs" role="tablist">
              {[
                { key: CONSTANTS.TABS.KELLY, label: 'Kelly Criterion' },
                { key: CONSTANTS.TABS.ESTIMATOR, label: 'Probability Estimator' },
                { key: CONSTANTS.TABS.WALTERS, label: '⚡ Walters Protocol' },
                { key: CONSTANTS.TABS.SPORTS_MATCHUP, label: 'Sports Matchups' },
                { key: CONSTANTS.TABS.BET_HISTORY, label: '📊 Bet History' },
              ].map(tab => (
                <button
                  key={tab.key}
                  className={`tab ${activeTab === tab.key ? 'active' : ''}`}
                  onClick={() => handleTabChange(tab.key)}
                  aria-selected={activeTab === tab.key}
                  role="tab"
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {activeTab === CONSTANTS.TABS.KELLY && (
            <KellyCalculator
              probability={probability}
              setProbability={setProbability}
              isAuthenticated={!!authUser}
              matchupData={currentMatchup}
              estimationData={currentEstimation}
              onLoginRequired={handleLoginRequired}
              bankrollRefreshTrigger={bankrollRefreshTrigger}
            />
          )}
          {activeTab === CONSTANTS.TABS.ESTIMATOR && (
            <ProbabilityEstimator
              setProbability={setProbability}
              setActiveTab={setActiveTab}
              activeSport={activeSport}
              setActiveSport={setActiveSport}
              footballStats={footballStats}
              setFootballStats={setFootballStats}
              basketballStats={basketballStats}
              setBasketballStats={setBasketballStats}
              hockeyStats={hockeyStats}
              setHockeyStats={setHockeyStats}
              pointSpread={pointSpread}
              setPointSpread={setPointSpread}
              totalGoalsLine={totalGoalsLine}
              setTotalGoalsLine={setTotalGoalsLine}
              calculatedProb={calculatedProb}
              setCalculatedProb={setCalculatedProb}
              expectedDiff={expectedDiff}
              setExpectedDiff={setExpectedDiff}
              isTeamAHome={isTeamAHome}
              setIsTeamAHome={setIsTeamAHome}
              isAuthenticated={!!authUser}
              onLoginRequired={handleLoginRequired}
              // NEW: Pass setters for bet logging
              setCurrentMatchup={setCurrentMatchup}
              setCurrentEstimation={setCurrentEstimation}
            />
          )}
          {activeTab === CONSTANTS.TABS.WALTERS && (
            <div className="panel">
              <Suspense fallback={<div style={{padding:'2rem', textAlign:'center', color:'var(--text-muted)'}}>Loading Walters Protocol...</div>}>
                <WaltersEstimator onApplyToKelly={handleWaltersApplyToKelly} />
              </Suspense>
            </div>
          )}
          {activeTab === CONSTANTS.TABS.SPORTS_MATCHUP && (
            <div className="panel">
              <Suspense fallback={<div style={{padding:'2rem', textAlign:'center', color:'var(--text-muted)'}}>Loading matchup data...</div>}>
                <ConsolidatedSportsMatchup
                  onTransferToNBAEstimator={handleTransferToEstimator}
                  onTransferToNFLEstimator={handleNFLTransferToEstimator}
                  onTransferToNHLEstimator={handleNHLTransferToEstimator}
                />
              </Suspense>
            </div>
          )}
          {/* NEW: Bet History Tab */}
          {activeTab === CONSTANTS.TABS.BET_HISTORY && (
            <div className="panel">
              <BetHistory
                isAuthenticated={!!authUser}
                onBankrollUpdate={() => setBankrollRefreshTrigger(prev => prev + 1)}
              />
            </div>
          )}

          {/* Stats Page Tab */}
          {activeTab === CONSTANTS.TABS.STATS && (
            <StatsPage />
          )}

          {/* Account Settings Tab */}
          {activeTab === CONSTANTS.TABS.ACCOUNT && (
            <AccountSettings
              user={authUser}
              onLogout={handleLogout}
              onLogin={handleGoogleLogin}
              theme={theme}
              themeOptions={THEME_OPTIONS}
              onThemeChange={(value) => setTheme(value as ThemeKey)}
            />
          )}

          {/* Promo Page Tab */}
          {activeTab === CONSTANTS.TABS.PROMO && (
            <PromoPage user={authUser} />
          )}

          <div
            className={`doc-panel-wrapper ${isDocOpen ? 'open' : 'closed'}`}
            id="app-documentation"
            aria-hidden={!isDocOpen}
          >
            <div className="panel info-panel doc-panel">
              <button className="doc-close" type="button" onClick={() => setIsDocOpen(false)} aria-label="Close documentation">
                Close
              </button>
              <h2 style={{marginTop:0, marginBottom:'0.5rem'}}>How this app works</h2>
                <p style={{color:'var(--text-muted)', marginTop:0}}>
                  Follow these steps to move from matchup stats to a fully logged bet:
                </p>
                
                <ol style={{paddingLeft:'1.25rem', lineHeight:1.6, color:'var(--text-muted)'}}>
                  <li>
                    Start in the <strong>Sports Matchups</strong> tab to load team stats and compare both sides of the game. Toggle between NBA, NFL, and NHL.
                  </li>
                  <li>
                    Move to the <strong>Probability Estimator</strong>, enter your point spread, select whether your team is home or away, and hit <strong>Calculate Probability</strong> to generate your fair win probability.
                  </li>
                  <li>
                    Switch to the <strong>Kelly Criterion</strong>, enter your bankroll and odds, then paste in the win probability to calculate your optimal bet size.
                  </li>
                  <li>
                    Finally, use <strong>Log Bet</strong> to save the wager and track your results over time.
                  </li>
                </ol>
                
                <h3 style={{marginBottom:'0.35rem'}}>Feature guide</h3>
                <ul style={{paddingLeft:'1.25rem', lineHeight:1.6, color:'var(--text-muted)'}}>
                  <li><strong>Kelly Criterion</strong>: Calculates your optimal stake based on bankroll, odds, and your win probability.</li>
                  <li><strong>Probability Estimator</strong>: Converts matchup stats and point spreads into a projected win probability and expected margin.</li>
                  <li><strong>Sports Matchups</strong>: Pulls NBA, NFL, or NHL team performance data and pre-fills stats for the estimator.</li>
                  <li><strong>📊 Bet History</strong>: Stores your logged bets and tracks performance (sign-in required).</li>
                </ul>
            </div>
          </div>
        </div>

        <footer className="footer">
          <div className="footer-card">
            <button
              type="button"
              className="doc-toggle"
              onClick={() => setIsDocOpen((open) => !open)}
              aria-expanded={isDocOpen}
              aria-controls="app-documentation"
            >
              <span>{isDocOpen ? 'Hide documentation & workflow guide' : 'Show documentation & workflow guide'}</span>
              <span className={`doc-chevron ${isDocOpen ? 'open' : ''}`} aria-hidden>▾</span>
            </button>
            <p className="doc-hint">
              {isDocOpen
                ? 'Click to tuck the instructions away once you are comfortable with the flow.'
                : 'Open the drop-up to review the workflow and feature explanations.'}
            </p>

            {/* Watch Demo Button */}
            <div style={{ marginTop: '1rem', textAlign: 'center' }}>
              <button id="demoPopoverBtn" className="demo-btn" type="button">
                🎬 Watch Demo
              </button>
            </div>

            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.5rem 0' }}>
                <a href="/privacy.html" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-cyan)', textDecoration: 'none', marginRight: '1.5rem' }}>
                  Privacy Policy
                </a>
                <a href="/terms.html" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-cyan)', textDecoration: 'none' }}>
                  Terms of Service
                </a>
              </p>
            </div>
          </div>
        </footer>

        {/* Demo Popover (place right after footer) */}
        <div id="demoPopover" className="demo-popover" role="dialog" aria-hidden="true" aria-label="Demo video popover">
          <div className="demo-popover__header">
            <span className="demo-popover__title">Demo</span>
            <button id="demoPopoverClose" className="demo-popover__close" type="button" aria-label="Close">✕</button>
          </div>

          <div className="demo-popover__video">
            <iframe
              id="demoPopoverIframe"
              src=""
              title="Demo video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen>
            </iframe>
          </div>
        </div>

        {/* Bottom Navigation Bar */}
        <BottomNavigation
          activeTab={activeTab}
          onTabChange={handleTabChange}
          TABS={{
            BET_HISTORY: CONSTANTS.TABS.BET_HISTORY,
            STATS: CONSTANTS.TABS.STATS,
            ACCOUNT: CONSTANTS.TABS.ACCOUNT,
            PROMO: CONSTANTS.TABS.PROMO,
          }}
        />
      </div>
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <HelmetProvider>
    <GlobalStyle />
    <App />
  </HelmetProvider>
);
