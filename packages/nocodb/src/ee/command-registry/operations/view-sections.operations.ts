import { z } from 'zod';
import type { OperationContract } from 'src/command-registry/_types';
import { OperationName } from '~/command-registry/_op-names';
import { MetaTable } from '~/utils/globals';
import { ViewSection } from '~/models';
import { viewSectionActions } from '~/decorators/trace-command-descriptions';

const createSchema = z.object({
  viewId: z.string(),
  section: z
    .object({
      title: z.string().optional(),
      order: z.number().optional(),
      meta: z.record(z.any()).optional(),
    })
    .passthrough(),
});

export const ViewSectionCreateContract: OperationContract<typeof createSchema> =
  {
    name: OperationName.viewSectionCreate,
    version: 1,
    entity: MetaTable.VIEW_SECTIONS,
    schema: createSchema,
    idField: 'section',
    entityId: 'id',
    entityTitle: 'title',
    description: viewSectionActions.add,
  };

const updateSchema = z.object({
  viewSectionId: z.string(),
  section: z
    .object({
      title: z.string().optional(),
      order: z.number().optional(),
      meta: z.record(z.any()).optional(),
    })
    .passthrough()
    .optional(),
});

export const ViewSectionUpdateContract: OperationContract<typeof updateSchema> =
  {
    name: OperationName.viewSectionUpdate,
    version: 1,
    entity: MetaTable.VIEW_SECTIONS,
    schema: updateSchema,
    entityId: (p) => p.viewSectionId,
    entityTitle: (p) => p.section?.title,
    description: (ctx) =>
      ctx.extra?.oldTitle && ctx.extra.oldTitle !== ctx.entityTitle
        ? viewSectionActions.rename(ctx)
        : viewSectionActions.edit(ctx),
    resolveCtx: async (context, param) => {
      const section = await ViewSection.get(context, param.viewSectionId);
      return { extra: { oldTitle: section?.title } };
    },
  };

const deleteSchema = z.object({
  viewSectionId: z.string(),
});

export const ViewSectionDeleteContract: OperationContract<typeof deleteSchema> =
  {
    name: OperationName.viewSectionDelete,
    version: 1,
    entity: MetaTable.VIEW_SECTIONS,
    schema: deleteSchema,
    entityId: (p) => p.viewSectionId,
    description: viewSectionActions.delete,
    resolveCtx: async (context, param) => {
      const section = await ViewSection.get(context, param.viewSectionId);
      return { entityTitle: section?.title };
    },
  };
