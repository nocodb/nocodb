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

  protected supportedModels = [
    // GPT-5.2 series
    {
      value: 'gpt-5.2',
      label: 'GPT-5.2',
      capabilities: ['text', 'vision', 'tools'] as ModelCapability[],
    },
    {
      value: 'gpt-5.2-chat',
      label: 'GPT-5.2 Chat',
      capabilities: ['text', 'tools'] as ModelCapability[],
    },
    // GPT-5.1 series
    {
      value: 'gpt-5.1',
      label: 'GPT-5.1',
      capabilities: ['text', 'vision', 'tools'] as ModelCapability[],
    },
    {
      value: 'gpt-5.1-chat',
      label: 'GPT-5.1 Chat',
      capabilities: ['text', 'tools'] as ModelCapability[],
    },
    // GPT-5 series
    {
      value: 'gpt-5',
      label: 'GPT-5',
      capabilities: ['text', 'vision', 'tools'] as ModelCapability[],
    },
    {
      value: 'gpt-5-mini',
      label: 'GPT-5 Mini',
      capabilities: ['text', 'vision', 'tools'] as ModelCapability[],
    },
    {
      value: 'gpt-5-nano',
      label: 'GPT-5 Nano',
      capabilities: ['text', 'vision', 'tools'] as ModelCapability[],
    },
    {
      value: 'gpt-5-chat',
      label: 'GPT-5 Chat',
      capabilities: ['text', 'tools'] as ModelCapability[],
    },
    // GPT-4.1 series
    {
      value: 'gpt-4.1',
      label: 'GPT-4.1',
      capabilities: ['text', 'vision', 'tools'] as ModelCapability[],
    },
    {
      value: 'gpt-4.1-mini',
      label: 'GPT-4.1 Mini',
      capabilities: ['text', 'vision', 'tools'] as ModelCapability[],
    },
    {
      value: 'gpt-4.1-nano',
      label: 'GPT-4.1 Nano',
      capabilities: ['text', 'tools'] as ModelCapability[],
    },
    // o-series
    {
      value: 'o3-pro',
      label: 'o3 Pro',
      capabilities: ['text', 'vision', 'tools'] as ModelCapability[],
    },
    {
      value: 'o4-mini',
      label: 'o4-mini',
      capabilities: ['text', 'vision', 'tools'] as ModelCapability[],
    },
    {
      value: 'o3',
      label: 'o3',
      capabilities: ['text', 'vision', 'tools'] as ModelCapability[],
    },
    {
      value: 'o3-mini',
      label: 'o3 Mini',
      capabilities: ['text', 'tools'] as ModelCapability[],
    },
    // GPT-4o series
    {
      value: 'gpt-4o',
      label: 'GPT-4o',
      capabilities: ['text', 'vision', 'tools'] as ModelCapability[],
    },
    {
      value: 'gpt-4o-mini',
      label: 'GPT-4o Mini',
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
}
