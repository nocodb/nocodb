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
      'claude-3-5-sonnet-20240620': 'Claude 3.5 Sonnet',
      'claude-3-opus-20240229': 'Claude 3 Opus',
      'claude-3-sonnet-20240229': 'Claude 3 Sonnet',
      'claude-3-haiku-20240307': 'Claude 3 Haiku',
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
