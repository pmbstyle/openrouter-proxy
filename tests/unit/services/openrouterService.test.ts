/**
 * OpenRouter Service Unit Tests
 */

import { OpenRouterService } from '../../../src/services/openrouterService';
import { config } from '../../../src/utils/config';

// Mock axios
jest.mock('axios');
const mockedAxios = require('axios');

describe('OpenRouterService', () => {
  let service: OpenRouterService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OpenRouterService();
  });

  describe('constructor', () => {
    it('should initialize with correct configuration', () => {
      expect(service).toBeInstanceOf(OpenRouterService);
    });
  });

  describe('createCompletion', () => {
    it('should create a completion successfully', async () => {
      const mockResponse = {
        data: {
          id: 'test-id',
          choices: [{
            finish_reason: 'stop',
            message: {
              content: 'Test response',
              role: 'assistant'
            }
          }],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15
          },
          model: 'test-model',
          created: 1234567890,
          object: 'chat.completion'
        }
      };

      mockedAxios.create.mockReturnValue({
        post: jest.fn().mockResolvedValue(mockResponse),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      });

      const request = {
        model: 'test-model',
        messages: [{ role: 'user', content: 'Test message' }],
        temperature: 0.7
      };

      const result = await service.createCompletion(request);

      expect(result).toEqual({
        id: 'test-id',
        choices: [{
          finish_reason: 'stop',
          message: {
            content: 'Test response',
            role: 'assistant'
          }
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15
        },
        model: 'test-model',
        created: 1234567890,
        object: 'chat.completion'
      });
    });

    it('should handle errors properly', async () => {
      const mockError = new Error('API Error');
      mockedAxios.create.mockReturnValue({
        post: jest.fn().mockRejectedValue(mockError),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      });

      const request = {
        model: 'test-model',
        messages: [{ role: 'user', content: 'Test message' }]
      };

      await expect(service.createCompletion(request)).rejects.toThrow('API Error');
    });
  });

  describe('getModels', () => {
    it('should get models successfully', async () => {
      const mockResponse = {
        data: {
          data: [
            {
              id: 'test-model-1',
              name: 'Test Model 1',
              context_length: 4096
            },
            {
              id: 'test-model-2',
              name: 'Test Model 2',
              context_length: 8192
            }
          ]
        }
      };

      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockResolvedValue(mockResponse),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      });

      const result = await service.getModels();

      expect(result).toEqual([
        {
          id: 'test-model-1',
          name: 'Test Model 1',
          context_length: 4096
        },
        {
          id: 'test-model-2',
          name: 'Test Model 2',
          context_length: 8192
        }
      ]);
    });
  });

  describe('healthCheck', () => {
    it('should return true when service is healthy', async () => {
      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockResolvedValue({ data: {} }),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      });

      const result = await service.healthCheck();

      expect(result).toBe(true);
    });

    it('should return false when service is unhealthy', async () => {
      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockRejectedValue(new Error('Service unavailable')),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() }
        }
      });

      const result = await service.healthCheck();

      expect(result).toBe(false);
    });
  });
});
