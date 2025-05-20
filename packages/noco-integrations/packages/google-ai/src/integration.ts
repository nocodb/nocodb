import { generateObject, type LanguageModel } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import {
  type AiGenerateObjectArgs,
  AiIntegration,
} from '@noco-integrations/core';

export class GeminiIntegration extends AiIntegration {
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

      const google = createGoogleGenerativeAI({
        apiKey,
      });

      this.model = google(model);
    }

    const response = await generateObject({
      model: this.model,
      schema,
      messages,
      temperature: 0.5,
    });

    return {
      usage: {
        input_tokens: response.usage.promptTokens,
        output_tokens: response.usage.completionTokens,
        total_tokens: response.usage.totalTokens,
        model: this.model.modelId,
      },
      data: response.object as T,
    };
  }

  public getModelAlias(model: string): string {
    const aliases: Record<string, string> = {
      'gemini-2.5-pro-preview-05-06': 'Gemini 2.5 Pro Preview 05-06',
      'gemini-2.5-flash-preview-04-17': 'Gemini 2.5 Flash Preview 04-17',
      'gemini-2.0-flash': 'Gemini 2.0 Flash',
    };
    return aliases[model] || model;
  }
} 