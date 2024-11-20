import { type CoreMessage, generateObject, type LanguageModel } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import type { Schema } from 'zod';
import AiIntegration from '~/integrations/ai/ai.interface';

export default class GroqIntegration extends AiIntegration {
  model: LanguageModel;

  public async generateObject<T>(args: {
    messages: CoreMessage[];
    schema: Schema;
    customModel?: string;
  }): Promise<{
    usage: {
      input_tokens: number;
      output_tokens: number;
      total_tokens: number;
      model: string;
    };
    data: T;
  }> {
    const { messages, schema } = args;

    if (!this.model || args.customModel) {
      const config = this.getConfig();

      const model = args.customModel || config?.models?.[0];

      if (!model) {
        throw new Error('Integration not configured properly');
      }

      const apiKey = config.apiKey;

      if (!apiKey) {
        throw new Error('Integration not configured properly');
      }

      const customOpenAi = createOpenAI({
        baseURL: 'https://api.groq.com/openai/v1',
        apiKey: apiKey,
      });

      this.model = customOpenAi(model);
    }

    const { usage, object } = await generateObject<T>({
      model: this.model,
      schema,
      messages,
      mode: 'json',
    });

    return {
      usage: {
        input_tokens: usage.promptTokens,
        output_tokens: usage.completionTokens,
        total_tokens: usage.totalTokens,
        model: this.model.modelId,
      },
      data: object,
    };
  }

  public availableModels(): string[] {
    return this.getConfig().models;
  }
}
