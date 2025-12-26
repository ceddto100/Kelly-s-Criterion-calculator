/**
 * Vitest Test Setup
 *
 * Global setup for all tests in the MCP server.
 */

// Mock process.env for tests
process.env.DEBUG_MCP = '0';
process.env.PORT = '3001';

// Ensure tests don't try to connect to real database
process.env.MONGODB_URI = '';
