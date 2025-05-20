import { generateObject, type LanguageModel } from 'ai';
import { createAzure } from '@ai-sdk/azure';
import {
  type AiGenerateObjectArgs,
  AiIntegration,
} from '@noco-integrations/core';

export class AzureAiIntegration extends AiIntegration {
  private model: LanguageModel | null = null;

  public async generateObject<T = any>(args: AiGenerateObjectArgs) {
    const { messages, schema } = args;

    if (!this.model || args.customModel) {
      const model = args.customModel || this.config.models[0];

      if (!model) {
        throw new Error('Integration not configured properly');
      }

      const resourceName = this.config.resourceName;
      const apiKey = this.config.apiKey;
      const apiVersion = this.config.apiVersion;

      if (!resourceName || !apiKey || !apiVersion) {
        throw new Error('Integration not configured properly');
      }

      const azureClient = createAzure({
        resourceName,
        apiKey,
        apiVersion,
      });

      this.model = azureClient(model);
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
      'gpt-4o': 'GPT-4o',
      'gpt-4.1': 'GPT-4.1',
      o3: 'o3',
      'o4-mini': 'o4-mini',
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
