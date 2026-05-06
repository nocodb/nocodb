import type { OperationContract } from '~/command-registry/types';
import type { RecordTemplatesService } from '~/services/record-templates/record-templates.service';
import { OperationName } from '~/command-registry/op-names';
import { registerForward } from '~/command-registry/replay-context';
import { MetaTable } from '~/utils/globals';
import RecordTemplate from '~/models/RecordTemplate';
import { pickFields } from '~/utils/tsUtils';
import { recordTemplateActions } from '~/decorators/trace-command-descriptions';
import {
  recordTemplateCreateSchema,
  recordTemplateDeleteSchema,
  recordTemplateUpdateSchema,
} from '~/command-registry/operations/_schemas/record-templates';

const RECORD_TEMPLATE_PREV_FIELDS = [
  'title',
  'description',
  'template_data',
  'enabled',
] as const satisfies readonly (keyof RecordTemplate)[];

type RecordTemplatePrev = Pick<
  RecordTemplate,
  (typeof RECORD_TEMPLATE_PREV_FIELDS)[number]
>;

interface RecordTemplateUpdateExtra {
  oldTitle?: string;
  prev?: RecordTemplatePrev;
}

export const RecordTemplateCreateContract: OperationContract<
  typeof recordTemplateCreateSchema,
  Record<string, any>,
  RecordTemplate | undefined
> = {
  name: OperationName.recordTemplateCreate,
  entity: MetaTable.RECORD_TEMPLATES,
  schema: recordTemplateCreateSchema,
  entry: {
    entity_id: 'id',
    entity_title: 'title',
    description: recordTemplateActions.add,
  },
  sandbox: { id_field: 'body' },
  undo: {
    inverse: (_context, params, result) => {
      if (!result?.id) return null;
      return {
        name: OperationName.recordTemplateDelete,
        params: { templateId: result.id, userId: params.userId },
      };
    },
  },
};

export const RecordTemplateUpdateContract: OperationContract<
  typeof recordTemplateUpdateSchema,
  RecordTemplateUpdateExtra,
  RecordTemplate | undefined
> = {
  name: OperationName.recordTemplateUpdate,
  entity: MetaTable.RECORD_TEMPLATES,
  schema: recordTemplateUpdateSchema,
  entry: {
    entity_id: (params) => params.templateId,
    entity_title: (params) => params.template?.title,
    description: (context) =>
      context.extra?.oldTitle && context.extra.oldTitle !== context.entityTitle
        ? recordTemplateActions.rename(context)
        : recordTemplateActions.edit(context),
    before: async (context, params) => {
      const template = await RecordTemplate.get(context, params.templateId);
      if (!template) return {};
      return {
        extra: {
          oldTitle: template.title,
          prev: pickFields(template, RECORD_TEMPLATE_PREV_FIELDS),
        },
      };
    },
  },
  undo: {
    inverse: (_context, params, _result, resolved) => {
      const prev = resolved?.extra?.prev;
      if (!prev) return null;
      return {
        name: OperationName.recordTemplateUpdate,
        params: {
          templateId: params.templateId,
          template: prev,
          userId: params.userId,
        },
      };
    },
  },
};

const RECORD_TEMPLATE_DELETE_FIELDS = [
  'id',
  'base_id',
  'fk_model_id',
  'title',
  'description',
  'template_data',
  'enabled',
  'created_by',
] as const satisfies readonly (keyof RecordTemplate)[];

type RecordTemplateDeleteSnapshot = Pick<
  RecordTemplate,
  (typeof RECORD_TEMPLATE_DELETE_FIELDS)[number]
>;

interface RecordTemplateDeleteExtra {
  prev?: RecordTemplateDeleteSnapshot;
}

export const RecordTemplateDeleteContract: OperationContract<
  typeof recordTemplateDeleteSchema,
  RecordTemplateDeleteExtra,
  { success: true } | undefined
> = {
  name: OperationName.recordTemplateDelete,
  entity: MetaTable.RECORD_TEMPLATES,
  schema: recordTemplateDeleteSchema,
  entry: {
    entity_id: (params) => params.templateId,
    description: recordTemplateActions.delete,
    before: async (context, params) => {
      const template = await RecordTemplate.get(context, params.templateId);
      if (!template) return {};
      return {
        entityTitle: template.title,
        extra: {
          prev: pickFields(template, RECORD_TEMPLATE_DELETE_FIELDS),
        },
      };
    },
  },
  undo: {
    inverse: (_context, params, _result, resolved) => {
      const prev = resolved?.extra?.prev;
      if (!prev?.id || !prev?.base_id || !prev?.fk_model_id) return null;
      return {
        name: OperationName.recordTemplateCreate,
        params: {
          baseId: prev.base_id,
          tableId: prev.fk_model_id,
          body: {
            id: prev.id,
            title: prev.title,
            description: prev.description,
            template_data: prev.template_data,
            enabled: prev.enabled,
          },
          userId: prev.created_by ?? params.userId,
        },
      };
    },
  },
};

export function registerRecordTemplateHandlers(
  svc: RecordTemplatesService,
): void {
  registerForward(RecordTemplateCreateContract, (context, params) =>
    svc.recordTemplateCreate(context, params),
  );
  registerForward(RecordTemplateUpdateContract, (context, params) =>
    svc.recordTemplateUpdate(context, params),
  );
  registerForward(RecordTemplateDeleteContract, (context, params) =>
    svc.recordTemplateDelete(context, params),
  );
}
