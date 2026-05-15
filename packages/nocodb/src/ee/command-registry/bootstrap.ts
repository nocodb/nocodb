import { Injectable, Logger } from '@nestjs/common';
import type { OnApplicationBootstrap } from '@nestjs/common';
import { registerBaseVariableHandlers } from '~/command-registry/operations/base-variables';
import { registerTableHandlers } from '~/command-registry/operations/tables';
import { registerTablesV3Handlers } from '~/command-registry/operations/tables-v3';
import { registerMacroHandlers } from '~/command-registry/operations/macro';
import { registerViewHandlers } from '~/command-registry/operations/views';
import { registerColumnHandlers } from '~/command-registry/operations/columns';
import { registerViewTypeHandlers } from '~/command-registry/operations/view-types';
import { registerFilterHandlers } from '~/command-registry/operations/filters';
import { registerFiltersV3Handlers } from '~/command-registry/operations/filters-v3';
import { registerSortHandlers } from '~/command-registry/operations/sorts';
import {
  registerFormColumnHandlers,
  registerGridColumnHandlers,
  registerShowHideAllHandlers,
  registerViewColumnHandlers,
} from '~/command-registry/operations/view-columns';
import { registerHookHandlers } from '~/command-registry/operations/hooks';
import { registerExtensionHandlers } from '~/command-registry/operations/extensions';
import { registerDashboardHandlers } from '~/command-registry/operations/dashboards';
import { registerScriptHandlers } from '~/command-registry/operations/scripts';
import { registerWorkflowHandlers } from '~/command-registry/operations/workflows';
import { registerViewSectionHandlers } from '~/command-registry/operations/view-sections';
import { registerRecordTemplateHandlers } from '~/command-registry/operations/record-templates';
import { registerSyncHandlers } from '~/command-registry/operations/sync';
import { registerDateDependencyHandlers } from '~/command-registry/operations/date-dependency';
import { registerTrashHandlers } from '~/command-registry/operations/trash';
import { registerRowColorHandlers } from '~/command-registry/operations/row-color';
import { registerPermissionHandlers } from '~/command-registry/operations/permissions';
import { registerRlsHandlers } from '~/command-registry/operations/rls';
import { registerRecordHandlers } from '~/command-registry/operations/records';
import { registerSmartTextHandlers } from '~/command-registry/operations/smart-text';
import { OperationRegistry } from '~/command-registry/registry';
import { BaseVariablesService } from '~/ee/services/base-variables.service';
import { TablesService } from '~/services/tables.service';
import { ViewsService } from '~/services/views.service';
import { ColumnsService } from '~/services/columns.service';
import { GridsService } from '~/services/grids.service';
import { FormsService } from '~/services/forms.service';
import { GalleriesService } from '~/services/galleries.service';
import { KanbansService } from '~/services/kanbans.service';
import { CalendarsService } from '~/services/calendars.service';
import { ListsService } from '~/ee/services/lists.service';
import { TimelinesService } from '~/services/timelines.service';
import { GanttsService } from '~/services/gantts.service';
import { MapsService } from '~/services/maps.service';
import { FiltersService } from '~/services/filters.service';
import { SortsService } from '~/services/sorts.service';
import { ViewColumnsService } from '~/services/view-columns.service';
import { GridColumnsService } from '~/services/grid-columns.service';
import { FormColumnsService } from '~/services/form-columns.service';
import { HooksService } from '~/services/hooks.service';
import { ExtensionsService } from '~/services/extensions.service';
import { DashboardsService } from '~/services/dashboards.service';
import { ScriptsService } from '~/services/scripts.service';
import { WorkflowsService } from '~/services/workflows.service';
import { ViewSectionsService } from '~/ee/services/view-sections.service';
import { RecordTemplatesService } from '~/services/record-templates/record-templates.service';
import { SyncService } from '~/services/sync.service';
import { DateDependencyService } from '~/services/date-dependency.service';
import { FiltersV3Service } from '~/services/v3/filters-v3.service';
import { BaseTrashService } from '~/ee/services/base-trash/base-trash.service';
import { ViewRowColorService } from '~/services/view-row-color.service';
import { PermissionsService } from '~/ee/services/permissions.service';
import { RlsService } from '~/services/rls.service';
import { TablesV3Service } from '~/services/v3/tables-v3.service';
import { DataTableService } from '~/services/data-table.service';
import { DataAliasNestedService } from '~/services/data-alias-nested.service';
import { SmartTextService } from '~/services/smart-text.service';

