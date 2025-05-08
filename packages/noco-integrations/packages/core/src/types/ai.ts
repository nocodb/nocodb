import { CoreMessage } from 'ai';
import { Schema } from 'zod';
import { IntegrationWrapper } from '../integration';

export abstract class AiIntegration extends IntegrationWrapper {
  abstract generateObject<T>(
    args: AiGenerateObjectArgs,
  ): Promise<AiGenerateObjectResponse<T>>;
  abstract getModelAlias(model: string): string;

  public availableModels(): { value: string; label: string }[] {
    return (this.getConfig()?.models || []).map((model: string) => ({
      value: model,
      label: this.getModelAlias(model),
    }));
  }
}

export interface AiUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  model: string;
}

export interface AiGenerateObjectArgs {
  messages: CoreMessage[];
  schema: Schema;
  customModel?: string;
}

export interface AiGenerateObjectResponse<T> {
  usage: AiUsage;
  data: T;
}
