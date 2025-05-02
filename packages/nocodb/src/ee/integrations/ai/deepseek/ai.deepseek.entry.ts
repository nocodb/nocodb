import { createDeepSeek } from '@ai-sdk/deepseek';
import { generateObject } from 'ai';
import type { CoreMessage, LanguageModel } from 'ai';
import type { Schema } from 'zod';
import AiIntegration from '~/integrations/ai/ai.interface';

export default class DeepseekIntegration extends AiIntegration {
  protected model: LanguageModel;

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

      let baseURL = config.baseURL;

      if (!baseURL) {
        baseURL = undefined;
      }

      const customDeepseek = createDeepSeek({
        apiKey,
        baseURL,
      });

      this.model = customDeepseek(model) as LanguageModel;
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
        input_tokens: usage.promptTokens,
        output_tokens: usage.completionTokens,
        total_tokens: usage.totalTokens,
        model: this.model.modelId,
      },
      data: object,
    };
  }

  public getModelAlias(model: string): string {
    const aliases = {
      'deepseek-chat': 'Deepseek Chat',
    };

    return aliases[model] || model;
  }
}
