import { RelationTypes } from '~/lib';
import type { NcContext, UnifiedMetaType } from '~/lib';
import { getColOptions } from '~/lib/unifiedMeta/getColOptions';
import { getColumns } from '~/lib/unifiedMeta/getColumns';
import { getLTARRelatedTable } from './getLTARRelatedTable';

export type ILinkInfo = {
  source: {
    context: NcContext;
    model: UnifiedMetaType.IModel;
    linkColumn: UnifiedMetaType.IColumn;
    joinColumn: UnifiedMetaType.IColumn;
  };
  mm?: {
    context: NcContext;
    sourceJoinColumn: UnifiedMetaType.IColumn;
    targetJoinColumn: UnifiedMetaType.IColumn;
    model: UnifiedMetaType.IModel;
  };
  target: {
    context: NcContext;
    model: UnifiedMetaType.IModel;
    linkColumn?: UnifiedMetaType.IColumn; // cannot be fetched from relation options
    joinColumn: UnifiedMetaType.IColumn;
  };
  relationType: RelationTypes;
  relationFromSource: RelationTypes;
  isBelongsTo: boolean;
};
/*
case 1:
table mw7s5x1ser8b8js
  ltar col: crxl9mqbdo9y06o
hm mkglmt0b0h84jp7
  ltar col: cps6kvxuf4s5phn

from crxl9mqbdo9y06o coloption:
  {
    "fk_column_id" : "crxl9mqbdo9y06o",
    "fk_related_model_id" : "mkglmt0b0h84jp7",
    "fk_child_column_id" : "ccz3j0i9d927vqf", // foreign key
    "fk_parent_column_id" : "ck2w0o0nhmjbvgj", // id
    "type": "hm"
  }

from cps6kvxuf4s5phn coloption:
  {
    "fk_column_id" : "cps6kvxuf4s5phn",
    "fk_related_model_id" : "mw7s5x1ser8b8js",
    "fk_child_column_id" : "ccz3j0i9d927vqf",
    "fk_parent_column_id" : "ck2w0o0nhmjbvgj",
    "type": "bt"
  }
*/

/*
case 2:
table mfz4bdhu24tl0yn
  ltar col: ckcs3zpt3opiadu
oo mdtzpm7lrqm0euq
  ltar col: ctmbms7ytc649i2

from ckcs3zpt3opiadu coloption:
  {
    "fk_column_id" : "ckcs3zpt3opiadu",
    "fk_related_model_id" : "mdtzpm7lrqm0euq",
    "fk_child_column_id" : "cjkd684tddrpvib", // foreign key
    "fk_parent_column_id" : "cytxetm7x9l24s4", // id
    "type": "oo"
  }

from ctmbms7ytc649i2 coloption:
  {
    "fk_column_id" : "ctmbms7ytc649i2",
    "fk_related_model_id" : "mfz4bdhu24tl0yn",
    "fk_child_column_id" : "cjkd684tddrpvib",
    "fk_parent_column_id" : "cytxetm7x9l24s4",
    "type": "oo"
  }

*/

export const getLinkInfo = async (
  context: NcContext,
  {
    linkColumn,
    sourceModel,
    getMeta,
  }: {
    linkColumn: UnifiedMetaType.IColumn;
    sourceModel: UnifiedMetaType.IModel;
    getMeta: UnifiedMetaType.IGetModel;
  }
) => {
  const relationColOptions =
    await getColOptions<UnifiedMetaType.ILinkToAnotherRecordColumn>(context, {
      column: linkColumn,
    });

  switch (relationColOptions.type) {
    case RelationTypes.ONE_TO_ONE:
    case RelationTypes.BELONGS_TO:
    case RelationTypes.HAS_MANY: {
      const joinIds = [
        relationColOptions.fk_child_column_id,
        relationColOptions.fk_parent_column_id,
      ];
      const sourceJoinColumn = (
        await getColumns(context, { model: sourceModel })
      ).find((col) => joinIds.includes(col.id));

      const targetContext = {
        ...context,
        base_id: relationColOptions.fk_related_base_id ?? context.base_id,
      };
      const targetModel = await getLTARRelatedTable(targetContext, {
        colOptions: relationColOptions,
        getMeta,
      });
      const targetJoinColumn = (
        await targetModel.getColumns(targetContext)
      ).find((col) => joinIds.includes(col.id));

      return {
        source: {
          context,
          model: sourceModel,
          linkColumn: linkColumn,
          joinColumn: sourceJoinColumn,
        },
        target: {
          context: targetContext,
          model: targetModel,
          joinColumn: targetJoinColumn,
        },
        relationType: relationColOptions.type,
        isBelongsTo: linkColumn.meta?.bt ?? false,
        relationFromSource: linkColumn.meta?.bt
          ? RelationTypes.BELONGS_TO
          : relationColOptions.type,
      } as ILinkInfo;
    }
    case RelationTypes.MANY_TO_MANY: {
      const joinIds = [
        relationColOptions.fk_child_column_id,
        relationColOptions.fk_parent_column_id,
      ];
      const sourceJoinColumn = (await sourceModel.getColumns(context)).find(
        (col) => joinIds.includes(col.id)
      );

      const mmContext = {
        ...context,
        base_id: relationColOptions.fk_mm_base_id ?? context.base_id,
      };
      const mmModel = await getMeta(mmContext, {
        id: relationColOptions.fk_mm_model_id,
      });
      const mmColumns = await mmModel.getColumns(mmContext);
      let mmSourceJoinColumn: UnifiedMetaType.IColumn;
      let mmTargetJoinColumn: UnifiedMetaType.IColumn;
      if (sourceJoinColumn.id === relationColOptions.fk_parent_column_id) {
        mmSourceJoinColumn = mmColumns.find(
          (col) => col.id === relationColOptions.fk_mm_parent_column_id
        );
        mmTargetJoinColumn = mmColumns.find(
          (col) => col.id === relationColOptions.fk_mm_child_column_id
        );
      } else {
        mmSourceJoinColumn = mmColumns.find(
          (col) => col.id === relationColOptions.fk_mm_child_column_id
        );
        mmTargetJoinColumn = mmColumns.find(
          (col) => col.id === relationColOptions.fk_mm_parent_column_id
        );
      }

      const targetContext = {
        ...context,
        base_id: relationColOptions.fk_related_base_id ?? context.base_id,
      };
      const targetModel = await relationColOptions.getRelatedTable(
        targetContext
      );
      const targetJoinColumn = (
        await targetModel.getColumns(targetContext)
      ).find((col) => joinIds.includes(col.id));

      return {
        source: {
          context,
          model: sourceModel,
          linkColumn: linkColumn,
          joinColumn: sourceJoinColumn,
        },
        mm: {
          sourceJoinColumn: mmSourceJoinColumn,
          targetJoinColumn: mmTargetJoinColumn,
          model: mmModel,
          context: mmContext,
        },
        target: {
          context: targetContext,
          model: targetModel,
          joinColumn: targetJoinColumn,
        },
        relationType: relationColOptions.type,
        isBelongsTo: false,
        relationFromSource: linkColumn.meta?.bt
          ? RelationTypes.BELONGS_TO
          : relationColOptions.type,
      } as ILinkInfo;
    }
    // should not be possible to land into this
    default:
      return <ILinkInfo>undefined;
  }
};
