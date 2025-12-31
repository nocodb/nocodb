import { generateText, Output } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import {
  type AiGenerateObjectArgs,
  type AiGenerateTextArgs,
  type AiGetModelArgs,
  AiIntegration,
  type ModelCapability,
} from '@noco-integrations/core';
import type { LanguageModelV3 as LanguageModel } from '@ai-sdk/provider';

export class ClaudeIntegration extends AiIntegration {
  private model: LanguageModel | null = null;

  protected supportedModels = [
    // Claude 4.5 series
    {
      value: 'claude-opus-4-5',
      label: 'Claude Opus 4.5',
      capabilities: ['text', 'vision', 'tools'] as ModelCapability[],
    },
    {
      value: 'claude-sonnet-4-5',
      label: 'Claude Sonnet 4.5',
      capabilities: ['text', 'vision', 'tools'] as ModelCapability[],
    },
    {
      value: 'claude-haiku-4-5',
      label: 'Claude Haiku 4.5',
      capabilities: ['text', 'vision', 'tools'] as ModelCapability[],
    },
    // Claude 4.1 series
    {
      value: 'claude-opus-4-1',
      label: 'Claude Opus 4.1',
      capabilities: ['text', 'vision', 'tools'] as ModelCapability[],
    },
    // Claude 4.0 series
    {
      value: 'claude-opus-4-0',
      label: 'Claude Opus 4',
      capabilities: ['text', 'vision', 'tools'] as ModelCapability[],
    },
    {
      value: 'claude-sonnet-4-0',
      label: 'Claude Sonnet 4',
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

      const anthropic = createAnthropic({
        apiKey,
      });

      this.model = anthropic(model);
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
