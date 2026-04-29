import { z } from 'zod';
import { MetaTable } from '~/utils/globals';
import RecordTemplate from '~/models/RecordTemplate';
import type { OperationContract } from 'src/command-registry/_types';
import { recordTemplateActions } from '~/decorators/trace-command-descriptions';

const createSchema = z.object({
  baseId: z.string(),
  tableId: z.string(),
  body: z
    .object({
      title: z.string().optional(),
      description: z.string().optional(),
      template_data: z.record(z.any()).optional(),
    })
    .passthrough(),
  userId: z.string(),
});

export const RecordTemplateCreateContract: OperationContract<
  typeof createSchema
> = {
  name: 'recordTemplateCreate',
  version: 1,
  entity: MetaTable.RECORD_TEMPLATES,
  schema: createSchema,
  idField: 'body',
  entityId: 'id',
  entityTitle: 'title',
  description: recordTemplateActions.add,
};

const updateSchema = z.object({
  templateId: z.string(),
  template: z
    .object({
      title: z.string().optional(),
      description: z.string().optional(),
      template_data: z.record(z.any()).optional(),
      enabled: z.boolean().optional(),
    })
    .passthrough()
    .optional(),
  userId: z.string(),
});

export const RecordTemplateUpdateContract: OperationContract<
  typeof updateSchema
> = {
  name: 'recordTemplateUpdate',
  version: 1,
  entity: MetaTable.RECORD_TEMPLATES,
  schema: updateSchema,
  entityId: (p) => p.templateId,
  entityTitle: (p) => p.template?.title,
  description: (ctx) =>
    ctx.extra?.oldTitle && ctx.extra.oldTitle !== ctx.entityTitle
      ? recordTemplateActions.rename(ctx)
      : recordTemplateActions.edit(ctx),
  resolveCtx: async (context, param) => {
    const template = await RecordTemplate.get(context, param.templateId);
    return { extra: { oldTitle: template?.title } };
  },
};

const deleteSchema = z.object({
  templateId: z.string(),
  userId: z.string(),
});

export const RecordTemplateDeleteContract: OperationContract<
  typeof deleteSchema
> = {
  name: 'recordTemplateDelete',
  version: 1,
  entity: MetaTable.RECORD_TEMPLATES,
  schema: deleteSchema,
  entityId: (p) => p.templateId,
  description: recordTemplateActions.delete,
  resolveCtx: async (context, param) => {
    const template = await RecordTemplate.get(context, param.templateId);
    return { entityTitle: template?.title };
  },
};