@Injectable()
export class OperationRegistryBootstrap implements OnApplicationBootstrap {
  private readonly logger = new Logger(OperationRegistryBootstrap.name);

  constructor(
    private readonly baseVariablesSvc: BaseVariablesService,
    private readonly tablesSvc: TablesService,
    private readonly viewsSvc: ViewsService,
    private readonly columnsSvc: ColumnsService,
    private readonly gridsSvc: GridsService,
    private readonly formsSvc: FormsService,
    private readonly galleriesSvc: GalleriesService,
    private readonly kanbansSvc: KanbansService,
    private readonly calendarsSvc: CalendarsService,
    private readonly listsSvc: ListsService,
    private readonly timelinesSvc: TimelinesService,
    private readonly ganttsSvc: GanttsService,
    private readonly mapsSvc: MapsService,
    private readonly filtersSvc: FiltersService,
    private readonly sortsSvc: SortsService,
    private readonly viewColumnsSvc: ViewColumnsService,
    private readonly gridColumnsSvc: GridColumnsService,
    private readonly formColumnsSvc: FormColumnsService,
    private readonly hooksSvc: HooksService,
    private readonly extensionsSvc: ExtensionsService,
    private readonly dashboardsSvc: DashboardsService,
    private readonly scriptsSvc: ScriptsService,
    private readonly workflowsSvc: WorkflowsService,
    private readonly viewSectionsSvc: ViewSectionsService,
    private readonly recordTemplatesSvc: RecordTemplatesService,
    private readonly syncSvc: SyncService,
    private readonly dateDependencySvc: DateDependencyService,
    private readonly filtersV3Svc: FiltersV3Service,
    private readonly baseTrashSvc: BaseTrashService,
    private readonly viewRowColorSvc: ViewRowColorService,
    private readonly permissionsSvc: PermissionsService,
    private readonly rlsSvc: RlsService,
    private readonly tablesV3Svc: TablesV3Service,
    private readonly dataTableSvc: DataTableService,
    private readonly dataAliasNestedSvc: DataAliasNestedService,
    private readonly smartTextSvc: SmartTextService,
  ) {}

  onApplicationBootstrap(): void {
    registerBaseVariableHandlers(this.baseVariablesSvc);
    registerTableHandlers(this.tablesSvc, this.baseTrashSvc);
    registerViewHandlers(this.viewsSvc);
    registerTrashHandlers(this.baseTrashSvc);
    registerColumnHandlers(this.columnsSvc, this.baseTrashSvc);
    registerViewTypeHandlers(
      this.gridsSvc,
      this.formsSvc,
      this.galleriesSvc,
      this.kanbansSvc,
      this.calendarsSvc,
      this.listsSvc,
      this.timelinesSvc,
      this.ganttsSvc,
      this.mapsSvc,
      this.baseTrashSvc,
    );
    registerFilterHandlers(this.filtersSvc);
    registerSortHandlers(this.sortsSvc);
    registerViewColumnHandlers(this.viewColumnsSvc);
    registerGridColumnHandlers(this.gridColumnsSvc);
    registerFormColumnHandlers(this.formColumnsSvc);
    registerShowHideAllHandlers(this.viewsSvc);
    registerHookHandlers(this.hooksSvc);
    registerExtensionHandlers(this.extensionsSvc);
    registerDashboardHandlers(this.dashboardsSvc, this.baseTrashSvc);
    registerScriptHandlers(this.scriptsSvc);
    registerWorkflowHandlers(this.workflowsSvc, this.baseTrashSvc);
    registerViewSectionHandlers(this.viewSectionsSvc);
    registerRecordTemplateHandlers(this.recordTemplatesSvc);
    registerSyncHandlers(this.syncSvc);
    registerDateDependencyHandlers(this.dateDependencySvc);
    registerFiltersV3Handlers(this.filtersV3Svc);
    registerRowColorHandlers(this.viewRowColorSvc);
    registerPermissionHandlers(this.permissionsSvc);
    registerRlsHandlers(this.rlsSvc, this.filtersSvc);
    registerTablesV3Handlers(this.tablesV3Svc, this.baseTrashSvc);
    registerRecordHandlers(
      this.dataTableSvc,
      this.baseTrashSvc,
      this.dataAliasNestedSvc,
    );
    registerSmartTextHandlers(this.smartTextSvc);
    registerMacroHandlers();

    OperationRegistry.freeze();
    this.logger.log(
      `OperationRegistry frozen with ${
        OperationRegistry.describe().length
      } handlers`,
    );
  }
}
