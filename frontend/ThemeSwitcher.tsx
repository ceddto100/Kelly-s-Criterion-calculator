/**
 * Theme Switcher Component
 * Allows users to toggle between different color schemes
 */
import React, { useState, useEffect } from 'react';

type Theme = 'default' | 'bold' | 'original-accessible';

interface ThemeSwitcherProps {
  className?: string;
}

export default function ThemeSwitcher({ className = '' }: ThemeSwitcherProps) {
  const [currentTheme, setCurrentTheme] = useState<Theme>('default');

  useEffect(() => {
    // Load saved theme preference from localStorage
    const savedTheme = localStorage.getItem('color-theme') as Theme;
    if (savedTheme) {
      setCurrentTheme(savedTheme);
      applyTheme(savedTheme);
    }
  }, []);

  const applyTheme = (theme: Theme) => {
    // Remove all theme-related stylesheets only
    const existingLinks = document.querySelectorAll('[data-theme-stylesheet]');
    existingLinks.forEach(link => link.remove());

    // Apply theme-specific stylesheet
    if (theme === 'bold') {
      // Bold theme: Load bold theme CSS (will override CSS variables)
      const link = document.createElement('link');
      link.setAttribute('data-theme-stylesheet', 'bold');
      link.rel = 'stylesheet';
      link.href = '/index-bold-theme.css';
      document.head.appendChild(link);
    } else if (theme === 'original-accessible') {
      // Accessible theme: Add accessibility fixes on top of default
      const link = document.createElement('link');
      link.setAttribute('data-theme-stylesheet', 'accessible');
      link.rel = 'stylesheet';
      link.href = '/accessibility-fixes.css';
      document.head.appendChild(link);
    }
    // 'default' uses index.css (already loaded in HTML) + GlobalStyle inline
  };

  const handleThemeChange = (theme: Theme) => {
    setCurrentTheme(theme);
    applyTheme(theme);
    localStorage.setItem('color-theme', theme);
  };

  return (
    <div className={`theme-switcher ${className}`} style={styles.container}>
      <label style={styles.label}>Theme:</label>
      <div style={styles.buttonGroup}>
        <button
          onClick={() => handleThemeChange('default')}
          className={currentTheme === 'default' ? 'active' : ''}
          style={{
            ...styles.button,
            ...(currentTheme === 'default' ? styles.activeButton : {})
          }}
          aria-pressed={currentTheme === 'default'}
        >
          Enhanced
        </button>
        <button
          onClick={() => handleThemeChange('bold')}
          className={currentTheme === 'bold' ? 'active' : ''}
          style={{
            ...styles.button,
            ...(currentTheme === 'bold' ? styles.activeButtonBold : {})
          }}
          aria-pressed={currentTheme === 'bold'}
        >
          Bold
        </button>
        <button
          onClick={() => handleThemeChange('original-accessible')}
          className={currentTheme === 'original-accessible' ? 'active' : ''}
          style={{
            ...styles.button,
            ...(currentTheme === 'original-accessible' ? styles.activeButton : {})
          }}
          aria-pressed={currentTheme === 'original-accessible'}
        >
          Accessible
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem',
    background: 'rgba(15, 23, 42, 0.6)',
    borderRadius: '8px',
    border: '1px solid rgba(71, 85, 105, 0.4)',
    marginBottom: '1rem',
  } as React.CSSProperties,
  label: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
  } as React.CSSProperties,
  buttonGroup: {
    display: 'flex',
    gap: '0.5rem',
  } as React.CSSProperties,
  button: {
    padding: '0.5rem 0.875rem',
    fontSize: '0.8rem',
    fontWeight: 600,
    border: '1px solid var(--border-color)',
    borderRadius: '6px',
    background: 'rgba(51, 65, 85, 0.5)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  } as React.CSSProperties,
  activeButton: {
    background: 'linear-gradient(90deg, #6366f1, #a78bfa)',
    color: 'white',
    borderColor: 'transparent',
    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
  } as React.CSSProperties,
  activeButtonBold: {
    background: 'linear-gradient(90deg, #8b5cf6, #06b6d4)',
    color: 'white',
    borderColor: 'transparent',
    boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)',
  } as React.CSSProperties,
};
