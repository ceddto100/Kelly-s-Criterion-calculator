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
}

export const AccountSettings: React.FC<AccountSettingsProps> = ({
  user,
  onLogout,
  onLogin,
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
              <span style={styles.googleIcon}>G</span>
              Sign in with Google
            </button>
          </div>
        </div>
      </div>
    );
  }

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
          <div style={styles.userInfo}>
            <h3 style={styles.userName}>{user.name || 'User'}</h3>
            <p style={styles.userEmail}>{user.email || 'No email'}</p>
          </div>
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
            <div style={styles.infoItem}>
              <span style={styles.infoLabel}>Provider</span>
              <span style={styles.infoValue}>Google OAuth</span>
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
              <div style={styles.preferenceLabel}>Dark Mode</div>
              <div style={styles.preferenceDescription}>
                Switch between light and dark themes
              </div>
            </div>
            <div style={styles.comingSoon}>Coming Soon</div>
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
    gap: '12px',
    padding: '14px 28px',
    fontSize: '16px',
    fontWeight: '600',
    color: 'white',
    background: 'linear-gradient(135deg, #a855f7, #3b82f6)',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 15px rgba(168, 85, 247, 0.3)',
  },
  googleIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    height: '24px',
    background: 'white',
    color: '#4285f4',
    borderRadius: '50%',
    fontWeight: 'bold',
    fontSize: '14px',
  },
  profileSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    marginBottom: '30px',
    padding: '20px',
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
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: 'white',
    marginBottom: '5px',
  },
  userEmail: {
    fontSize: '14px',
    color: 'rgba(255, 255, 255, 0.6)',
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
