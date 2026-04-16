import { Injectable } from '@nestjs/common';
import { ViewTypes, WorkspaceUserRoles } from 'nocodb-sdk';
import { ImportService as ImportServiceCE } from 'src/modules/jobs/jobs/export-import/import.service';
import type { UserType, ViewCreateReqType, WidgetType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type { Model, Permission, View } from '~/models';
import { WorkspaceUsersService } from '~/services/workspace-users.service';
import { ListsService } from '~/services/lists.service';
import { type User, WorkspaceUser } from '~/models';
import Document from '~/models/Document';
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
import { PermissionsService } from '~/services/permissions.service';
import { WorkflowsService } from '~/services/workflows.service';
import { extractWorkflowDependencies } from '~/services/workflows/extractDependency';
import { deepReplaceStrings } from '~/helpers/stringHelpers';

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
    protected permissionsService: PermissionsService,
    protected workflowService: WorkflowsService,
    protected listsService: ListsService,
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

  async createView(
    context: NcContext,
    idMap: Map<string, string>,
    md: Model,
    vw: Partial<View>,
    views: View[],
    user: UserType,
    req: NcRequest,
  ): Promise<View> {
    if (vw.type !== ViewTypes.LIST) {
      return super.createView(context, idMap, md, vw, views, user, req);
    }

    const rawLevels: any[] = (vw.view as any)?.levels ?? [];
    const levelsToCreate = rawLevels.filter((level) => !!level.fk_model_id);

    const processedLevels = levelsToCreate.map((level) => ({
      level: level.level,
      fk_model_id: idMap.get(level.fk_model_id),
      fk_link_column_id: level.fk_link_column_id
        ? idMap.get(level.fk_link_column_id)
        : null,
      fk_self_link_column_id: level.fk_self_link_column_id
        ? idMap.get(level.fk_self_link_column_id)
        : null,
      enable_nested_records: level.enable_nested_records,
      wrap_headers: level.wrap_headers,
      meta: level.meta,
    }));

    const oview = await this.listsService.listViewCreate(context, {
      tableId: md.id,
      list: vw as ViewCreateReqType,
      ownedBy: (vw as any).owned_by,
      user: user as any,
      req,
    });

    // Apply levels if there are more than the default level 0
    if (processedLevels.length > 0) {
      await this.listsService.listViewUpdate(context, {
        listViewId: oview.id,
        list: { levels: processedLevels } as any,
        req,
      });
    }

    return oview;
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
      await this.scriptsService.createScript(context, script, param.req);
    }
  }

  override async importDocuments(
    context: NcContext,
    param: {
      user: User;
      baseId: string;
      data: Array<any>;
      req: NcRequest;
    },
  ) {
    if (!param.data?.length) return;

    // Build old parent_id -> new doc id mapping for nested docs
    const idMap = new Map<string | null, string>();

    // First pass: create all documents (without parent_id for nested ones)
    // We need to create root docs first, then children
    const rootDocs = param.data.filter((d) => !d.parent_id);
    const childDocs = param.data.filter((d) => d.parent_id);

    for (const doc of rootDocs) {
      const created = await Document.insert(context, {
        title: doc.title,
        content: doc.content,
        meta: doc.meta,
        order: doc.order,
        has_children: doc.has_children,
        parent_id: null,
        base_id: param.baseId,
        fk_workspace_id: context.workspace_id,
        created_by: param.user.id,
        updated_by: param.user.id,
      });
      if (created?.id && doc.id) {
        idMap.set(doc.id, created.id);
      }
    }

    // Second pass: create child docs with mapped parent_ids
    // Sort by depth (shallowest first) so parents are created before children
    const pending = [...childDocs];
    let maxIterations = pending.length * 2;
    while (pending.length > 0 && maxIterations-- > 0) {
      const doc = pending[0];
      const newParentId = idMap.get(doc.parent_id);

      if (newParentId) {
        pending.shift();
        const created = await Document.insert(context, {
          title: doc.title,
          content: doc.content,
          meta: doc.meta,
          order: doc.order,
          has_children: doc.has_children,
          parent_id: newParentId,
          base_id: param.baseId,
          fk_workspace_id: context.workspace_id,
          created_by: param.user.id,
          updated_by: param.user.id,
        });
        if (created?.id && doc.id) {
          idMap.set(doc.id, created.id);
        }
      } else {
        // Parent not yet created, move to end
        pending.shift();
        pending.push(doc);
      }
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

  async importWorkflows(
    context: NcContext,
    param: {
      user: User;
      baseId: string;
      data: Array<any>;
      req: NcRequest;
      idMap: Map<string, string>;
    },
  ) {
    const { data, idMap } = param;

    const buildDepsMap = (nodes: any): Map<string, string> => {
      if (!nodes) return new Map();

      const deps = extractWorkflowDependencies(nodes);
      const flat = [
        ...(deps.columns || []),
        ...(deps.models || []),
        ...(deps.views || []),
      ];

      const map = new Map<string, string>();
      for (const dep of flat) {
        const newId = idMap.get(dep.id);
        if (newId) map.set(dep.id, newId);
      }
      return map;
    };

    const cleanNodes = (nodes: any[]) => {
      if (!Array.isArray(nodes)) return nodes;

      return nodes.map((node) => {
        const { testResult, data, ...rest } = node;

        const cleanData =
          data && typeof data === 'object'
            ? (() => {
                const { testResult: _tr, ...dataRest } = data;
                return dataRest;
              })()
            : data;

        return { ...rest, data: cleanData };
      });
    };

    for (const workflowData of data) {
      try {
        const mapDefault = buildDepsMap(workflowData.nodes);
        const mapDraft = buildDepsMap(workflowData.draft?.nodes);

        const cleanedNodes = cleanNodes(workflowData.nodes);
        const cleanedDraftNodes = cleanNodes(workflowData.draft?.nodes);

        const updatedNodes = deepReplaceStrings(cleanedNodes, mapDefault);
        const updatedEdges = deepReplaceStrings(workflowData.edges, mapDefault);

        const updatedDraft = workflowData.draft
          ? {
              ...workflowData.draft,
              nodes: deepReplaceStrings(cleanedDraftNodes, mapDraft),
            }
          : undefined;

        const updatedWorkflow = {
          ...workflowData,
          nodes: updatedNodes,
          edges: updatedEdges,
          draft: updatedDraft,
        };

        await this.workflowService.createWorkflow(
          context,
          withoutId(updatedWorkflow),
          param.req,
        );
      } catch (error: any) {
        this.logger.error(
          `Failed to import workflow "${workflowData.title}": ${error.message}`,
        );
      }
    }

    return idMap;
  }

  async importPermissions(
    context: NcContext,
    param: {
      permissions: Permission[];
      getIdOrExternalId: (id: string) => string | undefined;
      req: NcRequest;
    },
  ) {
    const { permissions, getIdOrExternalId, req } = param;

    const workspaceUsers = await WorkspaceUser.userList({
      fk_workspace_id: context.workspace_id,
    });

    for (const permission of permissions) {
      permission.subjects = permission.subjects?.filter((p) =>
        workspaceUsers.some((u) => u.id === p.id),
      );

      await this.permissionsService.setPermission(
        context,
        {
          ...permission,
          entity_id: getIdOrExternalId(permission.entity_id),
        },
        req,
      );
    }
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
