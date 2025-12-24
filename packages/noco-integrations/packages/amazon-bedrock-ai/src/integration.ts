import { generateObject, generateText } from 'ai';
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import {
  type AiGenerateObjectArgs,
  type AiGenerateTextArgs,
  type AiGetModelArgs,
  AiIntegration,
} from '@noco-integrations/core';
import type { LanguageModelV3 as LanguageModel } from '@ai-sdk/provider';

export class AmazonBedrockAiIntegration extends AiIntegration {
  private model: LanguageModel | null = null;

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

  public getModelAlias(model: string): string {
    const aliases: Record<string, string> = {
      'anthropic.claude-3-sonnet-20240229-v1:0': 'Claude 3 Sonnet',
      'anthropic.claude-3-haiku-20240307-v1:0': 'Claude 3 Haiku',
      'anthropic.claude-3-opus-20240229-v1:0': 'Claude 3 Opus',
      'meta.llama3-70b-instruct-v1:0': 'Llama 3 70B',
      'meta.llama3-8b-instruct-v1:0': 'Llama 3 8B',
      'mistral.mistral-7b-instruct-v0:2': 'Mistral 7B',
      'mistral.mixtral-8x7b-instruct-v0:1': 'Mixtral 8x7B',
      'amazon.titan-text-express-v1': 'Amazon Titan Text Express',
      'amazon.nova-micro-v1:0': 'Amazon Nova Micro',
      'amazon.nova-lite-v1:0': 'Amazon Nova Lite',
      'amazon.nova-pro-v1:0': 'Amazon Nova Pro',
    };

    return aliases[model] || model;
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

  public availableModels(): { value: string; label: string }[] {
    return this.config.models.map((model: string) => ({
      value: model,
      label: this.getModelAlias(model),
    }));
  }
}
