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
  themeOptions: { key: string; label: string; description: string; accent: string; preview?: string }[];
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
          <div style={{ ...styles.preferenceItem, flexDirection: 'column', alignItems: 'flex-start', gap: '12px' }}>
            <div>
              <div style={styles.preferenceLabel}>Theme</div>
              <div style={styles.preferenceDescription}>
                Choose the glow you want across the app
              </div>
            </div>
            <div style={styles.themeGrid}>
              {themeOptions.map((option) => (
                <button
                  key={option.key}
                  onClick={() => onThemeChange(option.key)}
                  style={{
                    ...styles.themeButton,
                    ...(theme === option.key ? styles.themeButtonActive : {}),
                    background: option.preview || 'var(--surface-1)',
                  }}
                  aria-label={`Activate ${option.label} theme`}
                  aria-pressed={theme === option.key}
                >
                  <div style={styles.themeButtonText}>
                    <span style={styles.themeTitle}>{option.label}</span>
                    <span style={styles.themeSub}>{option.description}</span>
                  </div>
                  <div style={{
                    ...styles.themeSwatch,
                    boxShadow: theme === option.key
                      ? '0 0 0 2px var(--control-focus), 0 10px 20px rgba(0,0,0,0.35)'
                      : '0 6px 16px rgba(0,0,0,0.25)',
                    borderColor: theme === option.key ? 'var(--control-focus)' : 'var(--border-strong)',
                    background: option.preview || 'var(--accent-gradient)',
                  }} />
                </button>
              ))}
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
    background: 'var(--surface-2)',
    backdropFilter: 'blur(10px)',
    borderRadius: '20px',
    padding: '30px',
    border: '1px solid var(--border-strong)',
    boxShadow: 'var(--shadow-strong)',
  },
  title: {
    fontSize: '28px',
    fontWeight: 'bold',
    marginBottom: '30px',
    background: 'var(--accent-gradient)',
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
    color: 'var(--text-secondary)',
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
    background: 'var(--accent-gradient)',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: '0.2s ease',
    boxShadow: '0 6px 20px rgba(var(--accent-electric-rgb), 0.4), 0 0 0 1px rgba(255, 255, 255, 0.12) inset',
    backdropFilter: 'blur(5px)',
    textDecoration: 'none',
  },
  profileSection: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '30px',
    padding: '30px 20px',
    background: 'var(--surface-1)',
    borderRadius: '16px',
    border: '1px solid var(--border-subtle)',
  },
  avatar: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    border: '3px solid color-mix(in srgb, var(--accent-violet) 50%, transparent)',
    boxShadow: '0 4px 15px rgba(var(--accent-electric-rgb), 0.25)',
  },
  section: {
    marginBottom: '30px',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: 'var(--text-primary)',
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
    background: 'var(--surface-1)',
    borderRadius: '12px',
    border: '1px solid var(--border-subtle)',
  },
  infoLabel: {
    color: 'var(--text-muted)',
    fontSize: '14px',
  },
  infoValue: {
    color: 'var(--text-primary)',
    fontSize: '14px',
    fontWeight: '500',
  },
  preferenceItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '15px',
    background: 'var(--surface-1)',
    borderRadius: '12px',
    border: '1px solid var(--border-subtle)',
    marginBottom: '10px',
  },
  preferenceLabel: {
    color: 'var(--text-primary)',
    fontSize: '16px',
    fontWeight: '500',
    marginBottom: '5px',
  },
  preferenceDescription: {
    color: 'var(--text-secondary)',
    fontSize: '13px',
  },
  comingSoon: {
    padding: '6px 12px',
    background: 'color-mix(in srgb, var(--accent-violet) 25%, transparent)',
    color: 'var(--accent-violet)',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: '600',
  },
  themeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '10px',
    width: '100%',
  },
  themeButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '12px 14px',
    borderRadius: '14px',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-primary)',
    background: 'var(--surface-1)',
    cursor: 'pointer',
    transition: 'all 0.35s ease',
    boxShadow: '0 6px 18px rgba(0, 0, 0, 0.22)',
  },
  themeButtonActive: {
    border: '1px solid var(--control-focus)',
    boxShadow: '0 10px 30px rgba(var(--accent-electric-rgb), 0.35)',
    color: 'var(--text-primary)',
  },
  themeButtonText: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '4px',
    textAlign: 'left',
  },
  themeTitle: {
    fontWeight: 700,
    fontSize: '15px',
  },
  themeSub: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
  },
  themeSwatch: {
    width: '40px',
    height: '40px',
    borderRadius: '12px',
    border: '1px solid var(--border-strong)',
    flexShrink: 0,
    transition: 'all 0.35s ease',
  },
  dangerZone: {
    marginTop: '40px',
    paddingTop: '30px',
    borderTop: '1px solid var(--border-subtle)',
  },
  dangerTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: 'var(--text-primary)',
    marginBottom: '15px',
  },
  logoutButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: '600',
    color: 'var(--text-primary)',
    background: 'color-mix(in srgb, var(--danger-color) 40%, transparent)',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  logoutIcon: {
    fontSize: '18px',
  },
};
