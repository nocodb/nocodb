import { z } from 'zod';
import type { OperationContract } from '~/command-registry/types';
import type { MetaService } from '~/meta/meta.service';
import type { ViewSectionsService } from '~/services/view-sections.service';
import { OperationName } from '~/command-registry/op-names';
import { OperationRegistry } from '~/command-registry/registry';
import { captureForTrace } from '~/decorators/trace-command.decorator';
import {
  makeReplayReq,
  registerForward,
} from '~/command-registry/replay-context';
import { isReplay, setReplay } from '~/helpers/replayScope';
import { MetaTable } from '~/utils/globals';
import { ViewSection } from '~/models';
import { pickFields } from '~/utils/tsUtils';
import { viewSectionActions } from '~/decorators/trace-command-descriptions';
import Noco from '~/Noco';
import {
  viewSectionCreateSchema,
  viewSectionDeleteSchema,
  viewSectionUpdateSchema,
} from '~/command-registry/operations/_schemas/view-section';

export const ViewSectionCreateContract: OperationContract<
  typeof viewSectionCreateSchema,
  Record<string, any>,
  ViewSection | undefined
> = {
  name: OperationName.viewSectionCreate,
  entity: MetaTable.VIEW_SECTIONS,
  schema: viewSectionCreateSchema,
  entry: {
    entity_id: 'id',
    entity_title: 'title',
    description: viewSectionActions.add,
  },
  sandbox: { id_field: 'section' },
  undo: {
    inverse: (_context, _params, result) => {
      if (!result?.id) return null;
      return {
        name: OperationName.viewSectionDelete,
        params: { viewSectionId: result.id },
      };
    },
  },
};

const VIEW_SECTION_PREV_FIELDS = [
  'title',
  'order',
  'meta',
] as const satisfies readonly (keyof ViewSection)[];

type ViewSectionPrev = Pick<
  ViewSection,
  (typeof VIEW_SECTION_PREV_FIELDS)[number]
>;

interface ViewSectionUpdateExtra {
  oldTitle?: string;
  prev?: ViewSectionPrev;
}

export const ViewSectionUpdateContract: OperationContract<
  typeof viewSectionUpdateSchema,
  ViewSectionUpdateExtra,
  ViewSection | undefined
> = {
  name: OperationName.viewSectionUpdate,
  entity: MetaTable.VIEW_SECTIONS,
  schema: viewSectionUpdateSchema,
  entry: {
    entity_id: (params) => params.viewSectionId,
    entity_title: (params) => params.section?.title,
    description: (context) =>
      context.extra?.oldTitle && context.extra.oldTitle !== context.entityTitle
        ? viewSectionActions.rename(context)
        : viewSectionActions.edit(context),
    before: async (context, params) => {
      const section = await ViewSection.get(context, params.viewSectionId);
      if (!section) return {};
      return {
        extra: {
          oldTitle: section.title,
          prev: pickFields(section, VIEW_SECTION_PREV_FIELDS),
        },
      };
    },
  },
  undo: {
    inverse: (_context, params, _result, resolved) => {
      const prev = resolved?.extra?.prev;
      if (!prev) return null;
      return {
        name: OperationName.viewSectionUpdate,
        params: { viewSectionId: params.viewSectionId, section: prev },
      };
    },
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
}

/** Validates `meta.extra.viewSectionViewIds` before persistence. Strict. */
const viewSectionDeleteCaptureSchema = z
  .object({
    viewSectionViewIds: z.array(z.string()).optional(),
  })
  .strict()
  .optional();

export const ViewSectionDeleteContract: OperationContract<
  typeof viewSectionDeleteSchema,
  ViewSectionDeleteExtra,
  boolean
> = {
  name: OperationName.viewSectionDelete,
  entity: MetaTable.VIEW_SECTIONS,
  schema: viewSectionDeleteSchema,
  entry: {
    entity_id: (params) => params.viewSectionId,
    description: viewSectionActions.delete,
    before: async (context, params) => {
      const section = await ViewSection.get(context, params.viewSectionId);
      if (!section) return {};
      const ncMeta: MetaService = Noco.ncMeta;
      const viewsInSection = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.VIEWS,
        { condition: { fk_view_section_id: params.viewSectionId } },
      );
      // Capture pre-delete view ids — persisted to `meta.extra.viewSectionViewIds`
      // so the inverse-of-delete (viewSectionCreate) can re-link them when
      // the section is recreated. Same pattern as LTAR's `ltar` capture.
      const viewIds = viewsInSection.map((v: { id: string }) => v.id);
      if (viewIds.length) {
        captureForTrace('viewSectionViewIds', viewIds);
      }
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
        },
      };
    },
  },
  capture: ['viewSectionViewIds'],
  capture_schema: viewSectionDeleteCaptureSchema,
  undo: {
    inverse: (_context, _params, _result, resolved) => {
      const prev = resolved?.extra?.prev;
      if (!prev?.id || !prev?.fk_model_id) return null;
      return {
        name: OperationName.viewSectionCreate,
        params: {
          tableId: prev.fk_model_id,
          section: {
            id: prev.id,
            title: prev.title,
            order: prev.order,
            meta: prev.meta,
          },
        },
      };
    },
  },
};

export function registerViewSectionHandlers(svc: ViewSectionsService): void {
  OperationRegistry.register(
    ViewSectionCreateContract,
    async (context, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      const restoreViewIds = meta.extra?.viewSectionViewIds;
      if (isReplay() && restoreViewIds?.length) {
        setReplay('viewSectionRestoreViewIds', restoreViewIds);
      }
      return svc.viewSectionCreate(context, {
        tableId: params.tableId,
        section: params.section,
        req,
      } as Parameters<typeof svc.viewSectionCreate>[1]);
    },
  );
  registerForward(ViewSectionUpdateContract, (context, params) =>
    svc.viewSectionUpdate(context, params),
  );
  registerForward(ViewSectionDeleteContract, (context, params) =>
    svc.viewSectionDelete(context, params),
  );
}
