import { WebhookHandlerProcessor as WebhookHandlerProcessorCE } from 'src/modules/jobs/jobs/webhook-handler/webhook-handler.processor';
import { PlanLimitTypes } from 'nocodb-sdk';
import type { Job } from 'bull';
import { UsageStat, Workspace } from '~/models';
import { type HandleWebhookJobData } from '~/interface/Jobs';
import { checkLimit } from '~/helpers/paymentHelpers';

export class WebhookHandlerProcessor extends WebhookHandlerProcessorCE {
  async job(job: Job<HandleWebhookJobData>) {
    const { context } = job.data;

    const workspace = await Workspace.get(context.workspace_id);

    await checkLimit({
      workspace,
      type: PlanLimitTypes.LIMIT_AUTOMATION_RUN,
      message: ({ limit }) =>
        `You have reached the limit of ${limit} automations for your plan.`,
    });

    await super.job(job);

    await UsageStat.incrby(
      context.workspace_id,
      PlanLimitTypes.LIMIT_AUTOMATION_RUN,
      1,
      workspace?.payment?.subscription?.billing_cycle_anchor ||
        workspace?.created_at,
    );
  }
}
