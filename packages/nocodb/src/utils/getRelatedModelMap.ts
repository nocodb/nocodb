import { isLinksOrLTAR, UITypes } from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import {
  type Column,
  type LinkToAnotherRecordColumn,
  type LookupColumn,
  Model,
} from '~/models';

async function processColumn(
  context: NcContext,
  column: Column,
  relatedModels: Map<string, Model>,
  visitedColumns = new Set<string>(),
) {
  // Prevent circular references
  if (visitedColumns.has(column.id)) {
    return;
  }
  visitedColumns.add(column.id);

  if (!relatedModels.has(column.fk_model_id)) {
    const model = await Model.get(context, column.fk_model_id);
    await model.getColumns(context);
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
      );
      await relatedModel.getColumns(targetContext);
      relatedModels.set(column.colOptions.fk_related_model_id, relatedModel);
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
      );
      await relatedModel.getColumns(targetContext);
      relatedModels.set(column.colOptions.fk_mm_model_id, relatedModel);
    }
  }
  // Handle Lookup columns - traverse the entire lookup chain
  else if (column.uidt === UITypes.Lookup) {
    const colOptions = await column.getColOptions<LookupColumn>(context);
    const relationColOpt = await colOptions
      .getRelationColumn(context)
      .then((col) => {
        return (
          col?.colOptions ??
          col?.getColOptions<LinkToAnotherRecordColumn>(context)
        );
      });

    // related model
    if (!relatedModels.has(relationColOpt.fk_related_model_id)) {
      const targetContext = {
        ...context,
        base_id: relationColOpt.fk_related_base_id || context.base_id,
      };
      const relatedModel = await Model.get(
        targetContext,
        relationColOpt.fk_related_model_id,
      );
      await relatedModel.getColumns(targetContext);
      relatedModels.set(relationColOpt.fk_related_model_id, relatedModel);
    }

    const { refContext } = relationColOpt.getRelContext(context);
    await processColumn(
      refContext,
      await colOptions?.getLookupColumn(refContext),
      relatedModels,
    );
  }
}

export async function getRelatedModelMap(
  context: NcContext,
  table: Model,
): Promise<Map<string, Model>> {
  const relatedModels: Map<string, Model> = new Map();

  await table.getColumns(context);

  relatedModels.set(table.id, table);

  for (const col of table.columns) {
    await processColumn(context, col, relatedModels);
  }

  return relatedModels;
}
