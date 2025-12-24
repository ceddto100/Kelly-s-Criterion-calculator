/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Test setup and mocks
 */

import { vi } from 'vitest';

// Mock getCurrentLocale to avoid importing the full server
vi.mock('../server.js', () => ({
  getCurrentLocale: vi.fn(() => 'en'),
  setCurrentLocale: vi.fn(),
}));
