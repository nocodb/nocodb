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

@Injectable()
export class DuplicateProcessor extends DuplicateProcessorCE {
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
    if (!params.options?.excludeData && !params.options?.excludeUsers) {
      // we get all ws users and not just base users
      // because non-base users can be assigned as value in user field
      const wsUsers = await this.workspaceUsersService.list({
        workspaceId: params.context.workspace_id,
        // since there's possibility that user field has value with deleted user
        // we also migrate all deleted users
        includeDeleted: true,
      });

      await this.importService.importUsers(params.targetContext, {
        users: wsUsers.list as any[],
        req: params.req,
      });
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
}
