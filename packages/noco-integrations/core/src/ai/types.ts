import { IntegrationWrapper } from '../integration';
import type { CoreMessage, Tool, StepResult } from 'ai';

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

  public abstract generateText(args: AiGenerateTextArgs): Promise<AiGenerateTextResponse>;

  abstract getTools(name: string[]): Record<string, Tool>;
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
  tools?: string[];
}

export interface AiGenerateObjectResponse<T> {
  usage: AiUsage;
  data: T;
}

export interface AiGenerateTextArgs {
  prompt?: string;
  messages?: CoreMessage[];
  customModel?: string;
  tools?: string[];
  schema?: any;
}

export interface AiGenerateTextResponse {
  usage: AiUsage;
  data: {
    toolCalls: Array<any>;
    steps: Array<StepResult<any>>;
    text: string;
  };
}