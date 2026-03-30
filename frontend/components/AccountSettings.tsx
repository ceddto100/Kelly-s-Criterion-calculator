import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';
const STRIPE_PUBLISHABLE_KEY = import.meta.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  || import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  || '';
const stripePromise = STRIPE_PUBLISHABLE_KEY ? loadStripe(STRIPE_PUBLISHABLE_KEY) : null;

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
  const [upgradeStatus, setUpgradeStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [upgradeError, setUpgradeError] = useState<string | null>(null);

  const handleUpgrade = async () => {
    setUpgradeStatus('loading');
    setUpgradeError(null);

    try {
      const response = await fetch(`${BACKEND_URL}/api/stripe/create-checkout-session`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload.error || 'Unable to start checkout');
      }

      const data = await response.json();

      if (stripePromise && data.sessionId) {
        const stripe = await stripePromise;

        if (!stripe) {
          throw new Error('Stripe failed to initialize');
        }

        const { error } = await stripe.redirectToCheckout({ sessionId: data.sessionId });

        if (error) {
          throw new Error(error.message || 'Stripe checkout redirect failed');
        }
        return;
      }

      if (!data.url) {
        throw new Error('Stripe checkout URL was not returned');
      }

      window.location.assign(data.url);
    } catch (error) {
      setUpgradeStatus('error');
      setUpgradeError(error instanceof Error ? error.message : 'Checkout failed');
      return;
    }

    setUpgradeStatus('idle');
  };

  if (!user) {
    return (
      <div className="p-5 max-w-3xl mx-auto pb-24">
        <div className="glass-card p-8">
          <h2 className="text-3xl font-bold mb-8 accent-gradient-text">Account Settings</h2>
          <div className="text-center py-10 px-5">
            <div className="text-6xl mb-5">🔒</div>
            <p className="text-[var(--text-secondary)] text-base mb-8">Please sign in to access your account settings</p>
            <button onClick={onLogin} className="btn-accent inline-flex items-center gap-2">
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
    <div className="p-5 max-w-3xl mx-auto pb-24">
      <div className="glass-card p-8">
        <h2 className="text-3xl font-bold mb-8 accent-gradient-text">Account Settings</h2>

        <div className="flex items-center justify-center mb-8 p-8 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-default)]">
          {user.avatar && (
            <img
              src={user.avatar}
              alt={user.name || 'User'}
              title={`${user.name || 'User'} Profile Picture`}
              className="w-20 h-20 rounded-full border-2 border-[var(--accent)]"
              width="80"
              height="80"
              loading="lazy"
            />
          )}
        </div>

        <div className="mb-8">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Account Information</h3>
          <div className="grid gap-4">
            <div className="flex justify-between p-4 bg-[var(--bg-surface)] rounded-xl border border-[var(--border-default)]">
              <span className="text-[var(--text-muted)] text-sm">Name</span>
              <span className="text-[var(--text-primary)] text-sm font-medium">{user.name || 'Not set'}</span>
            </div>
            <div className="flex justify-between p-4 bg-[var(--bg-surface)] rounded-xl border border-[var(--border-default)]">
              <span className="text-[var(--text-muted)] text-sm">Email</span>
              <span className="text-[var(--text-primary)] text-sm font-medium">{user.email || 'Not set'}</span>
            </div>
          </div>
        </div>

        <div className="mb-8">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Subscription</h3>
          <div className="flex flex-col gap-3 p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-default)]">
            <div>
              <div className="text-base font-bold text-[var(--text-primary)]">Betgistics – Core Access</div>
              <div className="text-sm text-[var(--text-secondary)]">$60/month · Unlimited calculations</div>
            </div>
            <button
              onClick={handleUpgrade}
              className="btn-accent self-start"
              disabled={upgradeStatus === 'loading'}
            >
              {upgradeStatus === 'loading' ? 'Redirecting...' : 'Upgrade to Core Access'}
            </button>
            {upgradeStatus === 'error' && upgradeError && (
              <div className="text-red-400 text-sm">{upgradeError}</div>
            )}
          </div>
        </div>

        <div className="mb-8">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Preferences</h3>
          <div className="flex justify-between items-center p-4 bg-[var(--bg-surface)] rounded-xl border border-[var(--border-default)] mb-2.5">
            <div>
              <div className="text-[var(--text-primary)] text-base font-medium mb-1">Notifications</div>
              <div className="text-[var(--text-secondary)] text-[13px]">
                Receive updates about your bets
              </div>
            </div>
            <div className="px-3 py-1.5 bg-[var(--accent-muted)] text-[var(--accent)] rounded-lg text-xs font-semibold">Coming Soon</div>
          </div>
          <div className="flex flex-col items-start gap-3 p-4 bg-[var(--bg-surface)] rounded-xl border border-[var(--border-default)] mb-2.5">
            <div>
              <div className="text-[var(--text-primary)] text-base font-medium mb-1">Theme</div>
              <div className="text-[var(--text-secondary)] text-[13px]">
                Choose the glow you want across the app
              </div>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2.5 w-full">
              {themeOptions.map((option) => (
                <button
                  key={option.key}
                  onClick={() => onThemeChange(option.key)}
                  className={`flex items-center justify-between gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-300 ${
                    theme === option.key
                      ? 'border-[var(--accent)] shadow-[var(--accent-glow)] text-[var(--text-primary)]'
                      : 'border-[var(--border-default)] text-[var(--text-primary)]'
                  }`}
                  style={{ background: option.preview || 'var(--bg-surface)' }}
                  aria-label={`Activate ${option.label} theme`}
                  aria-pressed={theme === option.key}
                >
                  <div className="flex flex-col items-start gap-1 text-left">
                    <span className="font-bold text-[15px]">{option.label}</span>
                    <span className="text-xs text-[var(--text-secondary)]">{option.description}</span>
                  </div>
                  <div
                    className="w-10 h-10 rounded-xl border shrink-0 transition-all duration-300"
                    style={{
                      boxShadow: theme === option.key
                        ? '0 0 0 2px var(--accent), 0 10px 20px rgba(0,0,0,0.35)'
                        : '0 6px 16px rgba(0,0,0,0.25)',
                      borderColor: theme === option.key ? 'var(--accent)' : 'var(--border-default)',
                      background: option.preview || 'var(--accent-gradient)',
                    }}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 pt-8 border-t border-[var(--border-default)]">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Account Actions</h3>
          <button onClick={onLogout} className="btn-danger inline-flex items-center gap-2.5">
            <span className="text-lg">🚪</span>
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};
