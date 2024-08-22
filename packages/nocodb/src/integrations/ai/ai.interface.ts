import { type CoreMessage } from 'ai';
import type { Schema } from 'zod';
import IntegrationWrapper from '~/integrations/integration.wrapper';

export default abstract class AiIntegration extends IntegrationWrapper {
  public abstract generateObject<T>(args: {
    messages: CoreMessage[];
    schema: Schema;
  }): Promise<{
    usage: {
      input: number;
      output: number;
      total: number;
    };
    data: T;
  }>;
}
