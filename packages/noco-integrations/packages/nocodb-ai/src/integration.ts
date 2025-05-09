import { generateObject, type LanguageModel } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { AiIntegration } from '@noco-integrations/core';
import type {
  AiGenerateObjectArgs,
} from '@noco-integrations/core';

const modelMap: Record<string, string> = {
  high: 'gpt-4o',
  medium: 'gpt-4o-mini',
  low: 'gpt-4o-mini',
};

export class NocodbAiIntegration extends AiIntegration {
  private model: LanguageModel | null = null;

  public async generateObject<T = any>(
    args: AiGenerateObjectArgs,
  ) {
    const { messages, schema } = args;

    if (!this.model || args.customModel) {
      const config = this.config || {};

      const inputModel = args.customModel || config?.models?.[0];

      const model =
        modelMap[inputModel as keyof typeof modelMap] || modelMap.high;

      const apiKey = config.apiKey;

      if (!apiKey) {
        throw new Error('Integration not configured properly');
      }

      const customOpenAi = createOpenAI({
        apiKey: apiKey,
        compatibility: 'strict',
      });

      this.model = customOpenAi(model) as LanguageModel;
    }

    const response = await generateObject({
      model: this.model as LanguageModel,
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
      data: response.object as T,
    };
  }

  public getModelAlias(model: string): string {
    const aliases: Record<string, string> = {
      high: 'High',
      medium: 'Medium',
      low: 'Low',
    };

    return aliases[model] || model;
  }

  public availableModels(): { value: string; label: string }[] {
    return (this.config?.models || []).map((model: string) => ({
      value: model,
      label: this.getModelAlias(model),
    }));
  }
}
