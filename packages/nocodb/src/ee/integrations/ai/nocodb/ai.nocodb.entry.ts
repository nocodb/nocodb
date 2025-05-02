import { type CoreMessage, generateObject, type LanguageModel } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { type Schema } from 'zod';
import OpenAiIntegration from '~/integrations/ai/openai/ai.openai.entry';

const modelMap = {
  high: 'gpt-4o',
  medium: 'gpt-4o-mini',
  low: 'gpt-4o-mini',
};

export default class NocoAiIntegration extends OpenAiIntegration {
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

      const inputModel = args.customModel || config?.models?.[0];

      const model = modelMap[inputModel];

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

    const response = await generateObject<T>({
      model: this.model,
      schema,
      messages,
      temperature: 0.5,
    });

    return {
      usage: {
        input_tokens: response.usage.promptTokens,
        output_tokens: response.usage.completionTokens,
        total_tokens: response.usage.totalTokens,
        model: this.model.modelId,
      },
      data: response.object,
    };
  }

  public getModelAlias(model: string) {
    const aliases = {
      high: 'High',
      medium: 'Medium',
      low: 'Low',
    };

    return aliases[model] || model;
  }
}
