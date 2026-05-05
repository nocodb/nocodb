import { Injectable, Logger } from '@nestjs/common';
import {
  AppEvents,
  DependencyTableType,
  ProjectRoles,
  WorkspaceUserRoles,
} from 'nocodb-sdk';
import type {
  BookmarkGroupReqType,
  BookmarkReqType,
  BookmarkType,
  NcContext,
  NcRequest,
} from 'nocodb-sdk';
import { Bookmark, BookmarkGroup, DependencyTracker } from '~/models';
import { NcError } from '~/helpers/catchError';
import { AppHooksService } from '~/ee/services/app-hooks/app-hooks.service';
import Base from '~/models/Base';
import BaseUser from '~/models/BaseUser';
import Model from '~/models/Model';
import View from '~/models/View';
import Workspace from '~/ee/models/Workspace';
import WorkspaceUser from '~/ee/models/WorkspaceUser';
import Document from '~/ee/models/Document';
import Workflow from '~/ee/models/Workflow';
import Script from '~/ee/models/Script';
import Dashboard from '~/ee/models/Dashboard';
import { NcConcurrent } from '~/utils/NcConcurrent';
import { parseMetaProp } from '~/utils/modelUtils';

@Injectable()
export class BookmarkService {
  protected logger = new Logger(BookmarkService.name);

  constructor(protected readonly appHooksService: AppHooksService) {}

  // --- Bookmarks ---

  async bookmarkList(param: { req: NcRequest }) {
    const userId = param.req.user?.id;
    if (!userId) NcError.unauthorized('User not found');

    const [bookmarks, groups] = await Promise.all([
      Bookmark.list(userId),
      BookmarkGroup.list(userId),
    ]);

    // Enrich bookmarks with current entity metadata (icons, titles).
    // Bookmarks the user has lost access to (base role downgraded, view
    // hidden, etc.) are dropped here so the flyout doesn't show items
    // that 404 / "not accessible" on click.
    const enriched = await this.enrichBookmarks(bookmarks, userId);

    return { bookmarks: enriched, groups };
  }

  async bookmarkCheck(param: { req: NcRequest }) {
    const userId = param.req.user?.id;
    if (!userId) NcError.unauthorized('User not found');

    const bookmarks = await Bookmark.list(userId);

    const result: Record<string, any> = {};

    for (const bm of bookmarks) {
      const meta = (bm.meta as Record<string, any>) ?? {};

      switch (bm.target_type) {
        case 'workspace': {
          if (!result[bm.target_id]) result[bm.target_id] = {};
          result[bm.target_id]._exists = true;
          break;
        }
        case 'base': {
          const wsId = meta.workspace_id;
          if (wsId) {
            if (!result[wsId]) result[wsId] = {};
            if (!result[wsId][bm.target_id]) result[wsId][bm.target_id] = {};
            result[wsId][bm.target_id]._exists = true;
          }
          break;
        }
        case 'table':
        case 'document':
        case 'workflow':
        case 'script':
        case 'dashboard': {
          const wsId = meta.workspace_id;
          const baseId = meta.base_id;
          if (wsId && baseId) {
            if (!result[wsId]) result[wsId] = {};
            if (!result[wsId][baseId]) result[wsId][baseId] = {};
            result[wsId][baseId][bm.target_id] = { _exists: true };
          }
          break;
        }
        case 'view': {
          const wsId = meta.workspace_id;
          const baseId = meta.base_id;
          const tableId = meta.table_id;
          if (wsId && baseId && tableId) {
            if (!result[wsId]) result[wsId] = {};
            if (!result[wsId][baseId]) result[wsId][baseId] = {};
            if (!result[wsId][baseId][tableId])
              result[wsId][baseId][tableId] = {};
            result[wsId][baseId][tableId][bm.target_id] = { _exists: true };
          }
          break;
        }
      }
    }

    return result;
  }

