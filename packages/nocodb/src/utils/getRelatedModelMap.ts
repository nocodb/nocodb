import type { NcContext } from 'nocodb-sdk';
import { Model } from '~/models';

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

    if (
      col.colOptions?.base_id &&
      col.colOptions?.fk_related_base_id &&
      col.colOptions?.base_id !== col.colOptions?.fk_related_base_id
    ) {
      if (!relatedModels.has(col.colOptions.fk_related_model_id)) {
        const targetContext = {
          ...context,
          base_id: col.colOptions.fk_related_base_id,
        };
        const relatedModel = await Model.get(
          targetContext,
          col.colOptions.fk_related_model_id,
        );
        await relatedModel.getColumns(targetContext);
        relatedModels.set(col.colOptions.fk_related_model_id, relatedModel);
      }
    }
  }

  return relatedModels;
}
