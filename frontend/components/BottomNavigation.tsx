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
    <nav style={styles.bottomNav} id="bottom-navigation-bar">
      <div style={styles.navContainer}>
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            style={{
              ...styles.navItem,
              ...(activeTab === item.id ? styles.navItemActive : {}),
            }}
          >
            <span style={styles.navIcon}>{item.icon}</span>
            <span style={styles.navLabel}>{item.label}</span>
          </button>
        ))}

        {/* Logo in the center */}
        <div style={styles.logoContainer}>
          <div style={styles.logo}>
            <img
              src="/betgistics.png"
              alt="Betgistics Logo"
              style={styles.logoImage}
            />
          </div>
        </div>

        {navItemsRight.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            style={{
              ...styles.navItem,
              ...(activeTab === item.id ? styles.navItemActive : {}),
            }}
          >
            <span style={styles.navIcon}>{item.icon}</span>
            <span style={styles.navLabel}>{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  bottomNav: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingBottom: 'env(safe-area-inset-bottom, 0)',
    visibility: 'visible',
    opacity: 1,
    pointerEvents: 'auto',
  },
  navContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'var(--surface-2)',
    backdropFilter: 'blur(10px)',
    borderTop: '1px solid var(--border-strong)',
    boxShadow: '0 -8px 28px rgba(0, 0, 0, 0.3)',
    padding: '6px max(6px, env(safe-area-inset-right, 6px)) 6px max(6px, env(safe-area-inset-left, 6px))',
    columnGap: '2px',
  },
  navItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2px',
    padding: '6px 6px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    transition: 'all 0.35s ease',
    borderRadius: '10px',
    minWidth: 0,
    flex: 1,
  },
  navItemActive: {
    background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent-violet) 38%, transparent), color-mix(in srgb, var(--accent-electric) 40%, transparent))',
    color: 'var(--text-primary)',
    boxShadow: '0 4px 15px rgba(var(--accent-electric-rgb), 0.3)',
  },
  navIcon: {
    fontSize: '20px',
  },
  navLabel: {
    fontSize: '10px',
    fontWeight: '500',
  },
  logoContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 4px',
  },
  logo: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 20px rgba(var(--accent-electric-rgb), 0.35)',
    transition: 'all 0.3s ease',
    overflow: 'hidden',
    background: 'var(--surface-2)',
  },
  logoImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
};
