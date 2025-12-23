import { Inject, Injectable, Logger } from '@nestjs/common';
import { HookHandlerService as HookHandlerServiceCE } from 'src/services/hook-handler.service';
import {
  type HookType,
  PlanLimitTypes,
  ViewTypes,
  WebhookEvents,
} from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type { WorkflowNodeRunContext } from '@noco-local-integrations/core';
// @ts-ignore importing directly will cause circular dependency error
import { type WorkflowExecutionService } from '~/services/workflow-execution.service';
import { JobTypes } from '~/interface/Jobs';
import { Filter, Hook, Model, Source, View } from '~/models';
import Workflow from '~/ee/models/Workflow';
import {
  getAffectedColumns,
  validateCondition,
} from '~/helpers/webhookHelpers';
import { IEventEmitter } from '~/modules/event-emitter/event-emitter.interface';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
import { MailService } from '~/services/mail/mail.service';
import { DataV3Service } from '~/services/v3/data-v3.service';
import { checkLimit } from '~/helpers/paymentHelpers';

export { HANDLE_WEBHOOK } from 'src/services/hook-handler.service';

@Injectable()
export class HookHandlerService extends HookHandlerServiceCE {
  protected logger = new Logger(HookHandlerService.name);

  constructor(
    @Inject('IEventEmitter') protected readonly eventEmitter: IEventEmitter,
    @Inject('JobsService') protected readonly jobsService: IJobsService,
    protected readonly mailService: MailService,
    private readonly datasV3Service: DataV3Service,
    @Inject('WorkflowExecutionService')
    private readonly workflowExecutionService: WorkflowExecutionService,
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

    await checkLimit({
      workspaceId: context.workspace_id,
      type: PlanLimitTypes.LIMIT_AUTOMATION_RUN,
      message: ({ limit }) =>
        `You have reached the limit of ${limit} automations for your plan.`,
    });

    // Trigger workflows for record events
    await this.triggerWorkflows(context, param);

    // Trigger form submission workflows if this came from a form view
    if (hookName === 'after.insert' && param.viewId) {
      await this.triggerFormSubmissionWorkflows(context, param);
    }

    // Trigger record enters view workflows for insert and update
    // Trigger record matches condition workflows for insert and update
    if (
      hookName === 'after.insert' ||
      hookName === 'after.bulkInsert' ||
      hookName === 'after.update' ||
      hookName === 'after.bulkUpdate'
    ) {
      await this.triggerRecordEntersViewWorkflows(context, param);
      await this.triggerRecordMatchesConditionWorkflows(context, param);
    }
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
            const shouldExecute = await this.shouldExecuteWorkflow(
              context,
              workflow,
              triggerType,
              triggerInputs,
            );

            if (!shouldExecute) {
              continue;
            }

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

  private async shouldExecuteWorkflow(
    context: NcContext,
    workflow: Workflow,
    triggerType: string,
    triggerInputs: any,
  ): Promise<boolean> {
    try {
      const triggerNode = workflow.nodes?.find(
        (node) => node.type === triggerType,
      );

      if (!triggerNode) {
        this.logger.warn({
          message: 'Trigger node not found in workflow',
          workflowId: workflow.id,
          triggerType,
        });
        return true;
      }

      const nodeWrapper = this.workflowExecutionService.getNodeWrapper(
        context,
        triggerNode.type,
        triggerNode.data?.config || {},
      );

      if (!nodeWrapper) {
        this.logger.warn({
          message: 'Could not instantiate trigger node wrapper',
          workflowId: workflow.id,
          triggerType,
        });
        return true;
      }

      const triggerRunContext: WorkflowNodeRunContext = {
        workspaceId: context.workspace_id,
        baseId: context.base_id,
        inputs: triggerInputs,
        testMode: false,
      };

      const result = await nodeWrapper.run(triggerRunContext);

      return result.status !== 'skipped';
    } catch (error) {
      this.logger.error({
        error,
        message: 'Error checking if workflow should execute, queuing anyway',
        workflowId: workflow.id,
        triggerType,
      });
      return true;
    }
  }

  /**
   * Trigger form submission workflows
   */
  private async triggerFormSubmissionWorkflows(
    context: NcContext,
    param: { hookName; prevData; newData; user; viewId; modelId },
  ): Promise<void> {
    const { modelId, newData, user, viewId } = param;

    try {
      const view = await View.get(context, viewId);

      if (!view || view.type !== ViewTypes.FORM) {
        // Not a form view, skip
        return;
      }

      const triggerType = 'nocodb.trigger.form_submitted';
      const newDataArray = Array.isArray(newData) ? newData : [newData];

      const workflows = await Workflow.findByTrigger(
        context,
        triggerType,
        view.id,
      );

      if (workflows.length === 0) {
        return;
      }

      const model = await Model.get(context, modelId);
      await model.getColumns(context);

      for (const currentNewData of newDataArray) {
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

        const triggerInputs = {
          newData: transformedData[0],
          user,
          timestamp: new Date().toISOString(),
          formViewId: viewId,
        };

        for (const workflow of workflows) {
          try {
            const shouldExecute = await this.shouldExecuteWorkflow(
              context,
              workflow,
              triggerType,
              triggerInputs,
            );

            if (!shouldExecute) {
              continue;
            }

            await this.jobsService.add(JobTypes.ExecuteWorkflow, {
              context,
              workflowId: workflow.id,
              triggerInputs,
              user,
            });
          } catch (e) {
            this.logger.error({
              error: e,
              details: 'Error while queuing form submission workflow execution',
              workflowId: workflow.id,
              formViewId: viewId,
            });
          }
        }
      }
    } catch (error) {
      this.logger.error({
        error,
        details: 'Error in triggerFormSubmissionWorkflows',
        viewId,
        modelId,
      });
    }
  }

  /**
   * Compute if a record matches view filters
   * Used by record enters view and record matches condition triggers
   */
  private async computeViewFilterMatch(
    context: NcContext,
    viewId: string,
    newData: any,
    prevData: any,
    source: Source,
  ): Promise<{
    matchesFilter: boolean;
    prevMatchedFilter: boolean;
  }> {
    const view = await View.get(context, viewId);
    if (!view) {
      throw new Error(`View ${viewId} not found`);
    }

    const filters = await Filter.rootFilterList(context, { viewId });

    // If no filters, view shows all records
    if (!filters.length) {
      if (!prevData) {
        // INSERT: Record enters view (didn't exist before, now it's visible)
        this.logger.debug({
          message: 'No filters - INSERT triggers (record enters view)',
          viewId,
        });
        return { matchesFilter: true, prevMatchedFilter: false };
      } else {
        // UPDATE: Record was already in view, still in view (no state change)
        this.logger.debug({
          message: 'No filters - UPDATE skipped (record already in view)',
          viewId,
        });
        return { matchesFilter: true, prevMatchedFilter: true };
      }
    }

    // Check if newData matches the view filters
    const matchesFilter = await validateCondition(context, filters, newData, {
      client: source?.type,
    });

    // Check if prevData matched the view filters (for updates)
    const prevMatchedFilter =
      prevData && filters.length
        ? await validateCondition(context, filters, prevData, {
            client: source?.type,
          })
        : false;

    return { matchesFilter, prevMatchedFilter };
  }

  /**
   * Trigger record enters view workflows
   */
  private async triggerRecordEntersViewWorkflows(
    context: NcContext,
    param: { hookName; prevData; newData; user; viewId; modelId },
  ): Promise<void> {
    const { modelId, newData, prevData, user, hookName } = param;

    try {
      const triggerType = 'nocodb.trigger.record_enters_view';

      // Find all workflows with this trigger type for this table
      const workflows = await Workflow.findByTrigger(
        context,
        triggerType,
        modelId,
      );

      if (workflows.length === 0) {
        return;
      }

      const model = await Model.get(context, modelId);
      await model.getColumns(context);

      const source = await Source.get(context, model.source_id);

      const newDataArray = Array.isArray(newData) ? newData : [newData];
      const prevDataArray = Array.isArray(prevData)
        ? prevData
        : prevData
        ? [prevData]
        : [];

      for (let i = 0; i < newDataArray.length; i++) {
        const currentNewData = newDataArray[i];
        const currentPrevData = prevDataArray[i];

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

        let transformedPrevData = null;
        if (currentPrevData) {
          const prevDataResult =
            await this.datasV3Service.transformRecordsToV3Format({
              context,
              records: [currentPrevData],
              primaryKey: model.primaryKey,
              primaryKeys: model.primaryKeys,
              columns: model.columns,
              reuse: {},
              depth: 0,
            });
          transformedPrevData = prevDataResult[0];
        }

        // For each workflow, check if the record entered the configured view
        for (const workflow of workflows) {
          try {
            // Get the trigger node to find the viewId
            const triggerNode = workflow.nodes?.find(
              (node) => node.type === triggerType,
            );

            if (!triggerNode || !triggerNode.data?.config?.viewId) {
              this.logger.warn({
                message: 'Trigger node or viewId not found in workflow',
                workflowId: workflow.id,
                triggerType,
              });
              continue;
            }

            const viewId = triggerNode.data.config.viewId;

            // Compute filter matches
            const { matchesFilter, prevMatchedFilter } =
              await this.computeViewFilterMatch(
                context,
                viewId,
                currentNewData,
                currentPrevData,
                source,
              );

            // Record enters view if:
            // - For insert: matchesFilter is true (prevMatchedFilter is false by default)
            // - For update: prevMatchedFilter is false AND matchesFilter is true (state change)
            if (prevMatchedFilter || !matchesFilter) {
              // Record didn't enter the view
              continue;
            }

            // Record entered view - queue workflow execution
            const triggerInputs = {
              newData: transformedNewData[0],
              prevData: transformedPrevData,
              user,
              timestamp: new Date().toISOString(),
            };

            await this.jobsService.add(JobTypes.ExecuteWorkflow, {
              context,
              workflowId: workflow.id,
              triggerInputs,
              user,
            });
          } catch (e) {
            this.logger.error({
              error: e,
              details: 'Error while queuing record enters view workflow',
              workflowId: workflow.id,
            });
          }
        }
      }
    } catch (error) {
      this.logger.error({
        error,
        details: 'Error in triggerRecordEntersViewWorkflows',
        hookName,
        modelId,
      });
    }
  }

  /**
   * Trigger record matches condition workflows
   */
  private async triggerRecordMatchesConditionWorkflows(
    context: NcContext,
    param: { hookName; prevData; newData; user; viewId; modelId },
  ): Promise<void> {
    const { modelId, newData, prevData, user, hookName } = param;

    try {
      const triggerType = 'nocodb.trigger.record_matches_condition';

      // Find all workflows with this trigger type for this table
      const workflows = await Workflow.findByTrigger(
        context,
        triggerType,
        modelId,
      );

      if (workflows.length === 0) {
        return;
      }

      const model = await Model.get(context, modelId);
      await model.getColumns(context);

      const source = await Source.get(context, model.source_id);

      const newDataArray = Array.isArray(newData) ? newData : [newData];
      const prevDataArray = Array.isArray(prevData)
        ? prevData
        : prevData
        ? [prevData]
        : [];

      for (let i = 0; i < newDataArray.length; i++) {
        const currentNewData = newDataArray[i];
        const currentPrevData = prevDataArray[i];

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

        let transformedPrevData = null;
        if (currentPrevData) {
          const prevDataResult =
            await this.datasV3Service.transformRecordsToV3Format({
              context,
              records: [currentPrevData],
              primaryKey: model.primaryKey,
              primaryKeys: model.primaryKeys,
              columns: model.columns,
              reuse: {},
              depth: 0,
            });
          transformedPrevData = prevDataResult[0];
        }

        // For each workflow, check if the record matches the custom conditions
        for (const workflow of workflows) {
          try {
            // Get the trigger node to find the filters
            const triggerNode = workflow.nodes?.find(
              (node) => node.type === triggerType,
            );

            if (!triggerNode || !triggerNode.data?.config?.filters) {
              this.logger.warn({
                message: 'Trigger node or filters not found in workflow',
                workflowId: workflow.id,
                triggerType,
              });
              continue;
            }

            const filtersForValidation = triggerNode.data.config.filters;

            if (!filtersForValidation || filtersForValidation.length === 0) {
              continue;
            }

            const matchesFilter = await validateCondition(
              context,
              filtersForValidation,
              currentNewData,
              {
                client: source?.type,
                skipFetchingChildren: true,
              },
            );

            const prevMatchedFilter =
              currentPrevData && filtersForValidation.length
                ? await validateCondition(
                    context,
                    filtersForValidation,
                    currentPrevData,
                    {
                      client: source?.type,
                      skipFetchingChildren: true,
                    },
                  )
                : false;

            // Record matches condition if:
            // - For insert: matchesFilter is true (prevMatchedFilter is false by default)
            // - For update: prevMatchedFilter is false AND matchesFilter is true (state change)
            if (prevMatchedFilter || !matchesFilter) {
              // Record didn't match the conditions (or was already matching)
              this.logger.debug({
                message: 'Record did not match conditions',
                workflowId: workflow.id,
                matchesFilter,
                prevMatchedFilter,
              });
              continue;
            }

            // Record matched conditions - queue workflow execution
            const triggerInputs = {
              newData: transformedNewData[0],
              prevData: transformedPrevData,
              user,
              timestamp: new Date().toISOString(),
            };

            await this.jobsService.add(JobTypes.ExecuteWorkflow, {
              context,
              workflowId: workflow.id,
              triggerInputs,
              user,
            });
          } catch (e) {
            this.logger.error({
              error: e,
              details: 'Error while queuing record matches condition workflow',
              workflowId: workflow.id,
            });
          }
        }
      }
    } catch (error) {
      this.logger.error({
        error,
        details: 'Error in triggerRecordMatchesConditionWorkflows',
        hookName,
        modelId,
      });
    }
  }
}
