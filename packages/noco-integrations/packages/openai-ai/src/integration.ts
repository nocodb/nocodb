import { generateImage, generateText, Output } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import {
  type AiGenerateImageArgs,
  type AiGenerateImageResponse,
  type AiGenerateObjectArgs,
  type AiGetModelArgs,
  AiIntegration,
  type ModelCapability,
} from '@noco-integrations/core';
import type { AiGenerateTextArgs } from '@noco-integrations/core';
import type { LanguageModelV3 as LanguageModel } from '@ai-sdk/provider';

export class OpenAIIntegration extends AiIntegration {
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

      const customOpenAi = createOpenAI({
        apiKey: apiKey,
      });

      this.model = customOpenAi(model);
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

      const model = customModel || config?.models?.[0];

      if (!model) {
        throw new Error('Integration not configured properly');
      }

      const apiKey = config.apiKey;

      if (!apiKey) {
        throw new Error('Integration not configured properly');
      }

      const customOpenAi = createOpenAI({
        apiKey: apiKey,
      });

      this.model = customOpenAi(model);
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
      'gpt-4o': 'GPT-4o',
      'gpt-4o-mini': 'GPT-4o Mini',
      'gpt-4.1': 'GPT-4.1',
      'gpt-4.1-mini': 'GPT-4.1 Mini',
      'gpt-4.1-nano': 'GPT-4.1 Nano',
      o3: 'o3',
      'o3-mini': 'o3 Mini',
      'o4-mini': 'o4-mini',
      'dall-e-2': 'DALL-E 2',
      'dall-e-3': 'DALL-E 3',
      'gpt-image-1.5': 'GPT Image 1.5',
      'gpt-image-1': 'GPT Image 1',
      'gpt-image-1-mini': 'GPT Image 1 Mini',
    };
    return aliases[model] || model;
  }

  public getModelCapabilities(model: string): ModelCapability[] {
    const capabilities: Record<string, ModelCapability[]> = {
      'gpt-4o': ['text', 'vision', 'tools'],
      'gpt-4o-mini': ['text', 'vision', 'tools'],
      'gpt-4.1': ['text', 'vision', 'tools'],
      'gpt-4.1-mini': ['text', 'vision', 'tools'],
      'gpt-4.1-nano': ['text', 'tools'],
      o3: ['text', 'tools'],
      'o3-mini': ['text', 'tools'],
      'o4-mini': ['text', 'tools'],
      'dall-e-2': ['image-generation'],
      'dall-e-3': ['image-generation'],
      'gpt-image-1.5': ['image-generation'],
      'gpt-image-1': ['image-generation'],
      'gpt-image-1-mini': ['image-generation'],
    };
    return capabilities[model] || ['text'];
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

    const openAI = createOpenAI({
      apiKey,
    });

    return openAI(model);
  }

  public async generateImage(
    args: AiGenerateImageArgs,
  ): Promise<AiGenerateImageResponse> {
    const { prompt, customModel, size = '1024x1024', n = 1 } = args;

    const modelName =
      customModel ||
      this.config.models.find(
        (m: string) => m.includes('dall-e') || m.includes('gpt-image'),
      ) ||
      'dall-e-3';

    const apiKey = this.config.apiKey;

    if (!apiKey) {
      throw new Error('Integration not configured properly');
    }

    const openai = createOpenAI({ apiKey });

    const response = await generateImage({
      model: openai.image(modelName),
      prompt,
      size: size as `${number}x${number}`,
      n,
    });

    return {
      image: response.image,
      images: response.images,
    };
  }

  public availableModels() {
    return this.config.models.map((model: string) => ({
      value: model,
      label: this.getModelAlias(model),
      capabilities: this.getModelCapabilities(model),
    }));
  }
}
