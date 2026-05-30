import React from 'react';

interface BottomNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  TABS: {
    HOME: string;
    GAMES: string;
    ANALYSIS: string;
    TRACKER: string;
    ACCOUNT: string;
  };
}

const HomeIcon = () => (
  <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="m3 11 9-8 9 8" />
    <path d="M5 10v10h14V10" />
    <path d="M9 20v-6h6v6" />
  </svg>
);

const BallIcon = () => (
  <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M4.5 9.5c4.5 1 6 5.5 4.8 10" />
    <path d="M19.5 14.5c-4.5-1-6-5.5-4.8-10" />
    <path d="M7 5.8c3.2 2.5 6.6 2.6 10.1 0" />
    <path d="M6.9 18.2c3.3-2.5 6.7-2.5 10.2 0" />
  </svg>
);

const BarsIcon = () => (
  <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 20V10" />
    <path d="M9.3 20V4" />
    <path d="M14.7 20v-8" />
    <path d="M20 20V7" />
    <path d="M2.5 20h19" />
  </svg>
);

const TrackerIcon = () => (
  <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="5" width="16" height="16" rx="3" />
    <path d="M8 3v4" />
    <path d="M16 3v4" />
    <path d="M8 12h8" />
    <path d="m9 16 2 2 4-5" />
  </svg>
);

const ProfileIcon = () => (
  <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
);

export const BottomNavigation: React.FC<BottomNavigationProps> = ({ activeTab, onTabChange, TABS }) => {
  const navItems = [
    { id: TABS.HOME, icon: <HomeIcon />, label: 'Home' },
    { id: TABS.GAMES, icon: <BallIcon />, label: 'Games' },
    { id: TABS.ANALYSIS, icon: <BarsIcon />, label: 'Analysis' },
    { id: TABS.TRACKER, icon: <TrackerIcon />, label: 'Tracker' },
    { id: TABS.ACCOUNT, icon: <ProfileIcon />, label: 'Profile' },
  ];

  return (
    <nav className="bottom-nav" id="bottom-navigation-bar" aria-label="Primary navigation">
      <div className="bottom-nav__container">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onTabChange(item.id)}
            className={`bottom-nav__item ${activeTab === item.id ? 'bottom-nav__item--active' : ''}`}
            aria-current={activeTab === item.id ? 'page' : undefined}
          >
            <span className="bottom-nav__icon">{item.icon}</span>
            <span className="bottom-nav__label">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};
