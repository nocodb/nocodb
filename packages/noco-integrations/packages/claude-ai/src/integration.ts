import { generateObject, generateText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import {
  type AiGenerateObjectArgs,
  type AiGenerateTextArgs,
  type AiGetModelArgs,
  AiIntegration,
} from '@noco-integrations/core';
import type { LanguageModelV3 as LanguageModel } from '@ai-sdk/provider';

export class ClaudeIntegration extends AiIntegration {
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

      const anthropic = createAnthropic({
        apiKey,
      });

      this.model = anthropic(model);
    }

    const response = await generateObject({
      model: this.model,
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

      const customClaude = createAnthropic({
        apiKey: apiKey,
      });

      this.model = customClaude(model);
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
      'claude-3-5-sonnet-20240620': 'Claude 3.5 Sonnet',
      'claude-3-opus-20240229': 'Claude 3 Opus',
      'claude-3-sonnet-20240229': 'Claude 3 Sonnet',
      'claude-3-haiku-20240307': 'Claude 3 Haiku',
      'claude-2.1': 'Claude 2.1',
      'claude-2.0': 'Claude 2.0',
      'claude-instant-1.2': 'Claude Instant 1.2',
    };

    return aliases[model] || model;
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

    const anthropic = createAnthropic({
      apiKey,
    });

    return anthropic(model);
  }
}
