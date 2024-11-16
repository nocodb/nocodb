import type { CoreMessage, LanguageModel } from 'ai';
import type { Schema } from 'zod';
import IntegrationWrapper from '~/integrations/integration.wrapper';

export default abstract class AiIntegration extends IntegrationWrapper {
  protected abstract model: LanguageModel;

  public abstract generateObject<T>(args: {
    messages: CoreMessage[];
    schema: Schema;
    customModel?: string;
  }): Promise<{
    usage: {
      input_tokens: number;
      output_tokens: number;
      total_tokens: number;
      model: string;
    };
    data: T;
  }>;

  public abstract availableModels(): string[];
}
