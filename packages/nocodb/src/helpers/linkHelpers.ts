import { type NcContext, parseProp, RelationTypes } from 'nocodb-sdk';
import type { LinksColumn } from '~/models';
import { type Column } from '~/models';
import Noco from '~/Noco';

export const getCustomLinkParam = async (
  context: NcContext,
  {
    col,
    colOptions,
    mapId = (id) => id,
  }: { col: Column; colOptions: LinksColumn; mapId?: (id: string) => string },
  _ncMeta = Noco.ncMeta,
) => {
  if (!parseProp(col.meta).custom) {
    return;
  }
  if (
    colOptions.type === RelationTypes.HAS_MANY ||
    (colOptions.type === RelationTypes.ONE_TO_ONE && !col.meta?.bt)
  ) {
    return {
      base_id: context.base_id,
      column_id: mapId(colOptions.fk_parent_column_id),
      junc_base_id: mapId(colOptions.fk_related_base_id) ?? context.base_id,
      ref_model_id: mapId(colOptions.fk_related_model_id),
      ref_column_id: mapId(colOptions.fk_child_column_id),
    };
  } else if (
    colOptions.type === RelationTypes.BELONGS_TO ||
    (colOptions.type === RelationTypes.ONE_TO_ONE && col.meta?.bt)
  ) {
    return {
      base_id: context.base_id,
      column_id: mapId(colOptions.fk_child_column_id),
      junc_base_id: mapId(colOptions.fk_related_base_id) ?? context.base_id,
      ref_model_id: mapId(colOptions.fk_related_model_id),
      ref_column_id: mapId(colOptions.fk_parent_column_id),
    };
  } else if (colOptions.type === RelationTypes.MANY_TO_MANY) {
    return {
      base_id: context.base_id,
      column_id: mapId(colOptions.fk_child_column_id),
      junc_base_id: mapId(colOptions.fk_mm_base_id) ?? context.base_id,
      junc_model_id: mapId(colOptions.fk_mm_model_id),
      junc_column_id: mapId(colOptions.fk_mm_child_column_id),
      junc_ref_column_id: mapId(colOptions.fk_mm_parent_column_id),
      ref_model_id: mapId(colOptions.fk_related_model_id),
      ref_column_id: mapId(colOptions.fk_parent_column_id),
    };
  }

  return;
};
