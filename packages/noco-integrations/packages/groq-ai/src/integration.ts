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

  public getModelAlias(model: string): string {
    const aliases: Record<string, string> = {
      // Llama 4 series
      'meta-llama/llama-4-maverick-17b-128e-instruct': 'Llama 4 Maverick 17B',
      'meta-llama/llama-4-scout-17b-16e-instruct': 'Llama 4 Scout 17B',
      // Llama 3.x series
      'llama-3.3-70b-versatile': 'Llama 3.3 70B Versatile',
      'llama-3.1-8b-instant': 'Llama 3.1 8B Instant',
      // Groq models
      'groq/compound': 'Groq Compound',
      'groq/compound-mini': 'Groq Compound Mini',
      // OpenAI OSS models
      'openai/gpt-oss-120b': 'GPT OSS 120B',
      'openai/gpt-oss-20b': 'GPT OSS 20B',
      // Moonshot AI
      'moonshotai/kimi-k2-instruct': 'Kimi K2',
      // Qwen
      'qwen/qwen3-32b': 'Qwen3 32B',
    };
    return aliases[model] || model;
  }

  public getModelCapabilities(_model: string): ModelCapability[] {
    return ['text', 'tools'];
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

  public availableModels() {
    return this.config.models.map((model: string) => ({
      value: model,
      label: this.getModelAlias(model),
      capabilities: this.getModelCapabilities(model),
    }));
  }
}
