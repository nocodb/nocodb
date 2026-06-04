import { Inject, Injectable, Logger } from '@nestjs/common';
import { HookHandlerService as HookHandlerServiceCE } from 'src/services/hook-handler.service';
import {
  AppEvents,
  type HookType,
  ncIsObject,
  NOCO_SERVICE_USERS,
  PlanLimitTypes,
  ServiceUserType,
  TableSyncStatus,
  TableSyncTrigger,
  ViewTypes,
  WebhookEvents,
} from 'nocodb-sdk';
import type { WorkflowNodeRunContext } from '@noco-local-integrations/core';
import type { NcRequest } from '~/interface/config';
import { NcContext } from '~/interface/config';
import { EEOnly } from '~/decorators/ee-only.decorator';
// @ts-ignore importing directly will cause circular dependency error
import { type WorkflowExecutionService } from '~/services/workflow-execution.service';
import { JobTypes, type TableSyncJobData } from '~/interface/Jobs';
import {
  Base,
  Filter,
  Hook,
  Model,
  Source,
  TableSync,
  TableSyncMapping,
  View,
  Workflow,
} from '~/models';
import { dataWrapper } from '~/helpers/dbHelpers';
import {
  getAffectedColumns,
  validateCondition,
} from '~/helpers/webhookHelpers';
import { IEventEmitter } from '~/modules/event-emitter/event-emitter.interface';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
import { MailService } from '~/services/mail/mail.service';
import { DataV3Service } from '~/services/v3/data-v3.service';
import { NocoJobsService } from '~/services/noco-jobs.service';
import { checkLimit } from '~/helpers/paymentHelpers';
import {
  bufferPendingIncrementalIds,
  scheduleIncrementalRun,
} from '~/modules/table-sync/table-sync.helpers';

export { HANDLE_WEBHOOK } from 'src/services/hook-handler.service';

const TABLE_SYNC_HOOKS_OF_INTEREST = new Set([
  'after.insert',
  'after.bulkInsert',
  'after.update',
  'after.bulkUpdate',
  'after.delete',
  'after.bulkDelete',
]);

@Injectable()
export class HookHandlerService extends HookHandlerServiceCE {
  protected logger = new Logger(HookHandlerService.name);

  private lmtUnsubscribe?: () => void;

  constructor(
    @Inject('IEventEmitter') protected readonly eventEmitter: IEventEmitter,
    @Inject('JobsService') protected readonly jobsService: IJobsService,
    protected readonly mailService: MailService,
    private readonly datasV3Service: DataV3Service,
    @Inject('WorkflowExecutionService')
    private readonly workflowExecutionService: WorkflowExecutionService,
    private readonly nocoJobsService: NocoJobsService,
  ) {
    super(eventEmitter, jobsService, mailService);
  }

  onModuleInit(): any {
    super.onModuleInit();
    this.lmtUnsubscribe = this.eventEmitter.on(
      AppEvents.ROW_LMT_TOUCHED,
      async (arg: {
        context: NcContext;
        modelId: string;
        rowIds: string[];
        user: any;
      }) => {
        try {
          await this.scheduleTableSyncsFromLmtTouch(arg);
        } catch (e) {
          this.logger.error({
            error: e,
            details: 'Error handling ROW_LMT_TOUCHED in HookHandlerService',
            modelId: arg?.modelId,
          });
        }
      },
    );
  }

  onModuleDestroy() {
    super.onModuleDestroy();
    this.lmtUnsubscribe?.();
  }

  @EEOnly()
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

  @EEOnly()
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

    this.scheduleTableSyncs(context, param).catch((e: Error) => {
      this.logger.error({
        error: e,
        details: 'Error while scheduling table-sync',
        hookName: param.hookName,
        modelId: param.modelId,
      });
    });