  async bookmarkCreate(param: { body: BookmarkReqType; req: NcRequest }) {
    const userId = param.req.user?.id;
    if (!userId) NcError.unauthorized('User not found');

    const meta = (param.body.meta as Record<string, any>) ?? {};
    const context = {
      workspace_id: meta.workspace_id,
      base_id: meta.base_id,
    } as NcContext;

    await this.validateTargetAccess(context, {
      userId,
      targetType: param.body.target_type,
      targetId: param.body.target_id,
    });

    let groupId = param.body.fk_group_id;

    if (!groupId) {
      const ungrouped = await BookmarkGroup.getOrCreateUngrouped(userId);
      groupId = ungrouped.id;
    } else {
      const group = await BookmarkGroup.get(groupId);
      if (!group || group.fk_user_id !== userId) {
        NcError.badRequest('Invalid group');
      }
    }

    // Race condition on order is fine — bookmarks are per-user and reorderable
    const maxOrder = await Bookmark.maxOrder(groupId);

    const bookmark = await Bookmark.insert({
      fk_user_id: userId,
      fk_group_id: groupId,
      title: param.body.title,
      target_type: param.body.target_type,
      target_id: param.body.target_id,
      order: maxOrder + 1,
      meta: param.body.meta,
    });

    // Register dependency for future cleanup
    const depSourceType = this.mapTargetTypeToDependency(
      param.body.target_type,
    );
    if (depSourceType) {
      try {
        await DependencyTracker.trackDependencies(
          context,
          DependencyTableType.Bookmark,
          bookmark.id!,
          this.buildDependencyPayload(depSourceType, param.body.target_id),
          undefined,
          true, // ignoreClear — no prior deps to clear on create
        );
      } catch (e) {
        this.logger.error('Failed to track bookmark dependency', e.stack);
      }
    }

    this.appHooksService.emit(AppEvents.BOOKMARK_CREATE, {
      context,
      req: param.req,
      bookmarkId: bookmark.id,
      targetType: param.body.target_type,
    });

    return bookmark;
  }

  async bookmarkUpdate(param: {
    bookmarkId: string;
    body: Partial<BookmarkReqType>;
    req: NcRequest;
  }) {
    const userId = param.req.user?.id;
    if (!userId) NcError.unauthorized('User not found');

    const bookmark = await Bookmark.get(param.bookmarkId);
    if (!bookmark || bookmark.fk_user_id !== userId) {
      NcError.genericNotFound('Bookmark', param.bookmarkId);
    }

    if (param.body.fk_group_id) {
      const group = await BookmarkGroup.get(param.body.fk_group_id);
      if (!group || group.fk_user_id !== userId) {
        NcError.badRequest('Invalid group');
      }
    }

    return Bookmark.update(param.bookmarkId, {
      title: param.body.title,
      fk_group_id: param.body.fk_group_id,
      order: param.body.order,
      meta: param.body.meta,
    });
  }

  async bookmarkDelete(param: { bookmarkId: string; req: NcRequest }) {
    const userId = param.req.user?.id;
    if (!userId) NcError.unauthorized('User not found');

    const bookmark = await Bookmark.get(param.bookmarkId);
    if (!bookmark || bookmark.fk_user_id !== userId) {
      NcError.genericNotFound('Bookmark', param.bookmarkId);
    }

    const meta = (bookmark.meta as Record<string, any>) ?? {};
    const context = {
      workspace_id: meta.workspace_id,
      base_id: meta.base_id,
    } as NcContext;

    await Bookmark.delete(param.bookmarkId);

    // Only clear dependencies for target_types that were tracked at create
    // time (table / view / workflow). Workspace / base / document / script /
    // dashboard bookmarks have no DependencyTracker row, and the bookmark's
    // own meta may not even carry a base_id (e.g. workspace bookmarks),
    // which would make metaDelete throw "Base ID is required".
    if (
      this.mapTargetTypeToDependency(bookmark.target_type) &&
      context.base_id
    ) {
      try {
        await DependencyTracker.clearDependencies(
          context,
          DependencyTableType.Bookmark,
          param.bookmarkId,
        );
      } catch (e) {
        this.logger.error('Failed to clear bookmark dependency', e.stack);
      }
    }

    this.appHooksService.emit(AppEvents.BOOKMARK_DELETE, {
      context,
      req: param.req,
      bookmarkId: param.bookmarkId,
      targetType: bookmark.target_type,
    });

    return true;
  }

  // --- Groups ---

  async bookmarkGroupList(param: { req: NcRequest }) {
    const userId = param.req.user?.id;
    if (!userId) NcError.unauthorized('User not found');

    return BookmarkGroup.list(userId);
  }

