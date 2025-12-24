import { IntegrationWrapper } from '../integration';
import type { ModelMessage } from 'ai';
import type { LanguageModelV3 as LanguageModel } from '@ai-sdk/provider';

export abstract class AiIntegration<T extends { models: string[] } = any> extends IntegrationWrapper<T> {
  abstract generateObject<T>(
    args: AiGenerateObjectArgs,
  ): Promise<AiGenerateObjectResponse<T>>;
  abstract getModelAlias(model: string): string;

  public availableModels(): { value: string; label: string }[] {
    return (this.config.models || []).map((model: string) => ({
      value: model,
      label: this.getModelAlias(model),
    }));
  }

  abstract generateText(args: AiGenerateTextArgs): Promise<AiGenerateTextResponse>;

  abstract getModel(args?: AiGetModelArgs): LanguageModel
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