import { WebhookHandlerProcessor as WebhookHandlerProcessorCE } from 'src/modules/jobs/jobs/webhook-handler/webhook-handler.processor';
import { PlanLimitTypes } from 'nocodb-sdk';
import type { Job } from 'bull';
import { UsageStat, Workspace } from '~/models';
import { type HandleWebhookJobData } from '~/interface/Jobs';

export class WebhookHandlerProcessor extends WebhookHandlerProcessorCE {
  async job(job: Job<HandleWebhookJobData>) {
    const { context } = job.data;

    await super.job(job);

    const workspace = await Workspace.get(context.workspace_id);

    await UsageStat.incrby(
      context.workspace_id,
      PlanLimitTypes.LIMIT_AUTOMATION_RUN,
      1,
      workspace?.payment?.subscription?.billing_cycle_anchor ||
        workspace?.created_at,
    );
  }
}
