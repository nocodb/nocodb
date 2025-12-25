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

  protected supportedModels = [
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
      value: 'o3',
      label: 'o3',
      capabilities: ['text', 'tools'] as ModelCapability[],
    },
    {
      value: 'o3-mini',
      label: 'o3 Mini',
      capabilities: ['text', 'tools'] as ModelCapability[],
    },
    {
      value: 'o4-mini',
      label: 'o4-mini',
      capabilities: ['text', 'tools'] as ModelCapability[],
    },
    // DALL-E
    {
      value: 'dall-e-2',
      label: 'DALL-E 2',
      capabilities: ['image-generation'] as ModelCapability[],
    },
    {
      value: 'dall-e-3',
      label: 'DALL-E 3',
      capabilities: ['image-generation'] as ModelCapability[],
    },
    // GPT Image
    {
      value: 'gpt-image-1.5',
      label: 'GPT Image 1.5',
      capabilities: ['image-generation'] as ModelCapability[],
    },
    {
      value: 'gpt-image-1',
      label: 'GPT Image 1',
      capabilities: ['image-generation'] as ModelCapability[],
    },
    {
      value: 'gpt-image-1-mini',
      label: 'GPT Image 1 Mini',
      capabilities: ['image-generation'] as ModelCapability[],
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
}
