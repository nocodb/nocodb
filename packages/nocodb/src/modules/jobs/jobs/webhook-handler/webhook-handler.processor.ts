import { Inject, Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { invokeWebhook } from '~/helpers/webhookHelpers';
import { Hook, Model, View } from '~/models';
import { type HandleWebhookJobData } from '~/interface/Jobs';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';

export class WebhookHandlerProcessor {
  protected logger = new Logger(WebhookHandlerProcessor.name);

  constructor(
    @Inject('JobsService') private readonly jobsService: IJobsService,
  ) {}

  async job(job: Job<HandleWebhookJobData>) {
    const {
      context,
      hookId,
      modelId,
      viewId,
      prevData,
      newData,
      user,
      hookName,
      ncSiteUrl,
    } = job.data;

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
      hookName,
      ncSiteUrl,
      addJob: this.jobsService.add.bind(this.jobsService),
    });
  }
}
