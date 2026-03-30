import React from 'react';

interface BottomNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  TABS: {
    BET_HISTORY: string;
    STATS: string;
    ACCOUNT: string;
    PROMO: string;
  };
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeTab,
  onTabChange,
  TABS,
}) => {
  const navItems = [
    {
      id: TABS.BET_HISTORY,
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="20" x2="12" y2="10"></line>
          <line x1="18" y1="20" x2="18" y2="4"></line>
          <line x1="6" y1="20" x2="6" y2="16"></line>
        </svg>
      ),
      label: 'Bets',
    },
    {
      id: TABS.STATS,
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
        </svg>
      ),
      label: 'Stats',
    },
  ];

  const navItemsRight = [
    {
      id: TABS.PROMO,
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="7"></circle>
          <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>
        </svg>
      ),
      label: 'Promos',
    },
    {
      id: TABS.ACCOUNT,
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      ),
      label: 'Account',
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[99999] pb-[env(safe-area-inset-bottom,0)] visible opacity-100 pointer-events-auto w-full max-w-[100vw] overflow-visible" id="bottom-navigation-bar">
      <div className="flex justify-evenly items-center bg-[var(--bg-surface)] backdrop-blur-lg border-t border-[var(--border-default)] shadow-[0_-8px_28px_rgba(0,0,0,0.3)] p-1 gap-0.5 flex-nowrap w-full overflow-x-visible">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 bg-transparent border-none cursor-pointer text-[var(--text-secondary)] transition-all duration-300 rounded-lg min-w-[50px] max-w-[70px] shrink-0 ${
              activeTab === item.id ? 'bg-[var(--accent-muted)] text-[var(--text-primary)]' : ''
            }`}
          >
            <span className="text-xl">{item.icon}</span>
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}

        {/* Logo in the center */}
        <div className="flex items-center justify-center px-1 shrink-0">
          <div className="w-9 h-9 rounded-full flex items-center justify-center shadow-[var(--accent-glow)] transition-all duration-300 overflow-hidden bg-[var(--bg-surface)]">
            <img
              src="/betgistics.png"
              alt="Betgistics Logo"
              title="Betgistics - Sports Betting Calculator"
              className="w-full h-full object-cover"
              width="40"
              height="40"
              loading="lazy"
            />
          </div>
        </div>

        {navItemsRight.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 bg-transparent border-none cursor-pointer text-[var(--text-secondary)] transition-all duration-300 rounded-lg min-w-[50px] max-w-[70px] shrink-0 ${
              activeTab === item.id ? 'bg-[var(--accent-muted)] text-[var(--text-primary)]' : ''
            }`}
          >
            <span className="text-xl">{item.icon}</span>
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};
