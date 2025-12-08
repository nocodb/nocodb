import { isLinksOrLTAR, UITypes } from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import { Column, Model, type LookupColumn } from '~/models';

async function traverseLookupChain(
  column: Column,
  context: NcContext,
  relatedModels: Map<string, Model>,
): Promise<void> {
  if (column.uidt !== UITypes.Lookup) {
    return;
  }

  const colOptions = await column.getColOptions<LookupColumn>(context);

  // Get the relation column (Link/LTAR column)
  const relationColumn = await colOptions.getRelationColumn(context);

  if (relationColumn && isLinksOrLTAR(relationColumn)) {
    const relationColOptions = await relationColumn.getColOptions(context);

    if (!relationColOptions) {
      return;
    }

    // Add the related model from the link
    if (!relatedModels.has(relationColOptions.fk_related_model_id)) {
      const targetContext = {
        ...context,
        base_id: relationColOptions.fk_related_base_id || context.base_id,
      };
      const relatedModel = await Model.get(
        targetContext,
        relationColOptions.fk_related_model_id,
      );
      await relatedModel.getColumns(targetContext);
      relatedModels.set(relationColOptions.fk_related_model_id, relatedModel);
    }

    // Add junction model for many-to-many
    if (
      relationColOptions.fk_mm_model_id &&
      !relatedModels.has(relationColOptions.fk_mm_model_id)
    ) {
      const targetContext = {
        ...context,
        base_id: relationColOptions.fk_mm_base_id || context.base_id,
      };
      const mmModel = await Model.get(
        targetContext,
        relationColOptions.fk_mm_model_id,
      );
      await mmModel.getColumns(targetContext);
      relatedModels.set(relationColOptions.fk_mm_model_id, mmModel);
    }

    // Get the lookup column from the related model
    const refContext = {
      ...context,
      base_id: relationColOptions.fk_related_base_id || context.base_id,
    };
    const lookupColumn = await colOptions.getLookupColumn(refContext);

    // Recursively traverse if the lookup column is itself a lookup
    if (lookupColumn && lookupColumn.uidt === UITypes.Lookup) {
      await traverseLookupChain(lookupColumn, refContext, relatedModels);
    }
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
    if (!relatedModels.has(col.fk_model_id)) {
      const model = await Model.get(context, col.fk_model_id);
      await model.getColumns(context);
      relatedModels.set(col.fk_model_id, model);
    }

    // Handle Link/LTAR columns
    if (col.colOptions && isLinksOrLTAR(col)) {
      // related model
      if (!relatedModels.has(col.colOptions.fk_related_model_id)) {
        const targetContext = {
          ...context,
          base_id: col.colOptions.fk_related_base_id || context.base_id,
        };
        const relatedModel = await Model.get(
          targetContext,
          col.colOptions.fk_related_model_id,
        );
        await relatedModel.getColumns(targetContext);
        relatedModels.set(col.colOptions.fk_related_model_id, relatedModel);
      }

      // junction model for many-to-many
      if (
        col.colOptions.fk_mm_model_id &&
        !relatedModels.has(col.colOptions.fk_mm_model_id)
      ) {
        const targetContext = {
          ...context,
          base_id: col.colOptions.fk_mm_base_id || context.base_id,
        };
        const relatedModel = await Model.get(
          targetContext,
          col.colOptions.fk_mm_model_id,
        );
        await relatedModel.getColumns(targetContext);
        relatedModels.set(col.colOptions.fk_mm_model_id, relatedModel);
      }
    }
    // Handle Lookup columns - traverse the entire lookup chain
    else if (col.uidt === UITypes.Lookup) {
      await traverseLookupChain(col, context, relatedModels);
    }
  }

  return relatedModels;
}
