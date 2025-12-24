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

  public getModelAlias(model: string): string {
    const aliases: Record<string, string> = {
      // Claude 4.5 series
      'anthropic.claude-opus-4-5-20251101-v1:0': 'Claude Opus 4.5',
      'anthropic.claude-sonnet-4-5-20250929-v1:0': 'Claude Sonnet 4.5',
      'anthropic.claude-haiku-4-5-20251001-v1:0': 'Claude Haiku 4.5',
      // Claude 4.x series
      'anthropic.claude-opus-4-1-20250805-v1:0': 'Claude Opus 4.1',
      'anthropic.claude-sonnet-4-20250514-v1:0': 'Claude Sonnet 4',
      // Amazon Nova series
      'amazon.nova-2-lite-v1:0': 'Nova 2 Lite',
      'amazon.nova-premier-v1:0': 'Nova Premier',
      'amazon.nova-pro-v1:0': 'Nova Pro',
      'amazon.nova-lite-v1:0': 'Nova Lite',
      'amazon.nova-micro-v1:0': 'Nova Micro',
      // Meta Llama series
      'meta.llama4-maverick-17b-instruct-v1:0': 'Llama 4 Maverick',
      'meta.llama4-scout-17b-instruct-v1:0': 'Llama 4 Scout',
      'meta.llama3-3-70b-instruct-v1:0': 'Llama 3.3 70B',
      // DeepSeek
      'deepseek.r1-v1:0': 'DeepSeek R1',
      'deepseek.v3-v1:0': 'DeepSeek V3.1',
      // Mistral
      'mistral.mistral-large-3-675b-instruct': 'Mistral Large 3',
    };

    return aliases[model] || model;
  }

  public getModelCapabilities(model: string): ModelCapability[] {
    const capabilities: Record<string, ModelCapability[]> = {
      // Claude models - all support vision
      'anthropic.claude-opus-4-5-20251101-v1:0': ['text', 'vision', 'tools'],
      'anthropic.claude-sonnet-4-5-20250929-v1:0': ['text', 'vision', 'tools'],
      'anthropic.claude-haiku-4-5-20251001-v1:0': ['text', 'vision', 'tools'],
      'anthropic.claude-opus-4-1-20250805-v1:0': ['text', 'vision', 'tools'],
      'anthropic.claude-sonnet-4-20250514-v1:0': ['text', 'vision', 'tools'],
      // Nova 2 Lite and Premier support vision
      'amazon.nova-2-lite-v1:0': ['text', 'vision', 'tools'],
      'amazon.nova-premier-v1:0': ['text', 'vision', 'tools'],
      'amazon.nova-pro-v1:0': ['text', 'vision', 'tools'],
      'amazon.nova-lite-v1:0': ['text', 'vision', 'tools'],
      // Llama 4 models support vision
      'meta.llama4-maverick-17b-instruct-v1:0': ['text', 'vision', 'tools'],
      'meta.llama4-scout-17b-instruct-v1:0': ['text', 'vision', 'tools'],
      // Mistral Large 3 supports vision
      'mistral.mistral-large-3-675b-instruct': ['text', 'vision', 'tools'],
    };
    return capabilities[model] || ['text', 'tools'];
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

  public availableModels() {
    return this.config.models.map((model: string) => ({
      value: model,
      label: this.getModelAlias(model),
      capabilities: this.getModelCapabilities(model),
    }));
  }
}
