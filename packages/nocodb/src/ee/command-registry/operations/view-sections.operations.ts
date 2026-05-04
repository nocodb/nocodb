import { z } from 'zod';
import type { OperationContract } from 'src/command-registry/types';
import type { MetaService } from '~/meta/meta.service';
import { OperationName } from '~/command-registry/op-names';
import { MetaTable } from '~/utils/globals';
import { ViewSection } from '~/models';
import { viewSectionActions } from '~/decorators/trace-command-descriptions';
import Noco from '~/Noco';

const createSchema = z.object({
  tableId: z.string(),
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
    buildInverse: (_ctx, _p, r) => {
      const newId = (r as { id?: string } | undefined)?.id;
      if (!newId) return null;
      return {
        name: OperationName.viewSectionDelete,
        version: 1,
        params: { viewSectionId: newId },
      };
    },
  };

const VIEW_SECTION_PREV_FIELDS = ['title', 'order', 'meta'] as const;

interface ViewSectionUpdateExtra {
  oldTitle?: string;
  prev?: Partial<Record<(typeof VIEW_SECTION_PREV_FIELDS)[number], unknown>>;
}

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

export const ViewSectionUpdateContract: OperationContract<
  typeof updateSchema,
  ViewSectionUpdateExtra
> = {
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
    if (!section) return {};
    const src = section as unknown as Record<string, unknown>;
    const prev: Record<string, unknown> = {};
    for (const k of VIEW_SECTION_PREV_FIELDS) prev[k] = src[k];
    return { extra: { oldTitle: section.title, prev } };
  },
  buildInverse: (_ctx, p, _r, resolved) => {
    const prev = resolved?.extra?.prev;
    if (!prev) return null;
    return {
      name: OperationName.viewSectionUpdate,
      version: 1,
      params: { viewSectionId: p.viewSectionId, section: prev as any },
    };
  },
};

interface ViewSectionDeleteExtra {
  prev?: {
    id: string;
    fk_model_id: string;
    title?: string;
    order?: number;
    meta?: unknown;
  };
  viewIds?: string[];
}

const deleteSchema = z.object({
  viewSectionId: z.string(),
});

export const ViewSectionDeleteContract: OperationContract<
  typeof deleteSchema,
  ViewSectionDeleteExtra
> = {
  name: OperationName.viewSectionDelete,
  version: 1,
  entity: MetaTable.VIEW_SECTIONS,
  schema: deleteSchema,
  entityId: (p) => p.viewSectionId,
  description: viewSectionActions.delete,
  resolveCtx: async (context, param) => {
    const section = await ViewSection.get(context, param.viewSectionId);
    if (!section) return {};
    const ncMeta: MetaService = Noco.ncMeta;
    const viewsInSection = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.VIEWS,
      { condition: { fk_view_section_id: param.viewSectionId } },
    );
    return {
      entityTitle: section.title,
      extra: {
        prev: {
          id: section.id,
          fk_model_id: section.fk_model_id,
          title: section.title,
          order: section.order,
          meta: section.meta,
        },
        viewIds: viewsInSection.map((v: { id: string }) => v.id),
      },
    };
  },
  buildInverse: (_ctx, _p, _r, resolved) => {
    const prev = resolved?.extra?.prev;
    if (!prev?.id || !prev?.fk_model_id) return null;
    const restoreViewIds = resolved?.extra?.viewIds ?? [];
    return {
      name: OperationName.viewSectionCreate,
      version: 1,
      params: {
        tableId: prev.fk_model_id,
        section: {
          id: prev.id,
          title: prev.title,
          order: prev.order,
          meta: prev.meta,
          ...(restoreViewIds.length ? { _restoreViewIds: restoreViewIds } : {}),
        },
      },
    };
  },
};
