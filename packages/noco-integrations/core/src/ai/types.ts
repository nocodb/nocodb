import { IntegrationWrapper } from '../integration';
import type { ModelMessage } from 'ai';
import type { LanguageModelV3 as LanguageModel } from '@ai-sdk/provider';

export type ModelCapability = 'text' | 'vision' | 'tools' | 'image-generation';

export interface ModelInfo {
  value: string;
  label: string;
  capabilities: ModelCapability[];
}

export abstract class AiIntegration<T extends { models: string[] } = any> extends IntegrationWrapper<T> {
  abstract generateObject<T>(
    args: AiGenerateObjectArgs,
  ): Promise<AiGenerateObjectResponse<T>>;

  /**
   * List of models supported by this AI provider with their capabilities
   * Override this in each integration to define supported models
   */
  protected abstract supportedModels: ModelInfo[];

  /**
   * Get available models based on user configuration
   * @param capability - Optional capability filter (e.g., 'text', 'vision', 'tools')
   * @returns List of models that match the criteria
   *
   * Note: Custom models (not in supportedModels) are always included,
   * assuming they support all capabilities
   */
  public async availableModels(capability?: ModelCapability): Promise<ModelInfo[]> {
    const results: ModelInfo[] = [];

    for (const modelId of this.config.models || []) {
      // Find model in supportedModels list
      const supportedModel = this.supportedModels.find(m => m.value === modelId);

      if (supportedModel) {
        // Known model - check capabilities if specified
        if (!capability || supportedModel.capabilities.includes(capability)) {
          results.push(supportedModel);
        }
      } else {
        // Custom/unknown model - assume it supports everything
        results.push({
          value: modelId,
          label: modelId, // Use the ID as label
          capabilities: ['text', 'vision', 'tools', 'image-generation'],
        });
      }
    }

    return results;
  }

  public async fetchOptions(payload: { key: string }): Promise<unknown> {
    const { key } = payload;
    if (key === 'models') {
      return this.supportedModels;
    }
    return [];
  }

  abstract generateText(args: AiGenerateTextArgs): Promise<AiGenerateTextResponse>;

  abstract getModel(args?: AiGetModelArgs): LanguageModel;

  // Optional: Only implement for providers that support image generation
  generateImage?(args: AiGenerateImageArgs): Promise<AiGenerateImageResponse>;
}

export interface AiUsage {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  model: string;
}

export interface AiGenerateObjectArgs {
  messages: ModelMessage[];
  schema: any;
  customModel?: string;
}

interface AiGenerateObjectResponse<T> {
  usage: AiUsage;
  data: T;
}

export type AiGenerateTextArgs =  {
  system: string
  customModel?: string;
} & ({ prompt: string } | { messages: ModelMessage[] })

interface AiGenerateTextResponse {
  usage: AiUsage;
  data: string;
}

export interface AiGetModelArgs {
  customModel: string;
}

export interface AiGenerateImageArgs {
  prompt: string;
  customModel?: string;
  size?: string; // e.g. '1024x1024'
  n?: number;
}

export interface AiGenerateImageResponse {
  image: {
    base64: string;
    uint8Array: Uint8Array;
  };
  images: Array<{
    base64: string;
    uint8Array: Uint8Array;
  }>;
}