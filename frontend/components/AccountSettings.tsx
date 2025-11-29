import React from 'react';

interface User {
  name?: string;
  email?: string;
  avatar?: string;
}

interface AccountSettingsProps {
  user: User | null;
  onLogout: () => void;
  onLogin: () => void;
  theme: string;
  themeOptions: { key: string; label: string; description: string; accent: string }[];
  onThemeChange: (theme: string) => void;
}

export const AccountSettings: React.FC<AccountSettingsProps> = ({
  user,
  onLogout,
  onLogin,
  theme,
  themeOptions,
  onThemeChange,
}) => {
  if (!user) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h2 style={styles.title}>Account Settings</h2>
          <div style={styles.notLoggedIn}>
            <div style={styles.iconLarge}>🔒</div>
            <p style={styles.message}>Please sign in to access your account settings</p>
            <button onClick={onLogin} style={styles.loginButton}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                <path d="M9.003 18c2.43 0 4.467-.806 5.956-2.18L12.05 13.56c-.806.54-1.836.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9.003 18z" fill="#34A853"/>
                <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9.003 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.464.891 11.426 0 9.003 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29c.708-2.127 2.692-3.71 5.036-3.71z" fill="#EA4335"/>
              </svg>
              Sign in with Google
            </button>
          </div>
        </div>
      </div>
    );
  }

  const activeTheme = themeOptions.find((option) => option.key === theme);

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>Account Settings</h2>

        <div style={styles.profileSection}>
          {user.avatar && (
            <img
              src={user.avatar}
              alt={user.name || 'User'}
              style={styles.avatar}
            />
          )}
        </div>

        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Account Information</h3>
          <div style={styles.infoGrid}>
            <div style={styles.infoItem}>
              <span style={styles.infoLabel}>Name</span>
              <span style={styles.infoValue}>{user.name || 'Not set'}</span>
            </div>
            <div style={styles.infoItem}>
              <span style={styles.infoLabel}>Email</span>
              <span style={styles.infoValue}>{user.email || 'Not set'}</span>
            </div>
          </div>
        </div>

        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Preferences</h3>
          <div style={styles.preferenceItem}>
            <div>
              <div style={styles.preferenceLabel}>Notifications</div>
              <div style={styles.preferenceDescription}>
                Receive updates about your bets
              </div>
            </div>
            <div style={styles.comingSoon}>Coming Soon</div>
          </div>
          <div style={styles.preferenceItem}>
            <div>
              <div style={styles.preferenceLabel}>Theme</div>
              <div style={styles.preferenceDescription}>
                Swap the UI glow and orb accents
              </div>
            </div>
            <div style={styles.themeControl}>
              <select
                value={theme}
                onChange={(e) => onThemeChange(e.target.value)}
                style={styles.themeSelect}
                aria-label="Select theme"
              >
                {themeOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
              <div style={{
                ...styles.themeBadge,
                borderColor: activeTheme?.accent || '#06b6d4',
                color: activeTheme?.accent || '#06b6d4',
              }}>
                {activeTheme?.description}
              </div>
            </div>
          </div>
        </div>

        <div style={styles.dangerZone}>
          <h3 style={styles.dangerTitle}>Account Actions</h3>
          <button onClick={onLogout} style={styles.logoutButton}>
            <span style={styles.logoutIcon}>🚪</span>
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    padding: '20px',
    maxWidth: '800px',
    margin: '0 auto',
    paddingBottom: '100px',
  },
  card: {
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(10px)',
    borderRadius: '20px',
    padding: '30px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
  },
  title: {
    fontSize: '28px',
    fontWeight: 'bold',
    marginBottom: '30px',
    background: 'linear-gradient(135deg, #a855f7, #3b82f6)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  notLoggedIn: {
    textAlign: 'center',
    padding: '40px 20px',
  },
  iconLarge: {
    fontSize: '64px',
    marginBottom: '20px',
  },
  message: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: '16px',
    marginBottom: '30px',
  },
  loginButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1.25rem',
    fontSize: '0.95rem',
    fontWeight: '600',
    color: '#fff',
    background: 'linear-gradient(135deg, #06b6d4, #3b82f6, #8b5cf6)',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: '0.2s ease',
    boxShadow: '0 6px 20px rgba(59, 130, 246, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.2) inset',
    backdropFilter: 'blur(5px)',
    textDecoration: 'none',
  },
  profileSection: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '30px',
    padding: '30px 20px',
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  avatar: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    border: '3px solid rgba(168, 85, 247, 0.5)',
    boxShadow: '0 4px 15px rgba(168, 85, 247, 0.3)',
  },
  section: {
    marginBottom: '30px',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: 'white',
    marginBottom: '15px',
  },
  infoGrid: {
    display: 'grid',
    gap: '15px',
  },
  infoItem: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '15px',
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  infoLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: '14px',
  },
  infoValue: {
    color: 'white',
    fontSize: '14px',
    fontWeight: '500',
  },
  preferenceItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '15px',
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    marginBottom: '10px',
  },
  preferenceLabel: {
    color: 'white',
    fontSize: '16px',
    fontWeight: '500',
    marginBottom: '5px',
  },
  preferenceDescription: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: '13px',
  },
  comingSoon: {
    padding: '6px 12px',
    background: 'rgba(168, 85, 247, 0.2)',
    color: '#a855f7',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: '600',
  },
  themeControl: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    minWidth: '180px',
    alignItems: 'flex-end',
  },
  themeSelect: {
    background: 'rgba(255, 255, 255, 0.08)',
    color: 'white',
    borderRadius: '10px',
    padding: '10px 12px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    fontWeight: 600,
    cursor: 'pointer',
  },
  themeBadge: {
    padding: '6px 10px',
    borderRadius: '10px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    background: 'rgba(255, 255, 255, 0.04)',
    fontSize: '12px',
    fontWeight: 600,
    textAlign: 'right',
    minWidth: '180px',
  },
  dangerZone: {
    marginTop: '40px',
    paddingTop: '30px',
    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
  },
  dangerTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: 'white',
    marginBottom: '15px',
  },
  logoutButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: '600',
    color: 'white',
    background: 'rgba(239, 68, 68, 0.8)',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  logoutIcon: {
    fontSize: '18px',
  },
};
