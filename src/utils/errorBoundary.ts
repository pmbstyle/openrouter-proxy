/**
 * Error Boundary Utilities
 * Provides error handling for async operations
 */

import { logger } from './logger';

export const withErrorBoundary = <T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  context: string
) => {
  return async (...args: T): Promise<R | null> => {
    try {
      return await fn(...args);
    } catch (error) {
      logger.error({ 
        error: error instanceof Error ? error.message : String(error),
        context,
        args: args.length > 0 ? args : undefined
      }, `Error in ${context}`);
      
      return null;
    }
  };
};

export const withErrorBoundarySync = <T extends any[], R>(
  fn: (...args: T) => R,
  context: string
) => {
  return (...args: T): R | null => {
    try {
      return fn(...args);
    } catch (error) {
      logger.error({ 
        error: error instanceof Error ? error.message : String(error),
        context,
        args: args.length > 0 ? args : undefined
      }, `Error in ${context}`);
      
      return null;
    }
  };
};

export const safeAsync = async <T>(
  promise: Promise<T>,
  fallback: T,
  context: string
): Promise<T> => {
  try {
    return await promise;
  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? error.message : String(error),
      context
    }, `Error in ${context}, using fallback`);
    
    return fallback;
  }
};

export const safeSync = <T>(
  fn: () => T,
  fallback: T,
  context: string
): T => {
  try {
    return fn();
  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? error.message : String(error),
      context
    }, `Error in ${context}, using fallback`);
    
    return fallback;
  }
};
