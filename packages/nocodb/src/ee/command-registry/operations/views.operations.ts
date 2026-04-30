import { z } from 'zod';
import type { OperationContract } from 'src/command-registry/types';
import { OperationName } from '~/command-registry/op-names';
import { MetaTable } from '~/utils/globals';
import { Model, View } from '~/models';
import {
  shareViewActions,
  viewActions,
} from '~/decorators/trace-command-descriptions';

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

export const ViewUpdateContract: OperationContract<typeof updateSchema> = {
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
      extra: { oldTitle: view?.title },
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
};

const shareViewSchema = z.object({
  viewId: z.string(),
});

export const ShareViewContract: OperationContract<typeof shareViewSchema> = {
  name: OperationName.shareView,
  version: 1,
  entity: MetaTable.VIEWS,
  schema: shareViewSchema,
  entityId: (p) => p.viewId,
  description: shareViewActions.create,
};

const sharedViewBodySchema = z
  .object({
    password: z.string().nullable().optional(),
    allow_comments: z.boolean().optional(),
    meta: z.record(z.any()).optional(),
    custom_url_path: z.string().optional(),
  })
  .passthrough();

const shareViewUpdateSchema = z.object({
  viewId: z.string(),
  sharedView: sharedViewBodySchema,
});

export const ShareViewUpdateContract: OperationContract<
  typeof shareViewUpdateSchema
> = {
  name: OperationName.shareViewUpdate,
  version: 1,
  entity: MetaTable.VIEWS,
  schema: shareViewUpdateSchema,
  entityId: (p) => p.viewId,
  description: shareViewActions.update,
};

const shareViewDeleteSchema = z.object({
  viewId: z.string(),
});

export const ShareViewDeleteContract: OperationContract<
  typeof shareViewDeleteSchema
> = {
  name: OperationName.shareViewDelete,
  version: 1,
  entity: MetaTable.VIEWS,
  schema: shareViewDeleteSchema,
  entityId: (p) => p.viewId,
  description: shareViewActions.delete,
};
