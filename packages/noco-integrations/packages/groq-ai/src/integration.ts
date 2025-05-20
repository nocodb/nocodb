import { generateObject, type LanguageModel } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import {
  type AiGenerateObjectArgs,
  AiIntegration,
} from '@noco-integrations/core';

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

    const response = await generateObject({
      model: this.model as LanguageModel,
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
      'llama-4-maverick': 'Llama-4 Maverick',
      'llama-4-scout': 'Llama-4 Scout',
      'deepseek-r1-distill-llama-70b': 'DeepSeek R1 Distill Llama 70B',
    };
    return aliases[model] || model;
  }

  public availableModels(): { value: string; label: string }[] {
    return this.config.models.map((model: string) => ({
      value: model,
      label: this.getModelAlias(model),
    }));
  }
}
