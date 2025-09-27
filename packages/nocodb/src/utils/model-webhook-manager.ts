import { WebhookActions } from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import type { Model } from '~/models';

// this class is reserved for future update
export class ModelWebhookManager {
  constructor(
    protected readonly params: {
      context: NcContext;
      modelId: string;
      model: Model;
    },
  ) {}
}
