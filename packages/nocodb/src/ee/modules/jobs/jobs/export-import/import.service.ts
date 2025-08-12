import { Injectable } from '@nestjs/common';
import { WorkspaceUserRoles } from 'nocodb-sdk';
import { ImportService as ImportServiceCE } from 'src/modules/jobs/jobs/export-import/import.service';
import type { WidgetType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { WorkspaceUsersService } from '~/services/workspace-users.service';
import { type User, WorkspaceUser } from '~/models';
import { BulkDataAliasService } from '~/services/bulk-data-alias.service';
import { CalendarsService } from '~/services/calendars.service';
import { ColumnsService } from '~/services/columns.service';
import { FiltersService } from '~/services/filters.service';
import { FormColumnsService } from '~/services/form-columns.service';
import { FormsService } from '~/services/forms.service';
import { GalleriesService } from '~/services/galleries.service';
import { GridColumnsService } from '~/services/grid-columns.service';
import { GridsService } from '~/services/grids.service';
import { HooksService } from '~/services/hooks.service';
import { KanbansService } from '~/services/kanbans.service';
import { SortsService } from '~/services/sorts.service';
import { TablesService } from '~/services/tables.service';
import { ViewColumnsService } from '~/services/view-columns.service';
import { ViewsService } from '~/services/views.service';
import { ScriptsService } from '~/services/scripts.service';
import { DashboardsService } from '~/services/dashboards.service';
import { withoutId } from '~/helpers/exportImportHelpers';
import { getWidgetHandler } from '~/db/widgets';

@Injectable()
export class ImportService extends ImportServiceCE {
  constructor(
    protected readonly workspaceUsersService: WorkspaceUsersService,

    protected tablesService: TablesService,
    protected columnsService: ColumnsService,
    protected filtersService: FiltersService,
    protected sortsService: SortsService,
    protected viewColumnsService: ViewColumnsService,
    protected gridColumnsService: GridColumnsService,
    protected formColumnsService: FormColumnsService,
    protected gridsService: GridsService,
    protected formsService: FormsService,
    protected galleriesService: GalleriesService,
    protected calendarsService: CalendarsService,
    protected kanbansService: KanbansService,
    protected bulkDataService: BulkDataAliasService,
    protected hooksService: HooksService,
    protected viewsService: ViewsService,
    protected scriptsService: ScriptsService,
    protected dashboardService: DashboardsService,
  ) {
    super(
      tablesService,
      columnsService,
      filtersService,
      sortsService,
      viewColumnsService,
      gridColumnsService,
      formColumnsService,
      gridsService,
      formsService,
      galleriesService,
      calendarsService,
      kanbansService,
      bulkDataService,
      hooksService,
      viewsService,
    );
  }

  override async importScripts(
    context: NcContext,
    param: {
      user: User;
      baseId: string;
      data: Array<any>;
      req: NcRequest;
    },
  ) {
    if (!param.data?.length) return;
    for (const script of param.data) {
      await this.scriptsService.createScript(
        context,
        context.base_id,
        script,
        param.req,
      );
    }
  }

  override async importDashboards(
    context: NcContext,
    param: {
      user: User;
      baseId: string;
      data: Array<any>;
      req: NcRequest;
      idMap: Map<string, string>;
    },
  ) {
    if (!param.data?.length) return;
    const { req, idMap } = param;

    for (const dashboard of param.data) {
      const createdDashboard = await this.dashboardService.dashboardCreate(
        context,
        withoutId(dashboard),
        req,
      );

      idMap.set(dashboard.id, createdDashboard.id);

      const widgets = dashboard.widgets;
      for (const wg of widgets) {
        const { filters, ...widget } = wg;

        const handler = await getWidgetHandler(context, {
          widget: widget as WidgetType,
          req,
          idMap,
        });

        const deserializedWidget = await handler.serializeOrDeserializeWidget(
          context,
          widget as any,
          idMap,
          'deserialize',
        );

        const insertedWidget = await this.dashboardService.widgetCreate(
          context,
          deserializedWidget,
          req,
        );
        idMap.set(widget.id, insertedWidget.id);

        for (const filter of filters) {
          const fg = await this.filtersService.widgetFilterCreate(context, {
            filter: withoutId({
              ...filter,
              fk_widget_id: insertedWidget.id,
              fk_column_id: idMap.get(filter.fk_column_id),
              fk_parent_id: idMap.get(filter.fk_parent_id),
            }),
            user: param.user,
            widgetId: insertedWidget.id,
            req,
          });
          idMap.set(filter.id, fg.id);
        }
      }
    }

    return idMap;
  }

  override async importUsers(
    context: NcContext,

    payload: {
      users: {
        email: string;
        display_name?: string;
      }[];
      req: NcRequest;
    },
  ) {
    const { users, req } = payload;

    const existingUsers = await WorkspaceUser.userList({
      fk_workspace_id: context.workspace_id,
      include_deleted: true,
    });

    const existingUserMap = new Map(
      existingUsers.map((user) => [user.email, user]),
    );

    for (const user of users) {
      if (existingUserMap.has(user.email)) {
        continue;
      }

      await this.workspaceUsersService.invite({
        workspaceId: context.workspace_id,
        body: {
          email: user.email,
          display_name: user.display_name,
          roles: WorkspaceUserRoles.NO_ACCESS,
        },
        invitedBy: req.user,
        // we don't want to send email invites so url can be empty
        siteUrl: '',
        skipEmailInvite: true,
        invitePassive: true,
        req,
      });
    }
  }
}
