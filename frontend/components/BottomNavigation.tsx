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
      icon: '📊',
      label: 'Bets',
    },
    {
      id: TABS.STATS,
      icon: '📈',
      label: 'Stats',
    },
    {
      id: TABS.PROMO,
      icon: '🎁',
      label: 'Promos',
    },
    {
      id: TABS.ACCOUNT,
      icon: '⚙️',
      label: 'Account',
    },
  ];

  return (
    <nav style={styles.bottomNav}>
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
    zIndex: 1000,
    paddingBottom: 'env(safe-area-inset-bottom, 0)',
  },
  navContainer: {
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(10px)',
    borderTop: '1px solid rgba(255, 255, 255, 0.2)',
    boxShadow: '0 -4px 30px rgba(0, 0, 0, 0.1)',
    padding: '8px max(8px, env(safe-area-inset-right, 8px)) 8px max(8px, env(safe-area-inset-left, 8px))',
  },
  navItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    padding: '8px 16px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: 'rgba(255, 255, 255, 0.7)',
    transition: 'all 0.3s ease',
    borderRadius: '12px',
    minWidth: '70px',
  },
  navItemActive: {
    background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.4), rgba(59, 130, 246, 0.4))',
    color: 'white',
    boxShadow: '0 4px 15px rgba(168, 85, 247, 0.3)',
  },
  navIcon: {
    fontSize: '24px',
  },
  navLabel: {
    fontSize: '12px',
    fontWeight: '500',
  },
};
