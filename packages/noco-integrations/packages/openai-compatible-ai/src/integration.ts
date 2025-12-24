import { generateObject, generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import {
  type AiGenerateObjectArgs,
  type AiGetModelArgs,
  AiIntegration,
} from '@noco-integrations/core';
import type { AiGenerateTextArgs } from '@noco-integrations/core';
import type { LanguageModelV3 as LanguageModel } from '@ai-sdk/provider';

export class OpenAiCompatibleAiIntegration extends AiIntegration {
  private model: LanguageModel | null = null;

  public async generateObject<T = any>(args: AiGenerateObjectArgs) {
    const { messages, schema } = args;

    if (!this.model || args.customModel) {
      const model = args.customModel || this.config.models[0];

      if (!model) {
        throw new Error('Integration not configured properly');
      }

      const baseURL = this.config.baseURL;
      const apiKey = this.config.apiKey || 'dummy-key'; // Some implementations don't require an API key

      if (!baseURL) {
        throw new Error('Integration not configured properly');
      }

      const openAIClient = createOpenAI({
        baseURL,
        apiKey,
      });

      this.model = openAIClient(model);
    }

    const response = await generateObject({
      model: this.model as LanguageModel,
      schema,
      messages,
      temperature: 0.5,
    });

    return {
      usage: {
        input_tokens: response.usage.inputTokens,
        output_tokens: response.usage.outputTokens,
        total_tokens: response.usage.totalTokens,
        model: this.model.modelId,
      },
      data: response.object as T,
    };
  }

  public async generateText(args: AiGenerateTextArgs) {
    const { customModel, system } = args;

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

      let baseURL = config.baseURL;

      if (!baseURL) {
        baseURL = undefined;
      }

      const customOpenai = createOpenAI({
        apiKey,
        baseURL,
      });

      this.model = customOpenai(model) as LanguageModel;
    }

    const response = await generateText({
      model: this.model,
      system,
      temperature: 0.5,
      ...('messages' in args
        ? { messages: args.messages }
        : { prompt: args.prompt }),
    });

    return {
      usage: {
        input_tokens: response.usage.inputTokens,
        output_tokens: response.usage.outputTokens,
        total_tokens: response.usage.totalTokens,
        model: this.model.modelId,
      },
      data: response.text,
    };
  }

  public getModelAlias(model: string): string {
    const aliases: Record<string, string> = {
      'llama-4-maverick': 'Llama 4 Maverick',
      'llama-3-70b': 'Llama 3 70B',
      'mixtral-8x22b': 'Mixtral 8x22B',
      'deepseek-r1-distill-llama-70b': 'DeepSeek R1 Distill Llama 70B',
    };
    return aliases[model] || model;
  }

  public getModel(args?: AiGetModelArgs): LanguageModel {
    const customModel = args?.customModel;
    const model = customModel || this.config.models[0];

    if (!model) {
      throw new Error('Integration not configured properly');
    }

    const baseURL = this.config.baseURL;
    const apiKey = this.config.apiKey || 'dummy-key'; // Some implementations don't require an API key

    if (!baseURL) {
      throw new Error('Integration not configured properly');
    }

    const openAIClient = createOpenAI({
      baseURL,
      apiKey,
    });

    return openAIClient(model);
  }

  public availableModels(): { value: string; label: string }[] {
    return this.config.models.map((model: string) => ({
      value: model,
      label: this.getModelAlias(model),
    }));
  }
}
