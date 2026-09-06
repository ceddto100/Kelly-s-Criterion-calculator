import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.betgistics.app',
  appName: 'Betgistics',
  webDir: 'dist',
  server: {
    // In production, the app loads from the bundled web assets.
    // For development, uncomment the url below to use live reload:
    // url: 'http://10.0.2.2:5173',
    androidScheme: 'https',
    allowNavigation: [
      'betgistics.com',
      '*.betgistics.com',
      'accounts.google.com',
      '*.google.com',
      '*.stripe.com',
    ],
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      launchFadeOutDuration: 500,
      backgroundColor: '#050510',
      androidScaleType: 'CENTER_CROP',
      showSpinner: true,
      spinnerColor: '#8b5cf6',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#050510',
    },
    Keyboard: {
      resize: 'body',
      style: 'DARK',
      resizeOnFullScreen: true,
    },
    Haptics: {
      enabled: true,
    },
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#050510',
    buildOptions: {
      keystorePath: 'release-key.jks',
      keystoreAlias: 'betgistics',
    },
  },
};

export default config;
