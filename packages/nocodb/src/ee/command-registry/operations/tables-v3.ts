import type { z } from 'zod';
import type { TableV3Type, UserType } from 'nocodb-sdk';
import type { OperationContract } from '~/command-registry/types';
import type { TablesV3Service } from '~/services/v3/tables-v3.service';
import type { BaseTrashService } from '~/services/base-trash/base-trash.service';
import BaseTrash from '~/models/BaseTrash';
import { OperationName } from '~/command-registry/op-names';
import { OperationRegistry } from '~/command-registry/registry';
import { makeReplayReq } from '~/command-registry/replay-context';
import { scopeBase } from '~/command-registry/scope';
import { isReplay, setReplay } from '~/helpers/replayScope';
import { MetaTable } from '~/utils/globals';
import { tableActions } from '~/decorators/trace-command-descriptions';
import { tableV3CreateSchema } from '~/command-registry/operations/_schemas/table';

export const TableV3CreateContract: OperationContract<
  typeof tableV3CreateSchema,
  Record<string, any>,
  TableV3Type | undefined
> = {
  name: OperationName.tableV3Create,
  entity: MetaTable.MODELS,
  schema: tableV3CreateSchema,
  entry: {
    entity_id: (_params, result) => result?.id,
    entity_title: (params, result) =>
      result?.title ?? params.table?.title ?? params.table?.table_name,
    parent_id: (params) => params.baseId,
    description: tableActions.add,
  },
  capture: ['sandboxColumns', 'sandboxDefaultViewId'],
  sandbox: {
    id_field: 'table',
  },
  undo: {
    inverse: (_context, _params, result) => {
      if (!result?.id) return null;
      return {
        name: OperationName.tableDelete,
        params: { tableId: result.id },
      };
    },
    scope: (_p, _r, _c, context) => scopeBase(context),
  },
};

type TableV3CreateParams = z.infer<typeof tableV3CreateSchema>;
type TableV3Field = NonNullable<TableV3CreateParams['table']['fields']>[number];

export function registerTablesV3Handlers(
  svc: TablesV3Service,
  baseTrashSvc: BaseTrashService,
): void {
  OperationRegistry.register(
    TableV3CreateContract,
    async (context, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);

      if (isReplay() && meta.entityId) {
        const trashEntry = await BaseTrash.getByResourceId(
          context,
          'table',
          meta.entityId,
        );
        if (trashEntry?.id) {
          await baseTrashSvc.restore(context, {
            trashId: trashEntry.id,
            user: req.user,
            req,
          });
          return { id: meta.entityId };
        }
      }

      const sandboxColumns = meta.extra?.sandboxColumns;

      // Clone so we don't mutate the inbound `params` reference. `fields`
      // gets rewritten with replay-injected ids on each row.
      const replayParams: TableV3CreateParams = { ...params };
      let colIdMap: Record<string, string> | undefined;
      if (sandboxColumns?.length && replayParams.table) {
        colIdMap = {};
        for (const c of sandboxColumns) {
          if (c.id && c.title) colIdMap[c.title] = c.id;
        }

        const sourceFields = replayParams.table.fields;
        const fields = Array.isArray(sourceFields)
          ? sourceFields.map((f: TableV3Field) => {
              const title = f?.title ?? f?.name;
              const mapped = title ? colIdMap![title] : undefined;
              return mapped && !f.id ? { ...f, id: mapped } : f;
            })
          : sourceFields;

        if (fields) {
          replayParams.table = { ...replayParams.table, fields };
        }
      }

      if (colIdMap) setReplay('sandboxColumnIds', colIdMap);
      const sandboxDefaultViewId = meta.extra?.sandboxDefaultViewId;
      if (sandboxDefaultViewId) {
        setReplay('sandboxDefaultViewId', sandboxDefaultViewId);
      }
      return svc.tableCreate(context, {
        baseId: replayParams.baseId,
        table: replayParams.table,
        sourceId: replayParams.sourceId,
        user: req.user as UserType,
        req,
      } as unknown as Parameters<typeof svc.tableCreate>[1]);
    },
  );
}
