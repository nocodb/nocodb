import { Injectable, Logger } from '@nestjs/common';
import { registerBaseVariableHandlers } from './handlers/base-variables.handlers';
import { registerTableHandlers } from './handlers/tables.handlers';
import { registerViewHandlers } from './handlers/views.handlers';
import { registerColumnHandlers } from './handlers/columns.handlers';
import { registerViewTypeHandlers } from './handlers/view-types.handlers';
import { registerFilterHandlers } from './handlers/filters.handlers';
import {
  registerFormColumnHandlers,
  registerGridColumnHandlers,
  registerShowHideAllHandlers,
  registerSortHandlers,
  registerViewColumnHandlers,
} from './handlers/sorts-visibilities.handlers';
import { registerHookHandlers } from './handlers/hooks.handlers';
import { registerExtensionHandlers } from './handlers/extensions.handlers';
import { registerDashboardHandlers } from './handlers/dashboards.handlers';
import { registerScriptHandlers } from './handlers/scripts.handlers';
import { registerWorkflowHandlers } from './handlers/workflows.handlers';
import { registerViewSectionHandlers } from './handlers/view-sections.handlers';
import { registerRecordTemplateHandlers } from './handlers/record-templates.handlers';
import { registerSyncHandlers } from './handlers/sync.handlers';
import { registerDateDependencyHandlers } from './handlers/date-dependency.handlers';
import { registerFiltersV3Handlers } from './handlers/filters-v3.handlers';
import { registerTrashHandlers } from './handlers/trash.handlers';
import { registerRowColorHandlers } from './handlers/row-color.handlers';
import { registerPermissionHandlers } from './handlers/permissions.handlers';
import { registerRlsHandlers } from './handlers/rls.handlers';
import type { OnApplicationBootstrap } from '@nestjs/common';
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
  ) {}

  onApplicationBootstrap(): void {
    registerBaseVariableHandlers(this.baseVariablesSvc);
    registerTableHandlers(this.tablesSvc, this.baseTrashSvc);
    registerViewHandlers(this.viewsSvc);
    registerTrashHandlers(this.baseTrashSvc);
    registerColumnHandlers(this.columnsSvc);
    registerViewTypeHandlers(
      this.gridsSvc,
      this.formsSvc,
      this.galleriesSvc,
      this.kanbansSvc,
      this.calendarsSvc,
      this.listsSvc,
      this.timelinesSvc,
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

    OperationRegistry.freeze();
    this.logger.log(
      `OperationRegistry frozen with ${
        OperationRegistry.describe().length
      } handlers`,
    );
  }
}
