import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAIIntegration } from '../src/integration';
import { z } from 'zod';

// Mock the ai and @ai-sdk/openai dependencies
vi.mock('ai', () => {
  return {
    generateObject: vi.fn().mockResolvedValue({
      object: { result: 'mocked response' },
      usage: {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      },
    })
  };
});

vi.mock('@ai-sdk/openai', () => {
  return {
    createOpenAI: vi.fn().mockReturnValue((model: string) => ({
      modelId: model,
    }))
  };
});

describe('OpenAIIntegration', () => {
  let integration: OpenAIIntegration;
  
  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Initialize with config
    integration = new OpenAIIntegration({
      apiKey: 'test-api-key',
      models: ['gpt-4o'],
    });
  });

  describe('generateObject', () => {
    it('should generate an object with the provided schema and messages', async () => {
      const schema = z.object({
        result: z.string(),
      });
      
      const result = await integration.generateObject({
        messages: [{ role: 'user', content: 'Test message' }],
        schema,
      });
      
      expect(result).toEqual({
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          total_tokens: 30,
          model: 'gpt-4o',
        },
        data: { result: 'mocked response' },
      });
      
      // Verify that createOpenAI was called once
      const { createOpenAI } = await import('@ai-sdk/openai');
      expect(vi.mocked(createOpenAI)).toHaveBeenCalledTimes(1);
    });
    
    it('should reuse the existing model when already initialized and no custom model provided', async () => {
      const schema = z.object({
        result: z.string(),
      });
      
      // First call to initialize the model
      await integration.generateObject({
        messages: [{ role: 'user', content: 'First message' }],
        schema,
      });
      
      // Clear the mocks to track new calls
      const { createOpenAI } = await import('@ai-sdk/openai');
      const { generateObject } = await import('ai');
      vi.mocked(createOpenAI).mockClear();
      vi.mocked(generateObject).mockClear();
      
      // Second call should reuse the model
      await integration.generateObject({
        messages: [{ role: 'user', content: 'Second message' }],
        schema,
      });
      
      // Verify createOpenAI was not called again (since model is already initialized)
      expect(vi.mocked(createOpenAI)).not.toHaveBeenCalled();
      
      // Verify generateObject was called with expected arguments
      expect(vi.mocked(generateObject)).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [{ role: 'user', content: 'Second message' }],
        })
      );
    });
    
    it('should throw an error when apiKey is not provided', async () => {
      // Initialize with empty apiKey
      const testIntegration = new OpenAIIntegration({
        models: ['gpt-4o'],
        apiKey: '',
      });
      
      const schema = z.object({
        result: z.string(),
      });
      
      await expect(
        testIntegration.generateObject({
          messages: [{ role: 'user', content: 'Test message' }],
          schema,
        })
      ).rejects.toThrow('Integration not configured properly');
    });
    
    it('should throw an error when models are not provided', async () => {
      // Initialize with empty models array
      const testIntegration = new OpenAIIntegration({
        apiKey: 'test-api-key',
        models: [],
      });
      
      const schema = z.object({
        result: z.string(),
      });
      
      await expect(
        testIntegration.generateObject({
          messages: [{ role: 'user', content: 'Test message' }],
          schema,
        })
      ).rejects.toThrow('Integration not configured properly');
    });
    
    it('should use a custom model if provided', async () => {
      const schema = z.object({
        result: z.string(),
      });
      
      // Import and clear mock
      const { generateObject } = await import('ai');
      vi.mocked(generateObject).mockClear();
      
      await integration.generateObject({
        messages: [{ role: 'user', content: 'Test message' }],
        schema,
        customModel: 'gpt-3.5-turbo',
      });
      
      expect(vi.mocked(generateObject)).toHaveBeenCalledWith(expect.objectContaining({
        model: expect.objectContaining({ modelId: 'gpt-3.5-turbo' }),
      }));
    });
  });
  
  describe('getModelAlias', () => {
    it('should return the correct alias for known models', () => {
      expect(integration.getModelAlias('gpt-4o')).toBe('GPT-4o');
      expect(integration.getModelAlias('gpt-4o-mini')).toBe('GPT-4o Mini');
      expect(integration.getModelAlias('gpt-4-turbo')).toBe('GPT-4 Turbo');
      expect(integration.getModelAlias('gpt-4')).toBe('GPT-4');
      expect(integration.getModelAlias('gpt-3.5-turbo')).toBe('GPT-3.5 Turbo');
    });
    
    it('should return the original model name for unknown models', () => {
      expect(integration.getModelAlias('unknown-model')).toBe('unknown-model');
    });
  });
  
  describe('availableModels', () => {
    it('should return an array of available models with their aliases', () => {
      // Initialize with multiple models
      const testIntegration = new OpenAIIntegration({
        apiKey: 'test-api-key',
        models: ['gpt-4o', 'gpt-3.5-turbo'],
      });
      
      expect(testIntegration.availableModels()).toEqual([
        { value: 'gpt-4o', label: 'GPT-4o' },
        { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
      ]);
    });
    
    it('should handle custom model names', () => {
      // Initialize with custom model
      const testIntegration = new OpenAIIntegration({
        apiKey: 'test-api-key',
        models: ['custom-model'],
      });
      
      expect(testIntegration.availableModels()).toEqual([
        { value: 'custom-model', label: 'custom-model' },
      ]);
    });
  });
}); 