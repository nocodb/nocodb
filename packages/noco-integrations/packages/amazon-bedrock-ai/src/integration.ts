import { generateText, Output } from 'ai';
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import {
  type AiGenerateObjectArgs,
  type AiGenerateTextArgs,
  type AiGetModelArgs,
  AiIntegration,
  type ModelCapability,
} from '@noco-integrations/core';
import type { LanguageModelV3 as LanguageModel } from '@ai-sdk/provider';

export class AmazonBedrockAiIntegration extends AiIntegration {
  private model: LanguageModel | null = null;

  protected supportedModels = [
    {
      value: 'anthropic.claude-opus-4-5-20251101-v1:0',
      label: 'Claude Opus 4.5',
      capabilities: ['text', 'vision', 'tools'] as ModelCapability[],
    },
    {
      value: 'anthropic.claude-sonnet-4-5-20250929-v1:0',
      label: 'Claude Sonnet 4.5',
      capabilities: ['text', 'vision', 'tools'] as ModelCapability[],
    },
    {
      value: 'anthropic.claude-haiku-4-5-20251001-v1:0',
      label: 'Claude Haiku 4.5',
      capabilities: ['text', 'vision', 'tools'] as ModelCapability[],
    },
    {
      value: 'anthropic.claude-opus-4-1-20250805-v1:0',
      label: 'Claude Opus 4.1',
      capabilities: ['text', 'vision', 'tools'] as ModelCapability[],
    },
    {
      value: 'anthropic.claude-sonnet-4-20250514-v1:0',
      label: 'Claude Sonnet 4',
      capabilities: ['text', 'vision', 'tools'] as ModelCapability[],
    },
    {
      value: 'amazon.nova-2-lite-v1:0',
      label: 'Nova 2 Lite',
      capabilities: ['text', 'vision', 'tools'] as ModelCapability[],
    },
    {
      value: 'amazon.nova-premier-v1:0',
      label: 'Nova Premier',
      capabilities: ['text', 'vision', 'tools'] as ModelCapability[],
    },
    {
      value: 'amazon.nova-pro-v1:0',
      label: 'Nova Pro',
      capabilities: ['text', 'vision', 'tools'] as ModelCapability[],
    },
    {
      value: 'amazon.nova-lite-v1:0',
      label: 'Nova Lite',
      capabilities: ['text', 'vision', 'tools'] as ModelCapability[],
    },
    {
      value: 'amazon.nova-micro-v1:0',
      label: 'Nova Micro',
      capabilities: ['text', 'tools'] as ModelCapability[],
    },
    {
      value: 'meta.llama4-maverick-17b-instruct-v1:0',
      label: 'Llama 4 Maverick',
      capabilities: ['text', 'vision', 'tools'] as ModelCapability[],
    },
    {
      value: 'meta.llama4-scout-17b-instruct-v1:0',
      label: 'Llama 4 Scout',
      capabilities: ['text', 'vision', 'tools'] as ModelCapability[],
    },
    {
      value: 'meta.llama3-3-70b-instruct-v1:0',
      label: 'Llama 3.3 70B',
      capabilities: ['text', 'tools'] as ModelCapability[],
    },
    {
      value: 'deepseek.r1-v1:0',
      label: 'DeepSeek R1',
      capabilities: ['text', 'tools'] as ModelCapability[],
    },
    {
      value: 'deepseek.v3-v1:0',
      label: 'DeepSeek V3.1',
      capabilities: ['text', 'tools'] as ModelCapability[],
    },
    {
      value: 'mistral.mistral-large-3-675b-instruct',
      label: 'Mistral Large 3',
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

      const accessKeyId = this.config.accessKeyId;
      const secretAccessKey = this.config.secretAccessKey;
      const region = this.config.region;

      if (!accessKeyId || !secretAccessKey || !region) {
        throw new Error('Integration not configured properly');
      }

      const bedrockClient = createAmazonBedrock({
        region,
        accessKeyId,
        secretAccessKey,
      });

      this.model = bedrockClient(model);
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
    const { customModel } = args;

    if (!this.model || customModel) {
      const config = this.config;

      const model = customModel || config?.models[0];

      if (!model) {
        throw new Error('Integration not configured properly');
      }

      const apiKey = config.apiKey;

      if (!apiKey) {
        throw new Error('Integration not configured properly');
      }

      const customBedrock = createAmazonBedrock({
        region: config.region,
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
        sessionToken: config.sessionToken,
      });

      this.model = customBedrock(model) as LanguageModel;
    }

    const response = await generateText({
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

    const accessKeyId = this.config.accessKeyId;
    const secretAccessKey = this.config.secretAccessKey;
    const region = this.config.region;

    if (!accessKeyId || !secretAccessKey || !region) {
      throw new Error('Integration not configured properly');
    }

    const bedrockClient = createAmazonBedrock({
      region,
      accessKeyId,
      secretAccessKey,
      sessionToken: this.config.sessionToken,
    });

    return bedrockClient(model);
  }
}
