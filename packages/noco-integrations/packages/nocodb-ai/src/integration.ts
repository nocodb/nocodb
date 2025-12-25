import { generateText, Output } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { AiIntegration } from '@noco-integrations/core';
import type {
  AiGenerateObjectArgs,
  AiGenerateTextArgs,
  AiGetModelArgs,
  ModelCapability,
} from '@noco-integrations/core';
import type { LanguageModelV3 as LanguageModel } from '@ai-sdk/provider';

const modelMap: Record<string, string> = {
  high: 'gpt-4o',
  medium: 'gpt-4o-mini',
  low: 'gpt-4o-mini',
};

export class NocodbAiIntegration extends AiIntegration {
  private model: LanguageModel | null = null;

  protected supportedModels = [
    {
      value: 'high',
      label: 'High',
      capabilities: ['text', 'vision', 'tools'] as ModelCapability[],
    },
    {
      value: 'medium',
      label: 'Medium',
      capabilities: ['text', 'vision', 'tools'] as ModelCapability[],
    },
    {
      value: 'low',
      label: 'Low',
      capabilities: ['text', 'vision', 'tools'] as ModelCapability[],
    },
  ];

  public async generateObject<T = any>(args: AiGenerateObjectArgs) {
    const { messages, schema } = args;

    if (!this.model || args.customModel) {
      const config = this.config || {};

      const inputModel = args.customModel || config?.models?.[0];

      const model =
        modelMap[inputModel as keyof typeof modelMap] || modelMap.high;

      const apiKey = config.apiKey;

      if (!apiKey) {
        throw new Error('Integration not configured properly');
      }

      const customOpenAi = createOpenAI({
        apiKey: apiKey,
      });

      this.model = customOpenAi(model) as LanguageModel;
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

      const inputModel = args.customModel || config?.models?.[0];

      const model =
        modelMap[inputModel as keyof typeof modelMap] || modelMap.high;

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
      system,
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
    const config = this.config || {};

    const inputModel = customModel || config?.models?.[0];
    const model =
      modelMap[inputModel as keyof typeof modelMap] || modelMap.high;

    const apiKey = config.apiKey;

    if (!apiKey) {
      throw new Error('Integration not configured properly');
    }

    const openAI = createOpenAI({
      apiKey,
    });

    return openAI(model);
  }
}
