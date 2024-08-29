import { createAnthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import type { CoreMessage, LanguageModel } from 'ai';
import type { Schema } from 'zod';
import AiIntegration from '~/integrations/ai/ai.interface';

export default class ClaudeIntegrationIntegration extends AiIntegration {
  protected model: LanguageModel;

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

      const customClaude = createAnthropic({
        apiKey: apiKey,
      });

      this.model = customClaude(model);
    }

    const { usage, object } = await generateObject<T>({
      model: this.model,
      schema,
      messages: [
        {
          role: 'system',
          content: 'Strictly follow provided format & return exact JSON object',
        },
        ...messages,
      ],
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
