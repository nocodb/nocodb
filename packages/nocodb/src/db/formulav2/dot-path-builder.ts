import { getMemberPath, isLinksOrLTAR, UITypes } from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import type CustomKnex from '~/db/CustomKnex';
import type {
  FormulaQueryBuilderBaseParams,
  TAliasToColumnParam,
} from '~/db/formulav2/formula-query-builder.types';
import type { LinkToAnotherRecordColumn } from '~/models';
import { DOT_PATH_COLUMN_PREFIX } from '~/db/formulav2/dot-path-column';
import { lookupOrLtarBuilder } from '~/db/formulav2/lookup-or-ltar-builder';
import { NcError } from '~/helpers/catchError';
import { Column, LookupColumn } from '~/models';

/**
 * Resolves `{link}.{link}.{field}` ids to columns, hop by hop. The path was
 * validated on save, so a miss here means a field was deleted or changed since.
 */
export async function resolveDotPathColumns(
  context: NcContext,
  columns: Column[],
  ids: string[],
): Promise<Column[]> {
  const resolved: Column[] = [];
  let hopColumns = columns;

  for (let i = 0; i < ids.length; i++) {
    const column = hopColumns.find((c) => c.id === ids[i]);
    if (!column) {
      NcError.get(context).formulaError(
        `Field ${ids[i]} referenced in a field path is no longer available`,
      );
    }
    resolved.push(column);
    if (i === ids.length - 1) break;

    if (!isLinksOrLTAR(column)) {
      NcError.get(context).formulaError(
        `Field ${column.title} is not a link, so "." cannot follow it`,
      );
    }
    const relation = await column.getColOptions<LinkToAnotherRecordColumn>();
    const relatedTable = await relation.getRelatedTable();
    hopColumns = await relatedTable.getColumns();
  }

  return resolved;
}

/** Nests in-memory lookups so the existing multi-hop lookup SQL applies */
export function buildDotPathLookupColumn(path: Column[]): Column {
  let target = path[path.length - 1];

  for (let i = path.length - 2; i >= 0; i--) {
    const relationColumn = path[i];
    const id = `${DOT_PATH_COLUMN_PREFIX}${path
      .slice(i)
      .map((c) => c.id)
      .join('_')}`;
    const scope = {
      fk_workspace_id: relationColumn.fk_workspace_id,
      base_id: relationColumn.base_id,
    };

    const lookupColumn = target;

    // Relation and target are already resolved, so the lookup builder never
    // reads meta rows for these in-memory columns
    const lookupOptions = Object.assign(
      new LookupColumn({
        ...scope,
        fk_column_id: id,
        fk_relation_column_id: relationColumn.id,
        fk_lookup_column_id: target.id,
      }),
      {
        getRelationColumn: async () => relationColumn,
        getLookupColumn: async () => lookupColumn,
      },
    );

    target = Object.assign(
      new Column({
        ...scope,
        id,
        title: path
          .slice(i)
          .map((c) => c.title)
          .join('.'),
        uidt: UITypes.Lookup,
        fk_model_id: relationColumn.fk_model_id,
        meta: {},
      }),
      {
        colOptions: lookupOptions,
        getColOptions: async <U>() => lookupOptions as U,
      },
    );
  }

  return target;
}

export const dotPathBuilder =
  (
    params: FormulaQueryBuilderBaseParams & {
      pt: any;
      knex: CustomKnex;
      _formulaQueryBuilder: (
        params: FormulaQueryBuilderBaseParams,
      ) => Promise<{ builder: any }>;
    },
  ) =>
  async (aliasParams: TAliasToColumnParam): Promise<{ builder: any }> => {
    const context = params.baseModelSqlv2.context;
    const ids = getMemberPath(params.pt)?.map((node) => node.name);
    if (!ids) {
      NcError.get(context).formulaError('Invalid field path');
    }

    const path = await resolveDotPathColumns(context, params.columns, ids);

    return lookupOrLtarBuilder({
      ...params,
      column: buildDotPathLookupColumn(path),
    })(aliasParams);
  };