  async bookmarkGroupCreate(param: {
    body: BookmarkGroupReqType;
    req: NcRequest;
  }) {
    const userId = param.req.user?.id;
    if (!userId) NcError.unauthorized('User not found');

    return BookmarkGroup.insert({
      fk_user_id: userId,
      name: param.body.name,
      order: param.body.order,
      meta: param.body.meta,
    });
  }

  async bookmarkGroupUpdate(param: {
    groupId: string;
    body: Partial<BookmarkGroupReqType>;
    req: NcRequest;
  }) {
    const userId = param.req.user?.id;
    if (!userId) NcError.unauthorized('User not found');

    const group = await BookmarkGroup.get(param.groupId);
    if (!group || group.fk_user_id !== userId) {
      NcError.genericNotFound('BookmarkGroup', param.groupId);
    }

    return BookmarkGroup.update(param.groupId, {
      name: param.body.name,
      order: param.body.order,
      meta: param.body.meta,
    });
  }

  async bookmarkGroupDelete(param: { groupId: string; req: NcRequest }) {
    const userId = param.req.user?.id;
    if (!userId) NcError.unauthorized('User not found');

    const group = await BookmarkGroup.get(param.groupId);
    if (!group || group.fk_user_id !== userId) {
      NcError.genericNotFound('BookmarkGroup', param.groupId);
    }

    if (group.name === 'Ungrouped') {
      NcError.badRequest('Cannot delete the Ungrouped group');
    }

    // Move bookmarks to Ungrouped
    const ungrouped = await BookmarkGroup.getOrCreateUngrouped(userId);
    await Bookmark.moveToGroup(param.groupId, ungrouped.id!, userId);

    await BookmarkGroup.delete(param.groupId);

    return true;
  }

  // --- Access validation ---
  private async validateTargetAccess(
    context: NcContext,
    param: { userId: string; targetType: string; targetId: string },
  ) {
    const { userId, targetType, targetId } = param;

    switch (targetType) {
      case 'workspace': {
        const wsUser = await WorkspaceUser.get(targetId, userId);
        if (!wsUser) {
          NcError.get(context).badRequest(
            'You do not have access to this workspace',
          );
        }
        break;
      }
      case 'base': {
        const baseUser = await BaseUser.get(context, targetId, userId);
        if (!baseUser?.roles && !(baseUser as any)?.workspace_roles) {
          NcError.get(context).badRequest(
            'You do not have access to this base',
          );
        }
        break;
      }
      case 'table': {
        const model = await Model.get(context, targetId);
        if (!model) {
          NcError.get(context).badRequest('Target not found');
        }
        const baseUser = await BaseUser.get(
          { ...context, base_id: model.base_id } as NcContext,
          model.base_id!,
          userId,
        );
        if (!baseUser?.roles && !(baseUser as any)?.workspace_roles) {
          NcError.get(context).badRequest(
            'You do not have access to this item',
          );
        }
        break;
      }
      case 'document':
      case 'workflow':
      case 'script':
      case 'dashboard': {
        // Verify the target exists. Each type has its own model class.
        // Model.get won't work for documents (xcCondition restricts to
        // table|view) and workflows/scripts live in nc_automations entirely.
        let target: { base_id?: string } | null = null;
        if (targetType === 'document') {
          target = await Document.get(context, targetId);
        } else if (targetType === 'workflow') {
          target = await Workflow.get(context, targetId);
        } else if (targetType === 'script') {
          target = await Script.get(context, targetId);
        } else if (targetType === 'dashboard') {
          target = await Dashboard.get(context, targetId);
        }

        if (!target) {
          NcError.get(context).badRequest('Target not found');
        }

        const baseId = target!.base_id || context.base_id;
        if (!baseId) {
          NcError.get(context).badRequest('Missing base_id for target');
        }

        const baseUser = await BaseUser.get(
          { ...context, base_id: baseId } as NcContext,
          baseId!,
          userId,
        );
        if (!baseUser?.roles && !(baseUser as any)?.workspace_roles) {
          NcError.get(context).badRequest(
            'You do not have access to this item',
          );
        }
        break;
      }
      case 'view': {
        const view = await View.get(context, targetId);
        if (!view) {
          NcError.get(context).badRequest('Target not found');
        }

        const table = await Model.get(context, view.fk_model_id!);
        if (!table) {
          NcError.get(context).badRequest('Target not found');
        }

        const baseUser = await BaseUser.get(
          { ...context, base_id: table.base_id } as NcContext,
          table.base_id!,
          userId,
        );
        if (!baseUser?.roles && !(baseUser as any)?.workspace_roles) {
          NcError.get(context).badRequest(
            'You do not have access to this view',
          );
        }
        break;
      }
      default:
        NcError.get(context).badRequest(
          `Unsupported bookmark target_type: ${targetType}`,
        );
    }
  }

