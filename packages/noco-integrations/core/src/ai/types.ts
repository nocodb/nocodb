import { IntegrationWrapper } from '../integration';
import type { CoreMessage } from 'ai';

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
}

export interface AiUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  model: string;
}

export interface AiGenerateObjectArgs {
  messages: CoreMessage[];
  schema: any;
  customModel?: string;
}

interface AiGenerateObjectResponse<T> {
  usage: AiUsage;
  data: T;
}
