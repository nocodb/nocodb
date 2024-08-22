import { type CoreMessage, generateObject, type LanguageModel } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import type { Schema } from 'zod';
import AiIntegration from '~/integrations/ai/ai.interface';

export default class OpenAiIntegration extends AiIntegration {
  model: LanguageModel;

  public async generateObject<T>(args: {
    messages: CoreMessage[];
    schema: Schema;
  }): Promise<{
    usage: {
      input: number;
      output: number;
      total: number;
    };
    data: T;
  }> {
    const { messages, schema } = args;

    if (!this.model) {
      const config = this.getConfig();

      const model = config.model;

      if (!model) {
        throw new Error('Integration not configured properly');
      }

      const apiKey = config.apiKey;

      if (!apiKey) {
        throw new Error('Integration not configured properly');
      }

      const customOpenAi = createOpenAI({
        apiKey: apiKey,
        compatibility: 'strict',
      });

      this.model = customOpenAi(model);
    }

    const { usage, object } = await generateObject<T>({
      model: this.model,
      schema,
      messages,
    });

    return {
      usage: {
        input: usage.promptTokens,
        output: usage.completionTokens,
        total: usage.totalTokens,
      },
      data: object,
    };
  }
}
