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

interface ViewUpdatePrevState {
  title?: string;
  order?: number;
  lock_type?: string;
  meta?: unknown;
  show_system_fields?: boolean;
}

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
    return {
      entityTitle: view?.title,
      parentEntityTitle: table?.title,
      extra: {
        oldTitle: view?.title,
        prevView: view
          ? {
              title: view.title,
              order: view.order,
              lock_type: view.lock_type,
              meta: view.meta,
              show_system_fields: view.show_system_fields as
                | boolean
                | undefined,
            }
          : undefined,
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
