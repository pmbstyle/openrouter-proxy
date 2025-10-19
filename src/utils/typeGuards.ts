/**
 * Type Guards
 * Utility functions for type checking and validation
 */

import { NonStreamingChoice, StreamingChoice, NonChatChoice } from '../types/openrouter';

export const isNonStreamingChoice = (choice: any): choice is NonStreamingChoice => {
  return choice && typeof choice === 'object' && 'message' in choice;
};

export const isStreamingChoice = (choice: any): choice is StreamingChoice => {
  return choice && typeof choice === 'object' && 'delta' in choice;
};

export const isNonChatChoice = (choice: any): choice is NonChatChoice => {
  return choice && typeof choice === 'object' && 'text' in choice;
};

export const hasMessage = (choice: any): choice is NonStreamingChoice => {
  return isNonStreamingChoice(choice) && !!choice.message;
};

export const hasDelta = (choice: any): choice is StreamingChoice => {
  return isStreamingChoice(choice) && !!choice.delta;
};

export const isError = (error: any): error is Error => {
  return error instanceof Error;
};

export const isString = (value: any): value is string => {
  return typeof value === 'string';
};

export const isNumber = (value: any): value is number => {
  return typeof value === 'number' && !isNaN(value);
};

export const isObject = (value: any): value is object => {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
};
