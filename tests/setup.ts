/**
 * Test Setup
 * Global test configuration and setup
 */

import { config } from '../src/utils/config';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.OPENROUTER_API_KEY = 'test-key';
process.env.LOG_LEVEL = 'error';

// Mock console methods to reduce noise during tests
const originalConsole = { ...console };

beforeAll(() => {
  console.log = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  console.log = originalConsole.log;
  console.info = originalConsole.info;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
});

// Global test timeout
jest.setTimeout(10000);
