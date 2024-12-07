import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateObject } from 'ai';
import type { CoreMessage, LanguageModel } from 'ai';
import type { Schema } from 'zod';
import AiIntegration from '~/integrations/ai/ai.interface';

export default class GoogleIntegrationIntegration extends AiIntegration {
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

      const customGoogleAi = createGoogleGenerativeAI({
        apiKey: apiKey,
      });

      this.model = customGoogleAi(model) as LanguageModel;
    }

    const { usage, object } = await generateObject<T>({
      model: this.model,
      schema,
      messages,
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
      'gemini-1.5-pro': 'Gemini 1.5 Pro',
      'gemini-1.5-flash': 'Gemini 1.5 Flash',
    };

    return aliases[model] || model;
  }

  public availableModels(): { value: string; label: string }[] {
    return this.getConfig().models.map((model: string) => ({
      value: model,
      label: this.getModelAlias(model),
    }));
  }
}
