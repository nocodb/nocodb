import type { OperationContract } from '~/command-registry/types';
import type { ViewsService } from '~/services/views.service';
import { OperationName } from '~/command-registry/op-names';
import { registerForward } from '~/command-registry/replay-context';
import { dynamicScope, scopeBase, scopeView } from '~/command-registry/scope';
import { MetaTable } from '~/utils/globals';
import { Model, View } from '~/models';
import { pickFields } from '~/utils/tsUtils';
import { viewActions } from '~/decorators/trace-command-descriptions';
import { overrideConflictingViewByTitle } from '~/command-registry/operations/shared/view-replay-conflict';
import {
  viewDeleteSchema,
  viewUpdateSchema,
} from '~/command-registry/operations/_schemas/view';

// Always-snapshotted fields — straight `pickFields`.
const VIEW_PREV_FIELDS = [
  'title',
  'order',
  'description',
  'show_system_fields',
  'lock_type',
  'meta',
  'row_coloring_mode',
  'fk_custom_url_id',
  'expanded_record_mode',
] as const satisfies readonly (keyof View)[];

// Snapshotted only when not `null` — null on these would round-trip as a
// permission-denying value, so skip the entry instead.
const VIEW_PREV_FIELDS_SKIP_NULL = [
  'uuid',
  'password',
  'attachment_mode_column_id',
] as const satisfies readonly (keyof View)[];

type ViewPrevState = Partial<
  Pick<
    View,
    | (typeof VIEW_PREV_FIELDS)[number]
    | (typeof VIEW_PREV_FIELDS_SKIP_NULL)[number]
    | 'fk_view_section_id'
  >
>;

interface ViewUpdateExtra {
  oldTitle?: string;
  prevView?: ViewPrevState;
}

export const ViewUpdateContract: OperationContract<
  typeof viewUpdateSchema,
  ViewUpdateExtra,
  View | undefined
> = {
  name: OperationName.viewUpdate,
  entity: MetaTable.VIEWS,
  schema: viewUpdateSchema,
  entry: {
    entity_id: (params) => params.viewId,
    entity_title: (params) => params.view?.title,
    parent_id: (_params, result) => result?.fk_model_id,
    description: (context) =>
      context.extra?.oldTitle && context.extra.oldTitle !== context.entityTitle
        ? viewActions.rename(context)
        : viewActions.edit(context),
    before: async (context, params) => {
      const view: View | undefined = await View.get(context, params.viewId);
      const table = view?.fk_model_id
        ? await Model.get(context, view.fk_model_id)
        : undefined;
      let prevView: ViewPrevState | undefined;
      if (view) {
        prevView = {
          ...pickFields(view, VIEW_PREV_FIELDS),
          // Read-undefined when no section assigned; explicit null clears
          // it on inverse instead of skipping.
          fk_view_section_id: view.fk_view_section_id ?? null,
        };
        // Strict-string columns — null would round-trip as a permission-
        // denying value, so omit the entry instead of writing null.
        for (const k of VIEW_PREV_FIELDS_SKIP_NULL) {
          const v = view[k];
          if (v != null) prevView[k] = v;
        }
      }
      return {
        entityTitle: view?.title,
        parentEntityTitle: table?.title,
        extra: {
          oldTitle: view?.title,
          prevView,
        },
      };
    },
  },
  undo: {
    inverse: (_context, params, _result, resolved) => {
      const prev = resolved?.extra?.prevView;
      if (!prev) return null;
      return {
        name: OperationName.viewUpdate,
        params: { viewId: params.viewId, view: prev },
      };
    },
    // Option-A dynamic scope. Sidebar-triggered renames (title only),
    // lock/unlock, and section moves land on the base stack so the user
    // can Cmd-Z from the sidebar. Any other body field (meta, expanded_
    // record_mode, etc.) is an in-view config change → view stack.
    scope: (params, _r, _resolved, context) =>
      dynamicScope(
        'viewUpdate',
        params.view as Record<string, unknown>,
        scopeBase(context),
        scopeView(params.viewId),
      ),
  },
};

export const ViewDeleteContract: OperationContract<
  typeof viewDeleteSchema,
  Record<string, any>,
  boolean
> = {
  name: OperationName.viewDelete,
  entity: MetaTable.VIEWS,
  schema: viewDeleteSchema,
  entry: {
    entity_id: (params) => params.viewId,
    description: viewActions.delete,
    before: async (context, params) => {
      const view = await View.get(context, params.viewId);
      const table = view?.fk_model_id
        ? await Model.get(context, view.fk_model_id)
        : undefined;
      return {
        entityTitle: view?.title,
        parentEntityTitle: table?.title,
      };
    },
  },
  undo: {
    inverse: (_context, params) => {
      if (params.skipTrash) return null;
      return {
        name: OperationName.trashRestore,
        params: { resourceType: 'view', resourceId: params.viewId },
      };
    },
    scope: (_p, _r, _c, context) => scopeBase(context),
  },
};

export function registerViewHandlers(svc: ViewsService): void {
  registerForward(ViewUpdateContract, async (context, params) => {
    const newTitle = params.view?.title?.trim();
    if (newTitle) {
      const target = await View.get(context, params.viewId);
      if (target && target.title !== newTitle) {
        await overrideConflictingViewByTitle(
          context,
          target.fk_model_id,
          newTitle,
          params.viewId,
        );
      }
    }
    return svc.viewUpdate(context, params);
  });
  registerForward(ViewDeleteContract, (context, params) =>
    svc.viewDelete(context, params),
  );
}
