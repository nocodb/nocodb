import { Injectable, Logger } from '@nestjs/common';
import { AppEvents, DependencyTableType } from 'nocodb-sdk';
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

    // Enrich bookmarks with current entity metadata (icons, titles)
    const enriched = await this.enrichBookmarks(bookmarks);

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
        case 'script': {
          const wsId = meta.workspace_id;
          const baseId = meta.base_id;
          if (wsId && baseId) {
            if (!result[wsId]) result[wsId] = {};
            if (!result[wsId][baseId]) result[wsId][baseId] = {};
            result[wsId][baseId][bm.target_id] = {};
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
            result[wsId][baseId][tableId][bm.target_id] = {};
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

    const bookmark = await Bookmark.insert({
      fk_user_id: userId,
      fk_group_id: groupId,
      title: param.body.title,
      target_type: param.body.target_type,
      target_id: param.body.target_id,
      order: param.body.order,
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

    try {
      await DependencyTracker.clearDependencies(
        context,
        DependencyTableType.Bookmark,
        param.bookmarkId,
      );
    } catch (e) {
      this.logger.error('Failed to clear bookmark dependency', e.stack);
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
    await Bookmark.moveToGroup(param.groupId, ungrouped.id!);

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
      case 'table':
      case 'document':
      case 'workflow':
      case 'script': {
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
    }
  }

  // --- Enrichment ---

  private async enrichBookmarks(
    bookmarks: Bookmark[],
  ): Promise<BookmarkType[]> {
    return NcConcurrent(
      bookmarks.map((bm) => async () => {
        const meta = (bm.meta as Record<string, any>) ?? {};

        // Build context from bookmark's stored meta
        const ctx = {
          workspace_id: meta.workspace_id,
          base_id: meta.base_id,
        } as NcContext;

        //TODO: validateTargetAccess before continuing
        // performance consideration

        let resolvedTitle: string | undefined;

        try {
          switch (bm.target_type) {
            case 'workspace': {
              const ws = await Workspace.get(bm.target_id);
              if (ws) {
                const wsMeta = parseMetaProp(ws);
                meta.icon = wsMeta?.icon;
                meta.iconType = wsMeta?.iconType;
                meta.color = wsMeta?.color;
                resolvedTitle = ws.title;
              }
              break;
            }
            case 'base': {
              const base = await Base.get(ctx, bm.target_id);
              if (base) {
                const baseMeta = parseMetaProp(base);
                meta.icon_color = baseMeta?.iconColor;
                meta.workspace_id = base.fk_workspace_id;
                resolvedTitle = base.title;
              }
              break;
            }
            case 'table': {
              const table = await Model.get(ctx, bm.target_id);
              if (table) {
                const tableMeta = parseMetaProp(table);
                meta.icon = tableMeta?.icon;
                meta.workspace_id = meta.workspace_id || table.fk_workspace_id;
                meta.base_id = meta.base_id || table.base_id;
                resolvedTitle = table.title;
              }
              break;
            }
            case 'view': {
              const view = await View.get(ctx, bm.target_id);
              if (view) {
                meta.view_type = view.type;
                meta.table_id = view.fk_model_id;
                resolvedTitle = view.title;

                // Also resolve table's base_id for routing
                if (!meta.base_id && view.fk_model_id) {
                  const table = await Model.get(ctx, view.fk_model_id);
                  if (table) {
                    meta.base_id = table.base_id;
                    meta.workspace_id =
                      meta.workspace_id || table.fk_workspace_id;
                  }
                }
              }
              break;
            }
            // document, workflow, script use static icons — just refresh title
            default:
              break;
          }
        } catch (e) {
          this.logger.warn(`Failed to enrich bookmark ${bm.id}: ${e.message}`);
        }

        return {
          ...bm,
          meta,
          resolved_title: resolvedTitle ?? bm.title ?? undefined,
        } as BookmarkType;
      }),
    );
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
