/**
 * Native Bridge - Capacitor plugin integration for Betgistics Android app.
 *
 * This module provides a unified API for native device capabilities.
 * On web, calls gracefully degrade to no-ops or web equivalents.
 */

import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Keyboard } from '@capacitor/keyboard';
import { Network } from '@capacitor/network';
import { Preferences } from '@capacitor/preferences';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Toast } from '@capacitor/toast';

// ── Platform detection ──────────────────────────────────────────

export const isNative = Capacitor.isNativePlatform();
export const isAndroid = Capacitor.getPlatform() === 'android';
export const isWeb = Capacitor.getPlatform() === 'web';

// ── Status Bar ──────────────────────────────────────────────────

export async function configureStatusBar(): Promise<void> {
  if (!isNative) return;
  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#050510' });
  } catch {
    // Status bar not available
  }
}

// ── Splash Screen ───────────────────────────────────────────────

export async function hideSplash(): Promise<void> {
  if (!isNative) return;
  try {
    await SplashScreen.hide({ fadeOutDuration: 500 });
  } catch {
    // Splash screen not available
  }
}

// ── Haptics ─────────────────────────────────────────────────────

export async function hapticLight(): Promise<void> {
  if (!isNative) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    // Haptics not available
  }
}

export async function hapticMedium(): Promise<void> {
  if (!isNative) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch {
    // Haptics not available
  }
}

export async function hapticSuccess(): Promise<void> {
  if (!isNative) return;
  try {
    await Haptics.notification({ type: NotificationType.Success });
  } catch {
    // Haptics not available
  }
}

export async function hapticError(): Promise<void> {
  if (!isNative) return;
  try {
    await Haptics.notification({ type: NotificationType.Error });
  } catch {
    // Haptics not available
  }
}

// ── Network ─────────────────────────────────────────────────────

export interface NetworkStatus {
  connected: boolean;
  connectionType: string;
}

export async function getNetworkStatus(): Promise<NetworkStatus> {
  try {
    const status = await Network.getStatus();
    return {
      connected: status.connected,
      connectionType: status.connectionType,
    };
  } catch {
    return { connected: true, connectionType: 'unknown' };
  }
}

export function onNetworkChange(
  callback: (status: NetworkStatus) => void,
): { remove: () => void } {
  const handle = Network.addListener('networkStatusChange', (status) => {
    callback({
      connected: status.connected,
      connectionType: status.connectionType,
    });
  });
  return {
    remove: () => {
      handle.then((h) => h.remove());
    },
  };
}

// ── Preferences (Offline Storage) ───────────────────────────────

export async function setPreference(
  key: string,
  value: string,
): Promise<void> {
  await Preferences.set({ key, value });
}

export async function getPreference(
  key: string,
): Promise<string | null> {
  const { value } = await Preferences.get({ key });
  return value;
}

export async function removePreference(key: string): Promise<void> {
  await Preferences.remove({ key });
}

// ── Toast ───────────────────────────────────────────────────────

export async function showToast(
  text: string,
  duration: 'short' | 'long' = 'short',
): Promise<void> {
  if (isNative) {
    await Toast.show({ text, duration });
  }
}

// ── Browser (External Links) ────────────────────────────────────

export async function openExternalUrl(url: string): Promise<void> {
  if (isNative) {
    await Browser.open({ url, windowName: '_blank' });
  } else {
    window.open(url, '_blank');
  }
}

// ── Keyboard ────────────────────────────────────────────────────

export function onKeyboardShow(
  callback: (info: { keyboardHeight: number }) => void,
): { remove: () => void } {
  if (!isNative) return { remove: () => {} };
  const handle = Keyboard.addListener('keyboardWillShow', (info) => {
    callback({ keyboardHeight: info.keyboardHeight });
  });
  return {
    remove: () => {
      handle.then((h) => h.remove());
    },
  };
}

export function onKeyboardHide(
  callback: () => void,
): { remove: () => void } {
  if (!isNative) return { remove: () => {} };
  const handle = Keyboard.addListener('keyboardWillHide', () => {
    callback();
  });
  return {
    remove: () => {
      handle.then((h) => h.remove());
    },
  };
}

// ── App Lifecycle ───────────────────────────────────────────────

export function onAppStateChange(
  callback: (isActive: boolean) => void,
): { remove: () => void } {
  const handle = App.addListener('appStateChange', (state) => {
    callback(state.isActive);
  });
  return {
    remove: () => {
      handle.then((h) => h.remove());
    },
  };
}

export function onBackButton(
  callback: () => void,
): { remove: () => void } {
  if (!isAndroid) return { remove: () => {} };
  const handle = App.addListener('backButton', () => {
    callback();
  });
  return {
    remove: () => {
      handle.then((h) => h.remove());
    },
  };
}

// ── Initialize ──────────────────────────────────────────────────

/**
 * Call once at app startup to configure native features.
 */
export async function initializeNativeBridge(): Promise<void> {
  if (!isNative) return;

  await configureStatusBar();

  // Hide splash screen after a short delay to ensure app is rendered
  setTimeout(() => {
    hideSplash();
  }, 300);
}
