import { z } from 'zod';
import type { OperationContract } from 'src/command-registry/types';
import { OperationName } from '~/command-registry/op-names';
import { MetaTable } from '~/utils/globals';
import RecordTemplate from '~/models/RecordTemplate';
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
  name: OperationName.recordTemplateCreate,
  version: 1,
  entity: MetaTable.RECORD_TEMPLATES,
  schema: createSchema,
  idField: 'body',
  entityId: 'id',
  entityTitle: 'title',
  description: recordTemplateActions.add,
  buildInverse: (_ctx, p, r) => {
    const newId = (r as { id?: string } | undefined)?.id;
    if (!newId) return null;
    return {
      name: OperationName.recordTemplateDelete,
      version: 1,
      params: { templateId: newId, userId: p.userId },
    };
  },
};

const RECORD_TEMPLATE_PREV_FIELDS = [
  'title',
  'description',
  'template_data',
  'enabled',
] as const;

interface RecordTemplateUpdateExtra {
  oldTitle?: string;
  prev?: Partial<
    Record<(typeof RECORD_TEMPLATE_PREV_FIELDS)[number], unknown>
  >;
}

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
  typeof updateSchema,
  RecordTemplateUpdateExtra
> = {
  name: OperationName.recordTemplateUpdate,
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
    if (!template) return {};
    const src = template as unknown as Record<string, unknown>;
    const prev: Record<string, unknown> = {};
    for (const k of RECORD_TEMPLATE_PREV_FIELDS) prev[k] = src[k];
    return { extra: { oldTitle: template.title, prev } };
  },
  buildInverse: (_ctx, p, _r, resolved) => {
    const prev = resolved?.extra?.prev;
    if (!prev) return null;
    return {
      name: OperationName.recordTemplateUpdate,
      version: 1,
      params: {
        templateId: p.templateId,
        template: prev as any,
        userId: p.userId,
      },
    };
  },
};

interface RecordTemplateDeleteExtra {
  prev?: {
    id: string;
    base_id: string;
    fk_model_id: string;
    title?: string;
    description?: string;
    template_data?: unknown;
    enabled?: boolean;
    created_by?: string;
  };
}

const deleteSchema = z.object({
  templateId: z.string(),
  userId: z.string(),
});

export const RecordTemplateDeleteContract: OperationContract<
  typeof deleteSchema,
  RecordTemplateDeleteExtra
> = {
  name: OperationName.recordTemplateDelete,
  version: 1,
  entity: MetaTable.RECORD_TEMPLATES,
  schema: deleteSchema,
  entityId: (p) => p.templateId,
  description: recordTemplateActions.delete,
  resolveCtx: async (context, param) => {
    const template = await RecordTemplate.get(context, param.templateId);
    if (!template) return {};
    return {
      entityTitle: template.title,
      extra: {
        prev: {
          id: template.id,
          base_id: template.base_id,
          fk_model_id: template.fk_model_id,
          title: template.title,
          description: template.description,
          template_data: template.template_data,
          enabled: template.enabled,
          created_by: template.created_by,
        },
      },
    };
  },
  buildInverse: (_ctx, p, _r, resolved) => {
    const prev = resolved?.extra?.prev;
    if (!prev?.id || !prev?.base_id || !prev?.fk_model_id) return null;
    return {
      name: OperationName.recordTemplateCreate,
      version: 1,
      params: {
        baseId: prev.base_id,
        tableId: prev.fk_model_id,
        body: {
          id: prev.id,
          title: prev.title,
          description: prev.description,
          template_data: prev.template_data,
          enabled: prev.enabled,
        } as any,
        userId: prev.created_by ?? p.userId,
      },
    };
  },
};
