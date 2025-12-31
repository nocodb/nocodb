import { generateText, Output } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import {
  type AiGenerateObjectArgs,
  type AiGetModelArgs,
  AiIntegration,
  type ModelCapability,
} from '@noco-integrations/core';
import type { AiGenerateTextArgs } from '@noco-integrations/core';
import type { LanguageModelV3 as LanguageModel } from '@ai-sdk/provider';

export class GroqAiIntegration extends AiIntegration {
  private model: LanguageModel | null = null;

  protected supportedModels = [
    // Llama 4 series
    {
      value: 'meta-llama/llama-4-maverick-17b-128e-instruct',
      label: 'Llama 4 Maverick 17B',
      capabilities: ['text', 'tools'] as ModelCapability[],
    },
    {
      value: 'meta-llama/llama-4-scout-17b-16e-instruct',
      label: 'Llama 4 Scout 17B',
      capabilities: ['text', 'tools'] as ModelCapability[],
    },
    // Llama 3.x series
    {
      value: 'llama-3.3-70b-versatile',
      label: 'Llama 3.3 70B Versatile',
      capabilities: ['text', 'tools'] as ModelCapability[],
    },
    {
      value: 'llama-3.1-8b-instant',
      label: 'Llama 3.1 8B Instant',
      capabilities: ['text', 'tools'] as ModelCapability[],
    },
    // Groq models
    {
      value: 'groq/compound',
      label: 'Groq Compound',
      capabilities: ['text', 'tools'] as ModelCapability[],
    },
    {
      value: 'groq/compound-mini',
      label: 'Groq Compound Mini',
      capabilities: ['text', 'tools'] as ModelCapability[],
    },
    // OpenAI OSS models
    {
      value: 'openai/gpt-oss-120b',
      label: 'GPT OSS 120B',
      capabilities: ['text', 'tools'] as ModelCapability[],
    },
    {
      value: 'openai/gpt-oss-20b',
      label: 'GPT OSS 20B',
      capabilities: ['text', 'tools'] as ModelCapability[],
    },
    // Moonshot AI
    {
      value: 'moonshotai/kimi-k2-instruct',
      label: 'Kimi K2',
      capabilities: ['text', 'tools'] as ModelCapability[],
    },
    // Qwen
    {
      value: 'qwen/qwen3-32b',
      label: 'Qwen3 32B',
      capabilities: ['text', 'tools'] as ModelCapability[],
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

      const groqClient = createGroq({
        apiKey: apiKey,
      });

      this.model = groqClient(model);
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

    const groqClient = createGroq({
      apiKey,
    });

    return groqClient(model);
  }

  public async generateText(args: AiGenerateTextArgs) {
    const { system } = args;

    if (!this.model || args.customModel) {
      const model = args.customModel || this.config.models[0];

      if (!model) {
        throw new Error('Integration not configured properly');
      }

      const apiKey = this.config.apiKey;

      if (!apiKey) {
        throw new Error('Integration not configured properly');
      }

      const groqClient = createGroq({
        apiKey: apiKey,
      });

      this.model = groqClient(model);
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
}
