import debug from 'debug';
import { Injectable } from '@nestjs/common';
import { DuplicateProcessor as DuplicateProcessorCE } from 'src/modules/jobs/jobs/export-import/duplicate.processor';
import { AppEvents, generateUniqueCopyName } from 'nocodb-sdk';
import type { Job } from 'bull';
import type { NcContext, NcRequest } from '~/interface/config';
import type { Base, Source } from '~/models';
import type { DuplicateDashboardJobData } from '~/interface/Jobs';
import { Dashboard } from '~/models';
import { JobTypes } from '~/interface/Jobs';
import { WorkspaceUsersService } from '~/services/workspace-users.service';
import { ExportService } from '~/modules/jobs/jobs/export-import/export.service';
import { ImportService } from '~/modules/jobs/jobs/export-import/import.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { BasesService } from '~/services/bases.service';
import { BulkDataAliasService } from '~/services/bulk-data-alias.service';
import { ColumnsService } from '~/services/columns.service';
import { TablesService } from '~/services/tables.service';
import { TelemetryService } from '~/services/telemetry.service';
import { elapsedTime, initTime } from '~/modules/jobs/helpers';
import { DashboardsService } from '~/services/dashboards.service';
import { withoutId } from '~/helpers/exportImportHelpers';
import { FiltersService } from '~/services/filters.service';
import { applyMeta, diffMeta, serializeMeta } from '~/helpers/baseMetaHelpers';
import { CacheDelDirection, CacheScope, MetaTable } from '~/utils/globals';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';

@Injectable()
export class DuplicateProcessor extends DuplicateProcessorCE {
  protected readonly debugLog = debug('nc:jobs:duplicate:ee');
  constructor(
    protected readonly workspaceUsersService: WorkspaceUsersService,

    protected readonly exportService: ExportService,
    protected readonly importService: ImportService,
    protected readonly projectsService: BasesService,
    protected readonly bulkDataService: BulkDataAliasService,
    protected readonly columnsService: ColumnsService,
    protected readonly appHooksService: AppHooksService,
    protected readonly tablesService: TablesService,
    protected readonly telemetryService: TelemetryService,
    protected readonly dashboardService: DashboardsService,
    protected readonly filterService: FiltersService,
  ) {
    super(
      exportService,
      importService,
      projectsService,
      bulkDataService,
      columnsService,
      appHooksService,
      tablesService,
      telemetryService,
    );
  }

  override async handleDuplicateDifferentWs(params: {
    sourceBase: Base; // Base to duplicate
    targetBase: Base; // Base to duplicate to
    dataSource: Source; // Data source to duplicate from
    req: NcRequest;
    context: NcContext; // Context of the base to duplicate
    targetContext?: NcContext; // Context of the base to duplicate to
    options: {
      excludeData?: boolean;
      excludeHooks?: boolean;
      excludeViews?: boolean;
      excludeComments?: boolean;
      excludeUsers?: boolean;
      excludeDashboards?: boolean;
    };
  }) {
    this.debugLog('Handling cross-workspace duplication');

    try {
      if (!params.options?.excludeData && !params.options?.excludeUsers) {
        this.debugLog('Migrating workspace users');

        // Get all workspace users (not just base users)
        // because non-base users can be assigned as values in user fields
        const wsUsers = await this.workspaceUsersService.list({
          workspaceId: params.context.workspace_id,
          // Include deleted users since user fields might reference them
          includeDeleted: true,
        });

        if (wsUsers.list && wsUsers.list.length > 0) {
          await this.importService.importUsers(params.targetContext, {
            users: wsUsers.list as any[],
            req: params.req,
          });

          this.debugLog(`Migrated ${wsUsers.list.length} workspace users`);
        } else {
          this.debugLog('No workspace users to migrate');
        }
      } else {
        this.debugLog('Skipping user migration due to options');
      }
    } catch (error) {
      this.debugLog('Error during cross-workspace user migration:', error);
      throw new Error(`Failed to migrate workspace users: ${error.message}`);
    }
  }

