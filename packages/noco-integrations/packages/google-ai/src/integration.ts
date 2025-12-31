import { generateText, Output } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import {
  type AiGenerateObjectArgs,
  type AiGenerateTextArgs,
  type AiGetModelArgs,
  AiIntegration,
  type ModelCapability,
} from '@noco-integrations/core';
import type { LanguageModelV3 as LanguageModel } from '@ai-sdk/provider';

export class GeminiIntegration extends AiIntegration {
  private model: LanguageModel | null = null;

  protected supportedModels = [
    {
      value: 'gemini-2.5-pro',
      label: 'Gemini 2.5 Pro',
      capabilities: ['text', 'vision', 'tools'] as ModelCapability[],
    },
    {
      value: 'gemini-2.5-flash',
      label: 'Gemini 2.5 Flash',
      capabilities: ['text', 'vision', 'tools'] as ModelCapability[],
    },
    {
      value: 'gemini-2.5-flash-lite',
      label: 'Gemini 2.5 Flash Lite',
      capabilities: ['text', 'vision', 'tools'] as ModelCapability[],
    },
    {
      value: 'gemini-3-flash',
      label: 'Gemini 3 Flash',
      capabilities: ['text', 'vision', 'tools'] as ModelCapability[],
    },
    {
      value: 'gemini-2.0-flash',
      label: 'Gemini 2.0 Flash',
      capabilities: ['text', 'vision', 'tools'] as ModelCapability[],
    },
  ];

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

      const google = createGoogleGenerativeAI({
        apiKey,
      });

      this.model = google(model);
    }

    const response = await generateText({
      model: this.model,
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

      const customGoogleAi = createGoogleGenerativeAI({
        apiKey: apiKey,
      });

      this.model = customGoogleAi(model) as LanguageModel;
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

  public getModel(args?: AiGetModelArgs): LanguageModel {
    const customModel = args?.customModel;
    const model = customModel || this.config.models[0];

    if (!model) {
      throw new Error('Integration not configured properly');
    }

    const apiKey = this.config.apiKey;

    if (!apiKey) {
      throw new Error('Integration not configured properly');
    }

    const google = createGoogleGenerativeAI({
      apiKey,
    });

    return google(model);
  }
}
