/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Test setup and mocks
 */

import { vi } from 'vitest';

// Mock the server module to prevent it from executing during tests
vi.mock('../server.js', () => ({
  getCurrentLocale: vi.fn(() => 'en'),
  setCurrentLocale: vi.fn(),
}));
