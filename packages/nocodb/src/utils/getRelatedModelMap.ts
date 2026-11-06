import { isLinksOrLTAR, UITypes } from 'nocodb-sdk';
import type { ColumnType, NcContext } from 'nocodb-sdk';
import type { MetaService } from '~/meta/meta.service';
import {
  Column,
  type LinkToAnotherRecordColumn,
  type LookupColumn,
  Model,
} from '~/models';
import Noco from '~/Noco';

async function processColumn(
  context: NcContext,
  column: Column,
  relatedModels: Map<string, Model>,
  visitedColumns = new Set<string>(),
  ncMeta: MetaService = Noco.ncMeta,
) {
  // Prevent circular references
  // a dangling reference (deleted column / table) has nothing to add
  if (!column || visitedColumns.has(column.id)) {
    return;
  }
  visitedColumns.add(column.id);

  if (!relatedModels.has(column.fk_model_id)) {
    const model = await Model.get(context, column.fk_model_id, false, ncMeta);
    if (!model) return;
    await model.getColumns(ncMeta);
    relatedModels.set(column.fk_model_id, model);
  }

  // Handle Link/LTAR columns
  if (column.colOptions && isLinksOrLTAR(column)) {
    // related model
    if (!relatedModels.has(column.colOptions.fk_related_model_id)) {
      const targetContext = {
        ...context,
        base_id: column.colOptions.fk_related_base_id || context.base_id,
      };
      const relatedModel = await Model.get(
        targetContext,
        column.colOptions.fk_related_model_id,
        false,
        ncMeta,
      );
      if (relatedModel) {
        await relatedModel.getColumns(ncMeta);
        relatedModels.set(column.colOptions.fk_related_model_id, relatedModel);
      }
    }

    // junction model for many-to-many
    if (
      column.colOptions.fk_mm_model_id &&
      !relatedModels.has(column.colOptions.fk_mm_model_id)
    ) {
      const targetContext = {
        ...context,
        base_id: column.colOptions.fk_mm_base_id || context.base_id,
      };
      const relatedModel = await Model.get(
        targetContext,
        column.colOptions.fk_mm_model_id,
        false,
        ncMeta,
      );
      if (relatedModel) {
        await relatedModel.getColumns(ncMeta);
        relatedModels.set(column.colOptions.fk_mm_model_id, relatedModel);
      }
    }
  }
  // Handle Lookup columns - traverse the entire lookup chain
  else if (column.uidt === UITypes.Lookup) {
    const colOptions = await column.getColOptions<LookupColumn>(ncMeta);
    if (!colOptions || colOptions.error) return;
    const relationCol = await Column.get(
      colOptions.context,
      { colId: colOptions.fk_relation_column_id },
      ncMeta,
    );
    const relationColOpt =
      (relationCol?.colOptions as LinkToAnotherRecordColumn) ??
      (await relationCol?.getColOptions<LinkToAnotherRecordColumn>(ncMeta));
    if (!relationColOpt) return;

    // related model
    if (!relatedModels.has(relationColOpt.fk_related_model_id)) {
      const targetContext = {
        ...context,
        base_id: relationColOpt.fk_related_base_id || context.base_id,
      };
      const relatedModel = await Model.get(
        targetContext,
        relationColOpt.fk_related_model_id,
        false,
        ncMeta,
      );
      if (relatedModel) {
        await relatedModel.getColumns(ncMeta);
        relatedModels.set(relationColOpt.fk_related_model_id, relatedModel);
      }
    }

    const { refContext } = relationColOpt.getRelContext();
    await processColumn(
      refContext,
      await Column.get(
        refContext,
        { colId: colOptions.fk_lookup_column_id },
        ncMeta,
      ),
      relatedModels,
      visitedColumns,
      ncMeta,
    );
  }
}

export async function getRelatedModelMap(
  context: NcContext,
  table: Model,
  ncMeta: MetaService = Noco.ncMeta,
): Promise<Map<string, Model>> {
  const relatedModels: Map<string, Model> = new Map();

  await table.getColumns(ncMeta);

  relatedModels.set(table.id, table);

  // processColumn falls back to its context's base for same-base links, so it
  // must be the table's own base (callers may pass a cross-base lookup's model).
  const tableContext =
    table.base_id && table.base_id !== context.base_id
      ? { ...context, base_id: table.base_id }
      : context;

  for (const col of table.columns) {
    await processColumn(tableContext, col, relatedModels, undefined, ncMeta);
  }

  return relatedModels;
}

// getMeta for formula validation — `{Link}.{Link}.{Field}` paths can reach
// tables outside the map
export function getRelatedModelResolver(
  context: NcContext,
  relatedModels: Map<string, Model>,
) {
  return async (ctx: Partial<NcContext>, { id }: { id: string }) => {
    if (relatedModels.has(id)) return relatedModels.get(id);
    const model = await Model.get(
      { ...context, base_id: ctx?.base_id || context.base_id },
      id,
    );
    if (model) {
      await model.getColumns();
      relatedModels.set(id, model);
    }
    return model;
  };
}

// Columns of the table a link points to, for storing `{Link}.{Field}` by id
export function getLinkedColumnsResolver(context: NcContext) {
  return async (linkColumn: ColumnType) => {
    const column =
      linkColumn instanceof Column
        ? linkColumn
        : await Column.get(context, { colId: linkColumn.id });
    const relation = await column?.getColOptions<LinkToAnotherRecordColumn>();
    const relatedTable = await relation?.getRelatedTable();
    return relatedTable?.getColumns();
  };
}
