import { generateText, Output } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import {
  type AiGenerateObjectArgs,
  type AiGetModelArgs,
  AiIntegration,
  type ModelCapability,
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

    const response = await generateText({
      model: this.model as LanguageModel,
      output: Output.object({ schema }),
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
      data: response.output as T,
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
    return model; // Use the model name as-is for compatible providers
  }

  public getModelCapabilities(_model: string): ModelCapability[] {
    return ['text', 'tools'];
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

  public availableModels() {
    return this.config.models.map((model: string) => ({
      value: model,
      label: this.getModelAlias(model),
      capabilities: this.getModelCapabilities(model),
    }));
  }
}
