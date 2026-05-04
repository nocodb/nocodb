import { z } from 'zod';
import type { OperationContract } from 'src/command-registry/types';
import { OperationName } from '~/command-registry/op-names';
import { MetaTable } from '~/utils/globals';
import { Model, View } from '~/models';
import { viewActions } from '~/decorators/trace-command-descriptions';

const viewUpdateBodySchema = z
  .object({
    title: z.string().optional(),
    order: z.number().optional(),
    lock_type: z.string().optional(),
    meta: z.record(z.any()).optional(),
    password: z.string().optional(),
    show_system_fields: z.boolean().optional(),
    heading: z.string().optional(),
    subheading: z.string().optional(),
    success_msg: z.string().optional(),
    redirect_url: z.string().optional(),
    redirect_after_secs: z.string().optional(),
    email: z.string().optional(),
    submit_another_form: z.boolean().optional(),
    show_blank_form: z.boolean().optional(),
    logo: z.string().nullable().optional(),
    cover: z.string().nullable().optional(),
    banner_image_url: z.string().nullable().optional(),
    logo_url: z.string().nullable().optional(),
    background_color: z.string().optional(),
    time_zone: z.string().optional(),
  })
  .passthrough();

const updateSchema = z.object({
  viewId: z.string(),
  view: viewUpdateBodySchema,
});

const VIEW_PREV_FIELDS = [
  'title',
  'order',
  'description',
  'show_system_fields',
  'lock_type',
  'password',
  'meta',
  'uuid',
  'row_coloring_mode',
  'fk_custom_url_id',
  'fk_view_section_id',
  'expanded_record_mode',
  'attachment_mode_column_id',
] as const;

interface ViewUpdatePrevState
  extends Partial<Record<(typeof VIEW_PREV_FIELDS)[number], unknown>> {}

interface ViewUpdateExtra {
  oldTitle?: string;
  prevView?: ViewUpdatePrevState;
}

export const ViewUpdateContract: OperationContract<
  typeof updateSchema,
  ViewUpdateExtra
> = {
  name: OperationName.viewUpdate,
  version: 1,
  entity: MetaTable.VIEWS,
  schema: updateSchema,
  entityId: (p) => p.viewId,
  entityTitle: (p) => p.view?.title,
  parentId: (_p, r) => r?.fk_model_id,
  description: (ctx) =>
    ctx.extra?.oldTitle && ctx.extra.oldTitle !== ctx.entityTitle
      ? viewActions.rename(ctx)
      : viewActions.edit(ctx),
  resolveCtx: async (context, param) => {
    const view = await View.get(context, param.viewId);
    const table = view?.fk_model_id
      ? await Model.get(context, view.fk_model_id)
      : undefined;
    let prevView: ViewUpdatePrevState | undefined;
    if (view) {
      const src = view as unknown as Record<string, unknown>;
      prevView = {};
      for (const k of VIEW_PREV_FIELDS) (prevView as any)[k] = src[k];
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
  buildInverse: (_ctx, p, _r, resolved) => {
    const prev = resolved?.extra?.prevView;
    if (!prev) return null;
    return {
      name: OperationName.viewUpdate,
      version: 1,
      params: { viewId: p.viewId, view: prev },
    };
  },
};

const deleteSchema = z.object({
  viewId: z.string(),
  skipTrash: z.boolean().optional(),
});

export const ViewDeleteContract: OperationContract<typeof deleteSchema> = {
  name: OperationName.viewDelete,
  version: 1,
  entity: MetaTable.VIEWS,
  schema: deleteSchema,
  entityId: (p) => p.viewId,
  description: viewActions.delete,
  resolveCtx: async (context, param) => {
    const view = await View.get(context, param.viewId);
    const table = view?.fk_model_id
      ? await Model.get(context, view.fk_model_id)
      : undefined;
    return {
      entityTitle: view?.title,
      parentEntityTitle: table?.title,
    };
  },
  buildInverse: (_ctx, p) => {
    if (p.skipTrash) return null;
    return {
      name: OperationName.trashRestore,
      version: 1,
      params: { resourceType: 'view', resourceId: p.viewId },
    };
  },
};
