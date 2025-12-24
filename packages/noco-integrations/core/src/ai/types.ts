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
  abstract getModelAlias(model: string): string;
  abstract getModelCapabilities(model: string): ModelCapability[];

  public availableModels(): ModelInfo[] {
    return (this.config.models || []).map((model: string) => ({
      value: model,
      label: this.getModelAlias(model),
      capabilities: this.getModelCapabilities(model),
    }));
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