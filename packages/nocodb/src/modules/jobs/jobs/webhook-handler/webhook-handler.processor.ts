import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import type { HandleWebhookJobData } from '~/interface/Jobs';
import { Hook, Model, View } from '~/models';
import { invokeWebhook } from '~/helpers/webhookHelpers';

export class WebhookHandlerProcessor {
  protected logger = new Logger(WebhookHandlerProcessor.name);

  async job(job: Job<HandleWebhookJobData>) {
    const {
      context,
      hookId,
      modelId,
      viewId,
      prevData,
      newData,
      user,
      scheduledExecution,
    } = job.data;

    const hook = await Hook.get(context, hookId);
    if (!hook) {
      this.logger.error(`Hook not found: ${hookId}`);
      return;
    }

    const model = await Model.get(context, modelId);
    if (!model) {
      this.logger.error(`Model not found: ${modelId}`);
      return;
    }

    let view;
    if (viewId) {
      view = await View.get(context, viewId);
    }

    await invokeWebhook(context, {
      hook,
      model,
      view,
      prevData,
      newData,
      user,
      scheduledExecution,
    });
  }
}
