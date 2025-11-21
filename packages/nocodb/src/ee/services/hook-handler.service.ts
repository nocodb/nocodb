import { Inject, Injectable, Logger } from '@nestjs/common';
import { HookHandlerService as HookHandlerServiceCE } from 'src/services/hook-handler.service';
import { type HookType, WebhookEvents } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import { JobTypes } from '~/interface/Jobs';
import { Hook, Model } from '~/models';
import Workflow from '~/ee/models/Workflow';
import { getAffectedColumns } from '~/helpers/webhookHelpers';
import { IEventEmitter } from '~/modules/event-emitter/event-emitter.interface';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
import { MailService } from '~/services/mail/mail.service';

export { HANDLE_WEBHOOK } from 'src/services/hook-handler.service';

@Injectable()
export class HookHandlerService extends HookHandlerServiceCE {
  protected logger = new Logger(HookHandlerService.name);

  constructor(
    @Inject('IEventEmitter') protected readonly eventEmitter: IEventEmitter,
    @Inject('JobsService') protected readonly jobsService: IJobsService,
    protected readonly mailService: MailService,
  ) {
    super(eventEmitter, jobsService, mailService);
  }

  override async handleViewHooks(
    context: NcContext,
    param: { hookName; prevData; newData; user; modelId },
  ) {
    const { hookName, prevData, newData, user, modelId } = param;
    const [event, operation] = hookName.split('.');

    const hooks = await Hook.list(context, {
      fk_model_id: modelId,
      event: event as HookType['event'],
      operation: operation as HookType['operation'][0],
    });
    for (const hook of hooks) {
      if (hook.active) {
        try {
          await this.jobsService.add(JobTypes.HandleWebhook, {
            context,
            hookId: hook.id,
            modelId,
            prevData,
            newData,
            user,
            hookName,
            ncSiteUrl: context.nc_site_url,
          });
        } catch (e) {
          this.logger.error({
            error: e,
            details: 'Error while invoking webhook',
            hook: hook.id,
          });
        }
      }
    }
  }
  override async handleHooks(
    context: NcContext,
    param: { hookName; prevData; newData; user; viewId; modelId },
  ): Promise<void> {
    const { hookName } = param;
    const [event] = hookName.split('.');

    if (event === WebhookEvents.VIEW) {
      return this.handleViewHooks(context, param);
    }

    // Call parent to handle webhooks
    await super.handleHooks(context, param);

    // Trigger workflows for record events
    await this.triggerWorkflows(context, param);
  }

  /**
   * Trigger workflows based on record events
   */
  private async triggerWorkflows(
    context: NcContext,
    param: { hookName; prevData; newData; user; modelId },
  ): Promise<void> {
    const { hookName, modelId, newData, prevData, user } = param;

    try {
      let triggerType: string | null = null;
      let triggerInputs: any = {};

      if (hookName === 'after.insert') {
        triggerType = 'nocodb.trigger.after_insert';
        triggerInputs = {
          newData,
          user,
          timestamp: new Date().toISOString(),
        };
      } else if (hookName === 'after.update') {
        triggerType = 'nocodb.trigger.after_update';

        // Get affected columns for update triggers
        const model = await Model.get(context, modelId);
        const affectedColumns = await getAffectedColumns(context, {
          hookName,
          prevData,
          newData,
          model,
        });

        triggerInputs = {
          prevData,
          newData,
          user,
          timestamp: new Date().toISOString(),
          affectedColumns,
        };
      }

      // If we have a trigger type, find and execute matching workflows
      // TODO: use DependencyTracker in future
      if (triggerType) {
        const workflows = await Workflow.findByTrigger(
          context,
          triggerType,
          modelId,
        );

        this.logger.log(
          `Found ${workflows.length} workflows for trigger ${triggerType} on model ${modelId}`,
        );

        for (const workflow of workflows) {
          try {
            // Queue workflow execution job
            await this.jobsService.add(JobTypes.ExecuteWorkflow, {
              context,
              workflowId: workflow.id,
              triggerInputs,
              user,
            });

            this.logger.log(
              `Queued workflow ${workflow.id} (${workflow.title}) for execution`,
            );
          } catch (e) {
            this.logger.error({
              error: e,
              details: 'Error while queuing workflow execution',
              workflowId: workflow.id,
            });
          }
        }
      }
    } catch (error) {
      this.logger.error({
        error,
        details: 'Error in triggerWorkflows',
        hookName,
        modelId,
      });
    }
  }
}
