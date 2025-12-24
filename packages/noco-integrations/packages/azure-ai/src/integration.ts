import { generateText, Output } from 'ai';
import { createAzure } from '@ai-sdk/azure';
import {
  type AiGenerateObjectArgs,
  type AiGenerateTextArgs,
  type AiGetModelArgs,
  AiIntegration,
  type ModelCapability,
} from '@noco-integrations/core';
import type { LanguageModelV3 as LanguageModel } from '@ai-sdk/provider';

export class AzureAiIntegration extends AiIntegration {
  private model: LanguageModel | null = null;

  public async generateObject<T = any>(args: AiGenerateObjectArgs) {
    const { messages, schema } = args;

    if (!this.model || args.customModel) {
      const model = args.customModel || this.config.models[0];

      if (!model) {
        throw new Error('Integration not configured properly');
      }

      const resourceName = this.config.resourceName;
      const apiKey = this.config.apiKey;
      const apiVersion = this.config.apiVersion;

      if (!resourceName || !apiKey || !apiVersion) {
        throw new Error('Integration not configured properly');
      }

      const azureClient = createAzure({
        resourceName,
        apiKey,
        apiVersion,
      });

      this.model = azureClient(model);
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

      const customAzureAI = createAzure({
        resourceName: config.resourceName,
        apiKey: apiKey,
      });

      this.model = customAzureAI(model) as LanguageModel;
    }

    const response = await generateText({
      system,
      model: this.model,
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
      // GPT-5.2 series
      'gpt-5.2': 'GPT-5.2',
      'gpt-5.2-chat': 'GPT-5.2 Chat',
      // GPT-5.1 series
      'gpt-5.1': 'GPT-5.1',
      'gpt-5.1-chat': 'GPT-5.1 Chat',
      // GPT-5 series
      'gpt-5': 'GPT-5',
      'gpt-5-mini': 'GPT-5 Mini',
      'gpt-5-nano': 'GPT-5 Nano',
      'gpt-5-chat': 'GPT-5 Chat',
      // GPT-4.1 series
      'gpt-4.1': 'GPT-4.1',
      'gpt-4.1-mini': 'GPT-4.1 Mini',
      'gpt-4.1-nano': 'GPT-4.1 Nano',
      // o-series
      'o3-pro': 'o3 Pro',
      'o4-mini': 'o4-mini',
      o3: 'o3',
      'o3-mini': 'o3 Mini',
      // GPT-4o series
      'gpt-4o': 'GPT-4o',
      'gpt-4o-mini': 'GPT-4o Mini',
    };
    return aliases[model] || model;
  }

  public getModelCapabilities(model: string): ModelCapability[] {
    const capabilities: Record<string, ModelCapability[]> = {
      // GPT-5.x series - vision and tools
      'gpt-5.2': ['text', 'vision', 'tools'],
      'gpt-5.1': ['text', 'vision', 'tools'],
      'gpt-5': ['text', 'vision', 'tools'],
      'gpt-5-mini': ['text', 'vision', 'tools'],
      'gpt-5-nano': ['text', 'vision', 'tools'],
      // Chat variants - text only
      'gpt-5.2-chat': ['text', 'tools'],
      'gpt-5.1-chat': ['text', 'tools'],
      'gpt-5-chat': ['text', 'tools'],
      // GPT-4.1 series
      'gpt-4.1': ['text', 'vision', 'tools'],
      'gpt-4.1-mini': ['text', 'vision', 'tools'],
      'gpt-4.1-nano': ['text', 'tools'],
      // o-series - reasoning models
      'o3-pro': ['text', 'vision', 'tools'],
      'o4-mini': ['text', 'vision', 'tools'],
      o3: ['text', 'vision', 'tools'],
      'o3-mini': ['text', 'tools'],
      // GPT-4o series
      'gpt-4o': ['text', 'vision', 'tools'],
      'gpt-4o-mini': ['text', 'vision', 'tools'],
    };
    return capabilities[model] || ['text'];
  }

  public getModel(args?: AiGetModelArgs): LanguageModel {
    const customModel = args?.customModel;
    const model = customModel || this.config.models[0];

    if (!model) {
      throw new Error('Integration not configured properly');
    }

    const resourceName = this.config.resourceName;
    const apiKey = this.config.apiKey;
    const apiVersion = this.config.apiVersion;

    if (!resourceName || !apiKey) {
      throw new Error('Integration not configured properly');
    }

    const azureClient = createAzure({
      resourceName,
      apiKey,
      apiVersion,
    });

    return azureClient(model);
  }

  public availableModels() {
    return this.config.models.map((model: string) => ({
      value: model,
      label: this.getModelAlias(model),
      capabilities: this.getModelCapabilities(model),
    }));
  }
}
