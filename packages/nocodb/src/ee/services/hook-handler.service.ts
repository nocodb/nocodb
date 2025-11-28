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
import { DataV3Service } from '~/services/v3/data-v3.service';

export { HANDLE_WEBHOOK } from 'src/services/hook-handler.service';

@Injectable()
export class HookHandlerService extends HookHandlerServiceCE {
  protected logger = new Logger(HookHandlerService.name);

  constructor(
    @Inject('IEventEmitter') protected readonly eventEmitter: IEventEmitter,
    @Inject('JobsService') protected readonly jobsService: IJobsService,
    protected readonly mailService: MailService,
    private readonly datasV3Service: DataV3Service,
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

      if (hookName === 'after.insert' || hookName === 'after.bulkInsert') {
        triggerType = 'nocodb.trigger.after_insert';
      } else if (
        hookName === 'after.update' ||
        hookName === 'after.bulkUpdate'
      ) {
        triggerType = 'nocodb.trigger.after_update';
      } else if (
        hookName === 'after.delete' ||
        hookName === 'after.bulkDelete'
      ) {
        triggerType = 'nocodb.trigger.after_delete';
      }

      if (!triggerType) {
        return;
      }

      const model = await Model.get(context, modelId);
      await model.getColumns(context);

      const newDataArray = Array.isArray(newData) ? newData : [newData];
      const prevDataArray = Array.isArray(prevData)
        ? prevData
        : prevData
        ? [prevData]
        : [];

      const workflows = await Workflow.findByTrigger(
        context,
        triggerType,
        modelId,
      );

      if (workflows.length === 0) {
        return;
      }

      for (let i = 0; i < newDataArray.length; i++) {
        const currentNewData = newDataArray[i];
        const currentPrevData = prevDataArray[i];

        let triggerInputs: any = {};

        if (hookName === 'after.insert' || hookName === 'after.bulkInsert') {
          const transformedData =
            await this.datasV3Service.transformRecordsToV3Format({
              context,
              records: [currentNewData],
              primaryKey: model.primaryKey,
              primaryKeys: model.primaryKeys,
              columns: model.columns,
              reuse: {},
              depth: 0,
            });

          triggerInputs = {
            newData: transformedData[0],
            user,
            timestamp: new Date().toISOString(),
          };
        } else if (
          hookName === 'after.update' ||
          hookName === 'after.bulkUpdate'
        ) {
          const affectedColumns = await getAffectedColumns(context, {
            hookName,
            prevData: currentPrevData,
            newData: currentNewData,
            model,
          });

          const transformedNewData =
            await this.datasV3Service.transformRecordsToV3Format({
              context,
              records: [currentNewData],
              primaryKey: model.primaryKey,
              primaryKeys: model.primaryKeys,
              columns: model.columns,
              reuse: {},
              depth: 0,
            });

          const transformedPrevData =
            await this.datasV3Service.transformRecordsToV3Format({
              context,
              records: [currentPrevData],
              primaryKey: model.primaryKey,
              primaryKeys: model.primaryKeys,
              columns: model.columns,
              reuse: {},
              depth: 0,
            });

          triggerInputs = {
            prevData: transformedPrevData[0],
            newData: transformedNewData[0],
            user,
            timestamp: new Date().toISOString(),
            affectedColumns,
          };
        } else if (
          hookName === 'after.delete' ||
          hookName === 'after.bulkDelete'
        ) {
          const transformedData =
            await this.datasV3Service.transformRecordsToV3Format({
              context,
              records: [currentNewData],
              primaryKey: model.primaryKey,
              primaryKeys: model.primaryKeys,
              columns: model.columns,
              reuse: {},
              depth: 0,
            });

          triggerInputs = {
            record: transformedData[0],
            user,
            timestamp: new Date().toISOString(),
          };
        }
        for (const workflow of workflows) {
          try {
            await this.jobsService.add(JobTypes.ExecuteWorkflow, {
              context,
              workflowId: workflow.id,
              triggerInputs,
              user,
            });
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
