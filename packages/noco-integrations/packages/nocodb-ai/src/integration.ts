import { generateObject, generateText, type LanguageModel } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { AiIntegration } from '@noco-integrations/core';
import type {
  AiGenerateObjectArgs,
  AiGenerateTextArgs,
} from '@noco-integrations/core';

const modelMap: Record<string, string> = {
  high: 'gpt-4o',
  medium: 'gpt-4o-mini',
  low: 'gpt-4o-mini',
};

export class NocodbAiIntegration extends AiIntegration {
  private model: LanguageModel | null = null;

  public async generateObject<T = any>(args: AiGenerateObjectArgs) {
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

  public async generateText(args: AiGenerateTextArgs) {
    const { prompt, messages, customModel, system } = args;

    if (!this.model || customModel) {
      const config = this.config;

      const inputModel = args.customModel || config?.models?.[0];

      const model =
        modelMap[inputModel as keyof typeof modelMap] || modelMap.high;

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

    const response = await generateText({
      model: this.model,
      prompt,
      messages,
      temperature: 0.5,
      system,
    });

    return {
      usage: {
        input_tokens: response.usage.promptTokens,
        output_tokens: response.usage.completionTokens,
        total_tokens: response.usage.totalTokens,
        model: this.model.modelId,
      },
      data: response.text,
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