  // --- Enrichment ---

  private async enrichBookmarks(
    bookmarks: Bookmark[],
    userId: string,
  ): Promise<BookmarkType[]> {
    // Resolve "is base X accessible?" via BaseUser.getProjectsList, which
    // already excludes NO_ACCESS and respects INHERIT-from-workspace
    // semantics — same source of truth used by /api/v1/db/meta/projects.
    // One DB hit per unique workspace_id, then O(1) Set lookups per
    // bookmark.
    const accessibleBaseIdsByWs = new Map<string, Set<string>>();
    const getAccessibleBaseIds = async (
      workspaceId: string,
    ): Promise<Set<string>> => {
      if (!workspaceId) return new Set();
      if (accessibleBaseIdsByWs.has(workspaceId)) {
        return accessibleBaseIdsByWs.get(workspaceId)!;
      }
      const bases = await BaseUser.getProjectsList(userId, { workspaceId });
      const set = new Set(bases.map((b) => b.id!).filter(Boolean));
      accessibleBaseIdsByWs.set(workspaceId, set);
      return set;
    };
    const hasBaseAccess = async (
      workspaceId: string,
      baseId: string,
    ): Promise<boolean> => {
      if (!workspaceId || !baseId) return false;
      const ids = await getAccessibleBaseIds(workspaceId);
      return ids.has(baseId);
    };

    // Workspace bookmarks: WorkspaceUser.roles is a comma-separated string.
    // A no-access user still has a row, so check that at least one role is
    // non-empty AND not the no-access sentinel.
    const grantsWorkspaceAccess = (
      rolesStr: string | undefined | null,
    ): boolean => {
      if (!rolesStr) return false;
      const roles = rolesStr
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean);
      return roles.some(
        (r) =>
          r !== ProjectRoles.NO_ACCESS && r !== WorkspaceUserRoles.NO_ACCESS,
      );
    };

