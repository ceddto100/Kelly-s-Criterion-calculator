/**
 * AppNavigation
 * =============
 * The app's navigation, purpose-built per device class:
 *
 *  - Desktop (>=1024px): a fixed left sidebar with grouped destinations
 *    (rendered by <SidebarNav/>). Styled by `.sidebar*` / `.nav-*` rules
 *    in index.css; hidden on mobile.
 *  - Mobile (<1024px): a fixed 5-slot bottom bar (rendered by
 *    <MobileNav/>) with the four everyday destinations plus a "More"
 *    sheet holding the rest. Styled by `.mobile-nav` / `.more-*` rules;
 *    hidden on desktop.
 *
 * Both consume the same NAV_SECTIONS definition so destinations stay in
 * sync. Tab keys must match CONSTANTS.TABS in index.tsx.
 */
import React, { useEffect, useState } from 'react';

export interface NavDestination {
  key: string;
  label: string;
  shortLabel?: string;
  description: string;
  icon: React.ReactNode;
}

export interface NavSection {
  label: string;
  items: NavDestination[];
}

const icon = (paths: React.ReactNode) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {paths}
  </svg>
);

const ICONS = {
  kelly: icon(<><path d="M12 1v22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>),
  estimator: icon(<><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></>),
  walters: icon(<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />),
  games: icon(<><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>),
  matchups: icon(<><path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M16 3h3a2 2 0 0 1 2 2v3" /><path d="M8 21H5a2 2 0 0 1-2-2v-3" /><path d="M16 21h3a2 2 0 0 0 2-2v-3" /><line x1="7" y1="12" x2="17" y2="12" /></>),
  bets: icon(<><line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" /></>),
  stats: icon(<polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />),
  promos: icon(<><circle cx="12" cy="8" r="7" /><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" /></>),
  account: icon(<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>),
};

export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Betting tools',
    items: [
      { key: 'kelly', label: 'Kelly Calculator', shortLabel: 'Kelly', description: 'Size your stake with bankroll discipline', icon: ICONS.kelly },
      { key: 'estimator', label: 'Probability Estimator', shortLabel: 'Estimate', description: 'Turn team stats into win probability', icon: ICONS.estimator },
      { key: 'walters', label: 'Walters Protocol', shortLabel: 'Walters', description: 'Power-rating edge and line value checks', icon: ICONS.walters },
    ],
  },
  {
    label: 'Games & data',
    items: [
      { key: 'daily_games', label: "Today's Games", shortLabel: 'Games', description: 'Live slate with model projections', icon: ICONS.games },
      { key: 'sports_matchup', label: 'Sports Matchups', shortLabel: 'Matchups', description: 'Load and compare team data', icon: ICONS.matchups },
      { key: 'stats', label: 'Team Stats', shortLabel: 'Stats', description: 'NBA / NFL / NHL statistics', icon: ICONS.stats },
    ],
  },
  {
    label: 'My account',
    items: [
      { key: 'bet_history', label: 'Bet History', shortLabel: 'Bets', description: 'Logged bets and bankroll trend', icon: ICONS.bets },
      { key: 'promo', label: 'Promos', shortLabel: 'Promos', description: 'Promotions and partner offers', icon: ICONS.promos },
      { key: 'account', label: 'Settings', shortLabel: 'Account', description: 'Profile, themes, and preferences', icon: ICONS.account },
    ],
  },
];

const ALL_DESTINATIONS = NAV_SECTIONS.flatMap((s) => s.items);

export function findDestination(key: string): NavDestination | undefined {
  return ALL_DESTINATIONS.find((d) => d.key === key);
}

/* Mobile bottom bar: the four everyday destinations + "More". */
const MOBILE_PRIMARY_KEYS = ['kelly', 'estimator', 'daily_games', 'bet_history'];
const MOBILE_MORE_KEYS = ['walters', 'sports_matchup', 'stats', 'promo', 'account'];

interface NavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

/* ============================ Desktop sidebar ============================ */
export function SidebarNav({
  activeTab,
  onTabChange,
  footer,
}: NavProps & { footer?: React.ReactNode }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <img src="/betgistics.png" alt="Betgistics logo" width="40" height="40" />
        <div>
          <div className="sidebar-brand-name">Betgistics</div>
          <span className="sidebar-brand-tag">Betting analytics workspace</span>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Main navigation">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <div className="nav-group-label">{section.label}</div>
            {section.items.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`nav-item ${activeTab === item.key ? 'active' : ''}`}
                aria-current={activeTab === item.key ? 'page' : undefined}
                onClick={() => onTabChange(item.key)}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>

      {footer && <div className="sidebar-footer">{footer}</div>}
    </aside>
  );
}

/* ========================= Mobile bottom navigation ========================= */
export function MobileNav({ activeTab, onTabChange }: NavProps) {
  const [moreOpen, setMoreOpen] = useState(false);

  // Close the sheet whenever navigation happens elsewhere.
  useEffect(() => {
    setMoreOpen(false);
  }, [activeTab]);

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moreOpen]);

  const primary = MOBILE_PRIMARY_KEYS
    .map(findDestination)
    .filter((d): d is NavDestination => Boolean(d));
  const more = MOBILE_MORE_KEYS
    .map(findDestination)
    .filter((d): d is NavDestination => Boolean(d));
  const moreIsActive = MOBILE_MORE_KEYS.includes(activeTab);

  const select = (key: string) => {
    setMoreOpen(false);
    onTabChange(key);
  };

  return (
    <>
      {/* id kept for BetLogger, which hides the bar while its modal is open */}
      <nav className="mobile-nav" id="bottom-navigation-bar" aria-label="Main navigation">
        {primary.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`mnav-item ${activeTab === item.key && !moreOpen ? 'active' : ''}`}
            aria-current={activeTab === item.key ? 'page' : undefined}
            onClick={() => select(item.key)}
          >
            {item.icon}
            <span>{item.shortLabel ?? item.label}</span>
          </button>
        ))}
        <button
          type="button"
          className={`mnav-item ${moreOpen || moreIsActive ? 'active' : ''}`}
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((open) => !open)}
        >
          {icon(<><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></>)}
          <span>More</span>
        </button>
      </nav>

      {moreOpen && (
        <>
          <button
            type="button"
            className="more-backdrop"
            aria-label="Close menu"
            onClick={() => setMoreOpen(false)}
          />
          <div className="more-sheet" role="dialog" aria-label="More destinations">
            <div className="more-sheet-handle" />
            <div className="more-sheet-title">More tools</div>
            <div className="more-grid">
              {more.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`more-item ${activeTab === item.key ? 'active' : ''}`}
                  onClick={() => select(item.key)}
                >
                  {item.icon}
                  <span>{item.shortLabel ?? item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
