import { generateObject, generateText, type LanguageModel } from 'ai';
import { createDeepSeek } from '@ai-sdk/deepseek';
import {
  type AiGenerateObjectArgs,
  type AiGenerateTextArgs,
  AiIntegration,
} from '@noco-integrations/core';

export class DeepseekAiIntegration extends AiIntegration {
  private model: LanguageModel | null = null;

  public async generateObject<T = any>(args: AiGenerateObjectArgs) {
    const { messages, schema } = args;

    if (!this.model || args.customModel) {
      const model = args.customModel || this.config.models[0];

      if (!model) {
        throw new Error('Integration not configured properly');
      }

      const apiKey = this.config.apiKey;

      if (!apiKey) {
        throw new Error('Integration not configured properly');
      }

      const deepseekClient = createDeepSeek({
        apiKey,
      });

      this.model = deepseekClient(model);
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

      const model = customModel || config?.models?.[0];

      if (!model) {
        throw new Error('Integration not configured properly');
      }

      const apiKey = config.apiKey;

      if (!apiKey) {
        throw new Error('Integration not configured properly');
      }

      const customDeepseek = createDeepSeek({
        apiKey,
      });

      this.model = customDeepseek(model) as LanguageModel;
    }

    const response = await generateText({
      model: this.model,
      prompt,
      messages,
      system,
      temperature: 0.5,
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
      'deepseek-v3': 'DeepSeek v3',
      'deepseek-r1': 'DeepSeek R1',
    };
    return aliases[model] || model;
  }

  public availableModels(): { value: string; label: string }[] {
    return this.config.models.map((model: string) => ({
      value: model,
      label: this.getModelAlias(model),
    }));
  }
}
