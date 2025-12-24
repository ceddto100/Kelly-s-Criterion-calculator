/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Test setup and mocks
 */

import { vi } from 'vitest';

// Mock the server module preserving actual exports but allowing locale mocks
vi.mock('../server.js', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    getCurrentLocale: vi.fn(() => 'en'),
    setCurrentLocale: vi.fn(),
  };
});