  async duplicateDashboard(job: Job<DuplicateDashboardJobData>) {
    this.debugLog(`job started for ${job.id} (${JobTypes.DuplicateDashboard})`);

    const hrTime = initTime();

    const { context, req, dashboardId } = job.data;
    const dashboard = await Dashboard.get(context, dashboardId);

    const baseDashboards = await Dashboard.list(context, dashboard.base_id);

    await dashboard.getWidgets(context);

    try {
      const newTitle = generateUniqueCopyName(dashboard.title, baseDashboards, {
        accessor: (item) => item.title,
      });

      const newDashboard = await this.dashboardService.dashboardCreate(
        context,
        {
          ...withoutId(dashboard),
          title: newTitle,
        },
        req,
      );

      elapsedTime(
        hrTime,
        `serialize dashboard schema for ${dashboard.id}`,
        JobTypes.DuplicateDashboard,
      );

      for (const wget of dashboard.widgets) {
        const { filters, ...widget } = wget as any;
        const identifierMap = new Map<string, string>();
        const createdWidget = await this.dashboardService.widgetCreate(
          context,
          {
            ...withoutId(widget),
            fk_dashboard_id: newDashboard.id,
          },
          req,
        );

        for (const filter of filters) {
          const createdFilter = await this.filterService.widgetFilterCreate(
            context,
            {
              filter: {
                ...withoutId(filter),
                fk_parent_id: identifierMap.get(filter.fk_parent_id),
                fk_widget_id: createdWidget.id,
              },
              widgetId: createdWidget.id,
              user: req.user,
              req,
            },
          );

          identifierMap.set(filter.id, createdFilter.id);
        }
      }

      elapsedTime(
        hrTime,
        `created widgets for ${dashboard.id}`,
        JobTypes.DuplicateDashboard,
      );

      this.appHooksService.emit(AppEvents.DASHBOARD_DUPLICATE_COMPLETE, {
        sourceDashboard: dashboard,
        destDashboard: newDashboard,
        user: req.user,
        req,
        context,
      });

      return {
        id: newDashboard.id,
      };
    } catch (error) {
      this.appHooksService.emit(AppEvents.DASHBOARD_DUPLICATE_FAIL, {
        sourceDashboard: dashboard,
        user: req.user,
        req,
        context,
        error: error.message,
      });
      throw error;
    }
  }

  async duplicateBaseJob({
    sourceBase,
    targetBase,
    dataSource,
    req,
    context,
    options,
    operation,
    targetContext: _targetContext,
  }: {
    sourceBase: Base; // Base to duplicate
    targetBase: Base; // Base to duplicate to
    dataSource: Source; // Data source to duplicate from
    req: NcRequest;
    context: NcContext; // Context of the base to duplicate
    targetContext?: NcContext; // Context of the base to duplicate to
    options: {
      excludeData?: boolean;
      excludeHooks?: boolean;
      excludeViews?: boolean;
      excludeComments?: boolean;
      excludeUsers?: boolean;
      excludeScripts?: boolean;
      excludeDashboards?: boolean;
    };
    operation: JobTypes;
  }) {
    const hrTime = initTime();
    this.debugLog(
      `Starting base duplication job for ${sourceBase.id} -> ${targetBase.id}`,
    );

    const targetContext = _targetContext ?? {
      workspace_id: targetBase.fk_workspace_id,
      base_id: targetBase.id,
    };

    // Validation checks
    if (!sourceBase || !targetBase || !dataSource) {
      const error = new Error(
        'Missing required parameters: sourceBase, targetBase, or dataSource',
      );
      this.debugLog('Validation failed:', error.message);
      throw error;
    }

    if (!context?.base_id || !targetContext?.base_id) {
      const error = new Error('Invalid context: base_id is required');
      this.debugLog('Context validation failed:', error.message);
      throw error;
    }

    let trx;
    try {
      // Handle cross-workspace duplication if needed
      if (
        [JobTypes.DuplicateBase, JobTypes.RestoreSnapshot].includes(
          operation,
        ) &&
        targetContext.workspace_id !== sourceBase.fk_workspace_id
      ) {
        this.debugLog('Handling cross-workspace duplication');
        await this.handleDuplicateDifferentWs({
          sourceBase,
          targetBase,
          dataSource,
          req,
          context,
          targetContext,
          options,
        });
      }

      // Start transaction for atomic operation
      trx = await Noco.ncMeta.startTransaction();
      this.debugLog('Transaction started');

      try {
        // Step 1: Handle source configuration
        await this.handleSourceConfiguration(
          sourceBase,
          targetBase,
          context,
          targetContext,
          trx,
        );

        // Step 2: Serialize source metadata with proper overrides
        this.debugLog('Serializing source metadata');
        const sourceMeta = await serializeMeta(
          context,
          {
            fk_workspace_id: targetContext.workspace_id,
            base_id: targetContext.base_id,
          },
          trx,
        );

        // Step 3: Calculate diff (empty old meta means everything is new)
        this.debugLog('Calculating metadata diff');
        const diff = await diffMeta({}, sourceMeta);

        // Step 4: Apply metadata changes to target base
        this.debugLog('Applying metadata changes');
        await applyMeta(targetContext, diff, trx, {
          progressCallback: (step, progress) => {
            this.debugLog(`Progress: ${step} (${progress}%)`);
          },
        });

        // Step 5: Commit transaction
        await trx.commit();
        this.debugLog('Transaction committed successfully');

        elapsedTime(
          hrTime,
          `duplicated metadata for base ${sourceBase.id}`,
          operation,
        );
      } catch (e) {
        this.debugLog('Error during duplication, rolling back transaction:', e);
        await trx.rollback();
        throw e;
      }

      // Step 6: Update base status to active
      this.debugLog('Updating base status to active');
      await this.projectsService.baseUpdate(targetContext, {
        baseId: targetBase.id,
        base: {
          status: null,
        },
        user: req.user,
        req,
      });

      // Step 7: Emit success event
      this.appHooksService.emit(AppEvents.BASE_DUPLICATE_COMPLETE, {
        sourceBase,
        destBase: targetBase,
        user: req.user,
        req,
        context: targetContext,
      });

      this.debugLog(
        `Base duplication completed successfully: ${sourceBase.id} -> ${targetBase.id}`,
      );
    } catch (err) {
      this.debugLog('Base duplication failed:', err);

      // Cleanup: soft delete the target base if it was created
      if (targetBase?.id) {
        try {
          this.debugLog(
            'Cleaning up failed duplication - soft deleting target base',
          );
          await this.projectsService.baseSoftDelete(targetContext, {
            baseId: targetBase.id,
            user: req.user,
            req,
          });
        } catch (cleanupError) {
          this.debugLog('Failed to cleanup target base:', cleanupError);
          // Don't throw cleanup errors, just log them
        }
      }

      // Emit failure event
      this.appHooksService.emit(AppEvents.BASE_DUPLICATE_FAIL, {
        sourceBase,
        destBase: targetBase,
        user: req.user,
        req,
        context: targetContext,
        error: err.message,
      });

      // Send telemetry for system errors
      await this.telemetryService.sendSystemEvent({
        event_type: 'priority_error',
        error_trigger: 'duplicateBase',
        error_type: err?.name || 'UnknownError',
        message: err?.message || 'Unknown error occurred',
        error_details: err?.stack,
        affected_resources: [
          req?.user?.email,
          req?.user?.id,
          context.base_id,
          context.workspace_id,
          targetContext.base_id,
          targetContext.workspace_id,
        ],
      });

      throw err;
    }
  }