    await checkLimit({
      workspaceId: context.workspace_id,
      // Workflow runs share the automation-run budget.
      type: PlanLimitTypes.LIMIT_AUTOMATION_RUN,
      message: ({ limit }) =>
        `You have reached the limit of ${limit} workflow executions for your plan.`,
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
        view.fk_model_id,
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

  private async scheduleTableSyncs(
    context: NcContext,
    param: { hookName; prevData; newData; user; viewId; modelId },
  ): Promise<void> {
    if (!param.hookName || !TABLE_SYNC_HOOKS_OF_INTEREST.has(param.hookName)) {
      return;
    }

    if (!param.modelId || !context?.workspace_id || !context?.base_id) return;

    const mappings = await TableSyncMapping.listBySourceTable(
      context.workspace_id,
      context.base_id,
      param.modelId,
    );

    if (!mappings.length) return;

    const model = await Model.get(context, param.modelId);

    if (!model) return;

    await model.getColumns(context);

    const eventRows = param.newData ?? param.prevData;

    const idsFromEvent: string[] = [];

    if (eventRows != null) {
      for (const row of Array.isArray(eventRows) ? eventRows : [eventRows]) {
        if (!ncIsObject(row)) continue;
        const pk = dataWrapper(row).extractPksValue(model, true);
        if (pk != null && pk !== '') idsFromEvent.push(String(pk));
      }
    }

    const seenSyncIds = new Set<string>();

    for (const mapping of mappings) {
      if (seenSyncIds.has(mapping.fk_table_sync_id)) continue;

      seenSyncIds.add(mapping.fk_table_sync_id);

      if (
        mapping.source_workspace_id !== context.workspace_id ||
        mapping.source_base_id !== context.base_id
      ) {
        this.logger.warn({
          message: 'Skipping cross-scope table-sync mapping',
          mappingId: mapping.id,
        });
        continue;
      }

      await this.scheduleIncrementalTableSync(
        mapping,
        context,
        param,
        idsFromEvent,
      );
    }
  }

  private async scheduleTableSyncsFromLmtTouch(arg: {
    context: NcContext;
    modelId: string;
    rowIds: string[];
    user: any;
  }): Promise<void> {
    const { context, modelId, rowIds, user } = arg;

    if (!modelId || !context?.workspace_id || !context?.base_id) return;
    if (!rowIds?.length) return;

    const mappings = await TableSyncMapping.listBySourceTable(
      context.workspace_id,
      context.base_id,
      modelId,
    );
    if (!mappings.length) return;

    const idsFromEvent = rowIds
      .filter((id) => id != null && id !== '')
      .map((id) => String(id));
    if (!idsFromEvent.length) return;

    const seenSyncIds = new Set<string>();
    for (const mapping of mappings) {
      if (seenSyncIds.has(mapping.fk_table_sync_id)) continue;
      seenSyncIds.add(mapping.fk_table_sync_id);

      if (
        mapping.source_workspace_id !== context.workspace_id ||
        mapping.source_base_id !== context.base_id
      ) {
        this.logger.warn({
          message: 'Skipping cross-scope table-sync mapping on LMT touch',
          mappingId: mapping.id,
        });
        continue;
      }

      await this.scheduleIncrementalTableSync(
        mapping,
        context,
        {
          hookName: 'lmt.touch',
          prevData: null,
          newData: null,
          user,
          modelId,
        },
        idsFromEvent,
      );
    }
  }

  /**
   * Realtime incremental debounce (window: `TABLE_SYNC_INCREMENTAL_DEBOUNCE_MS`).
   * Two fixed slots per sync (`…:incremental` + `…:incremental:overflow`); see
   * `scheduleIncrementalRun`:
   *  - First write: schedule a slot (delayed one window).
   *  - Write while a slot's job is still delayed: remove + re-add it with merged
   *    `affectedIdsBySource`, so it fires one window after the LAST write.
   *  - Write while a slot is processing: it's skipped (we never re-add a running
   *    job's id — its completion would clobber the re-add). If a free slot
   *    exists the write lands there; if both slots are processing we buffer the
   *    ids in a cache hash keyed by sync. The running job drains that buffer on
   *    completion and re-runs into the other slot
   *    (`drainAndRequeueIncremental`). The per-sync lock guarantees only one
   *    slot executes at a time, so ids are never lost or double-applied.
   * `affectedIdsBySource[modelId]` is what lets the processor detect deletes /
   * view-exits: any id present here but not returned by the source view query
   * has disappeared and needs tombstoning — critical for DELETE, which leaves
   * no LMT trail.
   */
  private async scheduleIncrementalTableSync(
    mapping: TableSyncMapping,
    context: NcContext,
    param: { hookName; prevData; newData; user; modelId },
    idsFromEvent: string[],
  ): Promise<void> {
    const syncId = mapping.fk_table_sync_id;
    const sourceTableId = param.modelId;

    const destContext: NcContext = {
      workspace_id: mapping.fk_workspace_id,
      base_id: mapping.dest_base_id,
    };

    const [destBase, sourceBase] = await Promise.all([
      Base.get(
        {
          workspace_id: mapping.fk_workspace_id,
          base_id: mapping.dest_base_id,
        } as NcContext,
        mapping.dest_base_id,
      ),
      Base.get(
        {
          workspace_id: mapping.source_workspace_id,
          base_id: mapping.source_base_id,
        } as NcContext,
        mapping.source_base_id,
      ),
    ]);
    if (!destBase || !sourceBase) {
      return;
    }

    const sync = await TableSync.get(destContext, syncId);
    if (!sync || sync.status !== TableSyncStatus.Active) {
      return;
    }
    if (sync.sync_trigger === TableSyncTrigger.Manual) {
      return;
    }

    const baseJobData: Omit<
      TableSyncJobData,
      'affectedIdsBySource' | 'jobName' | 'user'
    > = {
      context: destContext,
      syncId,
      mode: 'incremental',
      req: {
        context,
        user: NOCO_SERVICE_USERS[ServiceUserType.SYNC_USER],
        ncWorkspaceId: context?.workspace_id,
        ncBaseId: context?.base_id,
        ncSiteUrl: '',
        dashboardUrl: '',
        headers: {},
        query: {},
        body: {},
        params: {},
      } as NcRequest,
    };
    const newIdsBySource = { [sourceTableId]: idsFromEvent };

    const scheduled = await scheduleIncrementalRun(this.nocoJobsService, {
      syncId,
      baseJobData,
      newIdsBySource,
    });

    // The job is already processing — park the ids in the buffer. The running
    // job drains them on completion and re-runs itself once.
    if (!scheduled) {
      await bufferPendingIncrementalIds(destContext, syncId, newIdsBySource);
      this.logger.warn(
        `Incremental tableSync:${syncId}: run in progress — buffered ${idsFromEvent.length} ids`,
      );
    }
  }
}
