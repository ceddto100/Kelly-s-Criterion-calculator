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
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="20" x2="12" y2="10" />
          <line x1="18" y1="20" x2="18" y2="4" />
          <line x1="6" y1="20" x2="6" y2="16" />
        </svg>
      ),
      label: 'Bets',
    },
    {
      id: TABS.STATS,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      ),
      label: 'Stats',
    },
  ];

  const navItemsRight = [
    {
      id: TABS.PROMO,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="7" />
          <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
        </svg>
      ),
      label: 'Promos',
    },
    {
      id: TABS.ACCOUNT,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
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
            <span style={{
              ...styles.navLabel,
              ...(activeTab === item.id ? styles.navLabelActive : {}),
            }}>{item.label}</span>
          </button>
        ))}

        {/* Center Logo */}
        <div style={styles.logoContainer}>
          <div style={styles.logoWrapper}>
            <img
              src="/betgistics.png"
              alt="Betgistics"
              title="Betgistics - Sports Betting Calculator"
              style={styles.logoImage}
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
            style={{
              ...styles.navItem,
              ...(activeTab === item.id ? styles.navItemActive : {}),
            }}
          >
            <span style={styles.navIcon}>{item.icon}</span>
            <span style={{
              ...styles.navLabel,
              ...(activeTab === item.id ? styles.navLabelActive : {}),
            }}>{item.label}</span>
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
    zIndex: 99999,
    background: 'var(--bg-secondary)',
    borderTop: '1px solid var(--glass-border)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    paddingBottom: 'env(safe-area-inset-bottom, 0)',
  },
  navContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '8px 16px',
    gap: '4px',
    maxWidth: '500px',
    margin: '0 auto',
  },
  navItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    padding: '8px 12px',
    background: 'transparent',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    color: 'var(--text-muted)',
    transition: 'all 0.2s ease',
    minWidth: '64px',
    flex: '1',
  },
  navItemActive: {
    background: 'var(--accent-gradient)',
    color: 'var(--text-primary)',
    boxShadow: '0 4px 16px rgba(var(--accent-primary-rgb), 0.3)',
  },
  navIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLabel: {
    fontSize: '11px',
    fontWeight: '600',
    letterSpacing: '0.02em',
  },
  navLabelActive: {
    color: 'white',
  },
  logoContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 8px',
    flexShrink: 0,
  },
  logoWrapper: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--glass-bg)',
    border: '2px solid rgba(var(--accent-primary-rgb), 0.3)',
    boxShadow: '0 4px 16px rgba(var(--accent-primary-rgb), 0.2)',
    overflow: 'hidden',
    transition: 'all 0.2s ease',
  },
  logoImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
};