  private async handleSourceConfiguration(
    sourceBase: Base,
    targetBase: Base,
    context: NcContext,
    targetContext: NcContext,
    trx: any,
  ): Promise<void> {
    this.debugLog('Handling source configuration');
    this.debugLog(
      `Source base: ${sourceBase.id}, Target base: ${targetBase.id}`,
    );
    this.debugLog(
      `Source workspace: ${context.workspace_id}, Target workspace: ${targetContext.workspace_id}`,
    );

    const targetSourceQb = trx
      .knex(MetaTable.SOURCES)
      .where({
        fk_workspace_id: targetContext.workspace_id,
        base_id: targetBase.id,
      })
      .where((qb) => {
        qb.where('is_meta', true).orWhere('is_local', true);
      });

    const targetSourceRecord = await targetSourceQb.clone().first();

    const sourceRecord = await trx
      .knex(MetaTable.SOURCES)
      .where({
        fk_workspace_id: context.workspace_id,
        base_id: sourceBase.id,
      })
      .where((qb) => {
        qb.where('is_meta', true).orWhere('is_local', true);
      })
      .first();

    if (!targetSourceRecord || !sourceRecord) {
      this.debugLog('Target source record:', targetSourceRecord);
      this.debugLog('Source record:', sourceRecord);
      throw new Error(
        `Source configuration not found for base ${sourceBase.id} or ${targetBase.id}`,
      );
    }

    this.debugLog(
      `Found source record ID: ${sourceRecord.id} for base ${sourceBase.id}`,
    );
    this.debugLog(
      `Found target source record ID: ${targetSourceRecord.id} for base ${targetBase.id}`,
    );

    // Delete default target source as it will be replaced
    await targetSourceQb.delete();

    // Copy source config from source to target, preserving target's connection config
    const newSourceRecord = {
      ...sourceRecord,
      base_id: targetBase.id,
      fk_workspace_id: targetContext.workspace_id,
      config: targetSourceRecord.config, // Preserve target's database connection
    };

    // For same-ID duplication with composite PK (base_id, id)
    // Check if the exact combination already exists
    const existingSource = await trx
      .knex(MetaTable.SOURCES)
      .where({
        base_id: targetBase.id,
        id: sourceRecord.id,
      })
      .first();

    if (existingSource) {
      // Exact combination (base_id, id) already exists - this is likely a retry, skip insertion
      this.debugLog(
        `Source with composite key (${targetBase.id}, ${sourceRecord.id}) already exists, skipping insertion`,
      );
      return;
    } else {
      // Safe to preserve the ID since composite PK allows same ID across different base_ids
      this.debugLog(
        `Preserving source ID ${sourceRecord.id} for same-ID duplication (composite PK allows this)`,
      );
    }

    try {
      await trx.knex(MetaTable.SOURCES).insert(newSourceRecord);
      this.debugLog(
        `Successfully inserted source record with ID: ${
          newSourceRecord.id || 'auto-generated'
        }`,
      );
    } catch (error) {
      this.debugLog('Failed to insert source record:', error.message);
      this.debugLog(
        'Source record data:',
        JSON.stringify(newSourceRecord, null, 2),
      );
      throw new Error(
        `Failed to insert source configuration: ${error.message}`,
      );
    }

    // Clear source cache for target base
    await NocoCache.deepDel(
      targetContext,
      `${CacheScope.SOURCE}:${targetContext.base_id}:list`,
      CacheDelDirection.PARENT_TO_CHILD,
    );

    this.debugLog('Source configuration handled successfully');
  }
}
