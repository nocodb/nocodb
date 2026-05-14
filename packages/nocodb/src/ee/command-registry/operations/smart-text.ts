import type { OperationContract } from '~/command-registry/types';
import type { SmartTextGetResult } from 'src/services/smart-text.service';
import type { SmartTextService } from '~/services/smart-text.service';
import type { ProseMirrorDoc } from 'nocodb-sdk';
import { OperationName } from '~/command-registry/op-names';
import { registerForward } from '~/command-registry/replay-context';
import { scopeTable } from '~/command-registry/scope';
import { MetaTable } from '~/utils/globals';
import { Column, Model } from '~/models';
import { smartTextActions } from '~/decorators/trace-command-descriptions';
import { smartTextUpdateContentSchema } from '~/command-registry/operations/_schemas/smart-text';
import Noco from '~/Noco';
import { SmartTextService as SmartTextServiceCls } from '~/services/smart-text.service';

interface SmartTextUpdateContentExtra {
  fieldTitle?: string;
  prevPm?: ProseMirrorDoc | null;
}

const EMPTY_PM_DOC: ProseMirrorDoc = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
} as ProseMirrorDoc;

export const SmartTextUpdateContentContract: OperationContract<
  typeof smartTextUpdateContentSchema,
  SmartTextUpdateContentExtra,
  SmartTextGetResult
> = {
  name: OperationName.smartTextUpdateContent,
  entity: MetaTable.MODELS,
  schema: smartTextUpdateContentSchema,
  sandbox: false,
  entry: {
    entity_id: (params) => params.columnId,
    // `entity_title` falls back to `resolved.entityTitle` set in `before`.
    parent_id: (params) => params.tableId,
    description: smartTextActions.update,
    before: async (context, params) => {
      const model = await Model.get(context, params.tableId);
      const column = await Column.get(context, { colId: params.columnId });
      const svc: SmartTextService = Noco.nestApp.get(SmartTextServiceCls);
      const prev = await svc.getContent(context, {
        tableId: params.tableId,
        rowId: params.rowId,
        columnId: params.columnId,
        readOnly: true,
      });
      return {
        parentEntityTitle: model?.title,
        entityTitle: column?.title,
        extra: {
          fieldTitle: column?.title,
          prevPm: prev?.pm ?? null,
        },
      };
    },
  },
  undo: {
    inverse: (_ctx, params, _result, resolved) => {
      if (resolved?.extra?.prevPm === undefined) return null;
      const restoreTo = resolved.extra.prevPm ?? EMPTY_PM_DOC;
      return {
        name: OperationName.smartTextUpdateContent,
        params: {
          tableId: params.tableId,
          rowId: params.rowId,
          columnId: params.columnId,
          pmContent: restoreTo,
        },
      };
    },
    scope: (params) => scopeTable(params.tableId),
  },
};

export function registerSmartTextHandlers(svc: SmartTextService): void {
  registerForward(SmartTextUpdateContentContract, (context, params) =>
    svc.updateContent(context, params),
  );
}
