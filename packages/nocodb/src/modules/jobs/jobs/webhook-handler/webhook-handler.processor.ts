import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { invokeWebhook } from '~/helpers/webhookHelpers';
import { Hook, Model, View } from '~/models';
import {
  type HandleWebhookJobData,
  JOBS_QUEUE,
  JobTypes,
} from '~/interface/Jobs';

@Processor(JOBS_QUEUE)
export class WebhookHandlerProcessor {
  private logger = new Logger(WebhookHandlerProcessor.name);

  constructor() {}

  @Process(JobTypes.HandleWebhook)
  async job(job: Job<HandleWebhookJobData>) {
    const { context, hookId, modelId, viewId, prevData, newData, user } =
      job.data;

    const hook = await Hook.get(context, hookId);
    if (!hook) {
      this.logger.error(`Hook not found for id: ${hookId}`);
      return;
    }

    const model = await Model.get(context, modelId);
    if (!model) {
      this.logger.error(`Model not found for id: ${modelId}`);
      return;
    }

    const view = viewId ? await View.get(context, viewId) : null;

    await invokeWebhook(context, {
      hook,
      model,
      view,
      prevData,
      newData,
      user,
    });
  }
}
