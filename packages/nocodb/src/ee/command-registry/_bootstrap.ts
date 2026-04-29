import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { OperationRegistry } from '~/command-registry/_registry';
import { registerBaseVariableHandlers } from './handlers/base-variables.handlers';
import { registerTableHandlers } from './handlers/tables.handlers';
import { registerViewHandlers } from './handlers/views.handlers';
import { registerColumnHandlers } from './handlers/columns.handlers';
import { registerViewTypeHandlers } from './handlers/view-types.handlers';
import { registerFilterHandlers } from './handlers/filters.handlers';
import {
  registerSortHandlers,
  registerViewColumnHandlers,
  registerVisibilityHandlers,
} from './handlers/sorts-visibilities.handlers';
import { registerHookHandlers } from './handlers/hooks.handlers';
import { registerExtensionHandlers } from './handlers/extensions.handlers';
import { registerDashboardHandlers } from './handlers/dashboards.handlers';
import { registerScriptHandlers } from './handlers/scripts.handlers';
import { registerWorkflowHandlers } from './handlers/workflows.handlers';
import { registerViewSectionHandlers } from './handlers/view-sections.handlers';
import { registerRecordTemplateHandlers } from './handlers/record-templates.handlers';
import { registerSyncHandlers } from './handlers/sync.handlers';
import { registerPermissionHandlers } from './handlers/permissions.handlers';
import { registerRlsHandlers } from './handlers/rls.handlers';
import { registerDateDependencyHandlers } from './handlers/date-dependency.handlers';
import { registerFiltersV3Handlers } from './handlers/filters-v3.handlers';
import { BaseVariablesService } from '~/ee/services/base-variables.service';
import { TablesService } from '~/services/tables.service';
import { ViewsService } from '~/services/views.service';
import { ColumnsService } from '~/services/columns.service';
import { GridsService } from '~/services/grids.service';
import { FormsService } from '~/services/forms.service';
import { GalleriesService } from '~/services/galleries.service';
import { KanbansService } from '~/services/kanbans.service';
import { CalendarsService } from '~/services/calendars.service';
import { FiltersService } from '~/services/filters.service';
import { SortsService } from '~/services/sorts.service';
import { ViewColumnsService } from '~/services/view-columns.service';
import { ModelVisibilitiesService } from '~/services/model-visibilities.service';
import { HooksService } from '~/services/hooks.service';
import { ExtensionsService } from '~/services/extensions.service';
import { DashboardsService } from '~/services/dashboards.service';
import { ScriptsService } from '~/services/scripts.service';
import { WorkflowsService } from '~/services/workflows.service';
import { ViewSectionsService } from '~/ee/services/view-sections.service';
import { RecordTemplatesService } from '~/services/record-templates/record-templates.service';
import { SyncService } from '~/services/sync.service';
import { PermissionsService } from '~/services/permissions.service';
import { RlsService } from '~/services/rls.service';
import { DateDependencyService } from '~/services/date-dependency.service';
import { FiltersV3Service } from '~/services/v3/filters-v3.service';

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
    private readonly filtersSvc: FiltersService,
    private readonly sortsSvc: SortsService,
    private readonly viewColumnsSvc: ViewColumnsService,
    private readonly modelVisibilitiesSvc: ModelVisibilitiesService,
    private readonly hooksSvc: HooksService,
    private readonly extensionsSvc: ExtensionsService,
    private readonly dashboardsSvc: DashboardsService,
    private readonly scriptsSvc: ScriptsService,
    private readonly workflowsSvc: WorkflowsService,
    private readonly viewSectionsSvc: ViewSectionsService,
    private readonly recordTemplatesSvc: RecordTemplatesService,
    private readonly syncSvc: SyncService,
    private readonly permissionsSvc: PermissionsService,
    private readonly rlsSvc: RlsService,
    private readonly dateDependencySvc: DateDependencyService,
    private readonly filtersV3Svc: FiltersV3Service,
  ) {}

  onApplicationBootstrap(): void {
    registerBaseVariableHandlers(this.baseVariablesSvc);
    registerTableHandlers(this.tablesSvc);
    registerViewHandlers(this.viewsSvc);
    registerColumnHandlers(this.columnsSvc);
    registerViewTypeHandlers(
      this.gridsSvc,
      this.formsSvc,
      this.galleriesSvc,
      this.kanbansSvc,
      this.calendarsSvc,
    );
    registerFilterHandlers(this.filtersSvc);
    registerSortHandlers(this.sortsSvc);
    registerViewColumnHandlers(this.viewColumnsSvc);
    registerVisibilityHandlers(this.modelVisibilitiesSvc);
    registerHookHandlers(this.hooksSvc);
    registerExtensionHandlers(this.extensionsSvc);
    registerDashboardHandlers(this.dashboardsSvc);
    registerScriptHandlers(this.scriptsSvc);
    registerWorkflowHandlers(this.workflowsSvc);
    registerViewSectionHandlers(this.viewSectionsSvc);
    registerRecordTemplateHandlers(this.recordTemplatesSvc);
    registerSyncHandlers(this.syncSvc);
    registerPermissionHandlers(this.permissionsSvc);
    registerRlsHandlers(this.rlsSvc);
    registerDateDependencyHandlers(this.dateDependencySvc);
    registerFiltersV3Handlers(this.filtersV3Svc);

    OperationRegistry.freeze();
    this.logger.log(
      `OperationRegistry frozen with ${OperationRegistry.describe().length} handlers`,
    );
  }
}