    const results = await NcConcurrent(
      bookmarks.map((bm) => async () => {
        const meta = (bm.meta as Record<string, any>) ?? {};

        // Build context from bookmark's stored meta
        const ctx = {
          workspace_id: meta.workspace_id,
          base_id: meta.base_id,
        } as NcContext;

        let resolvedTitle: string | undefined;
        // Drop the bookmark when the underlying entity is gone or the user
        // lost access to its base. Set to true once we've confirmed access
        // for this bookmark.
        let accessible = false;

        try {
          switch (bm.target_type) {
            case 'workspace': {
              const ws = await Workspace.get(bm.target_id);
              if (ws) {
                const wsUser = await WorkspaceUser.get(bm.target_id, userId);
                // A no-access user still has a row, so check that the role
                // string actually grants access.
                if (wsUser && grantsWorkspaceAccess((wsUser as any)?.roles)) {
                  const wsMeta = parseMetaProp(ws);
                  meta.icon = wsMeta?.icon;
                  meta.iconType = wsMeta?.iconType;
                  meta.color = wsMeta?.color;
                  resolvedTitle = ws.title;
                  accessible = true;
                }
              }
              break;
            }
            case 'base': {
              const base = await Base.get(ctx, bm.target_id);
              if (
                base &&
                (await hasBaseAccess(base.fk_workspace_id!, bm.target_id))
              ) {
                const baseMeta = parseMetaProp(base);
                meta.icon_color = baseMeta?.iconColor;
                meta.workspace_id = base.fk_workspace_id;
                resolvedTitle = base.title;
                accessible = true;
              }
              break;
            }
            case 'table': {
              const table = await Model.get(ctx, bm.target_id);
              if (
                table &&
                (await hasBaseAccess(table.fk_workspace_id!, table.base_id!))
              ) {
                const tableMeta = parseMetaProp(table);
                meta.icon = tableMeta?.icon;
                meta.workspace_id = meta.workspace_id || table.fk_workspace_id;
                meta.base_id = meta.base_id || table.base_id;
                resolvedTitle = table.title;
                accessible = true;
              }
              break;
            }
            case 'view': {
              const view = await View.get(ctx, bm.target_id);
              if (view) {
                // View is base-scoped through its model — load model to get base_id
                const viewTable = view.fk_model_id
                  ? await Model.get(ctx, view.fk_model_id)
                  : null;
                if (
                  viewTable &&
                  (await hasBaseAccess(
                    viewTable.fk_workspace_id!,
                    viewTable.base_id!,
                  ))
                ) {
                  meta.view_type = view.type;
                  meta.table_id = view.fk_model_id;
                  meta.icon = parseMetaProp(view)?.icon;
                  meta.base_id = meta.base_id || viewTable.base_id;
                  meta.workspace_id =
                    meta.workspace_id || viewTable.fk_workspace_id;
                  resolvedTitle = view.title;
                  accessible = true;
                }
              }
              break;
            }
            case 'document': {
              const doc = await Document.get(ctx, bm.target_id);
              if (
                doc &&
                doc.base_id &&
                (await hasBaseAccess(
                  (doc as any).fk_workspace_id || ctx.workspace_id!,
                  doc.base_id,
                ))
              ) {
                meta.icon = parseMetaProp(doc)?.icon;
                resolvedTitle = doc.title;
                accessible = true;
              }
              break;
            }
            case 'workflow': {
              const workflow = await Workflow.get(ctx, bm.target_id);
              if (
                workflow &&
                workflow.base_id &&
                (await hasBaseAccess(
                  (workflow as any).fk_workspace_id || ctx.workspace_id!,
                  workflow.base_id,
                ))
              ) {
                meta.icon = parseMetaProp(workflow)?.icon;
                resolvedTitle = workflow.title;
                accessible = true;
              }
              break;
            }
            case 'script': {
              const script = await Script.get(ctx, bm.target_id);
              if (
                script &&
                script.base_id &&
                (await hasBaseAccess(
                  (script as any).fk_workspace_id || ctx.workspace_id!,
                  script.base_id,
                ))
              ) {
                meta.icon = parseMetaProp(script)?.icon;
                resolvedTitle = script.title;
                accessible = true;
              }
              break;
            }
            case 'dashboard': {
              const dashboard = await Dashboard.get(ctx, bm.target_id);
              if (
                dashboard &&
                dashboard.base_id &&
                (await hasBaseAccess(
                  (dashboard as any).fk_workspace_id || ctx.workspace_id!,
                  dashboard.base_id,
                ))
              ) {
                const dashMeta = parseMetaProp(dashboard);
                meta.icon = dashMeta?.icon;
                resolvedTitle = dashboard.title;
                accessible = true;
              }
              break;
            }
            default:
              break;
          }
        } catch (e) {
          this.logger.warn(`Failed to enrich bookmark ${bm.id}: ${e.message}`);
        }

        if (!accessible) return null;

        return {
          ...bm,
          meta,
          resolved_title: resolvedTitle ?? bm.title ?? undefined,
        } as BookmarkType;
      }),
    );

    return results.filter((bm): bm is BookmarkType => bm !== null);
  }

  // --- Helpers ---

  private mapTargetTypeToDependency(
    targetType: string,
  ): DependencyTableType | null {
    switch (targetType) {
      case 'table':
        return DependencyTableType.Model;
      case 'view':
        return DependencyTableType.View;
      case 'workflow':
        return DependencyTableType.Workflow;
      default:
        return null;
    }
  }

  private buildDependencyPayload(
    sourceType: DependencyTableType,
    sourceId: string,
  ) {
    switch (sourceType) {
      case DependencyTableType.Model:
        return { models: [{ id: sourceId }] };
      case DependencyTableType.View:
        return { views: [{ id: sourceId }] };
      case DependencyTableType.Workflow:
        return { workflows: [{ id: sourceId }] };
      default:
        return {};
    }
  }
}
