import { NcUpgraderCtx } from './NcUpgrader';
import { MetaTable } from '../utils/globals';
import NcMetaIO from '../meta/NcMetaIO';
import Column from '../models/Column';
import Filter from '../models/Filter';
import { UITypes } from 'nocodb-sdk';

// as of 0.105.3, date / datetime filters include `is like` and `is not like` which are not practical
// `removeLikeAndNlikeFilters` in this upgrader is simply to remove them

// besides, `null` and `empty` will be migrated to `blank` in `migrateEmptyAndNullFilters`

// since the upcoming version will introduce a set of new filters for date / datetime with a new `comparison_sub_op`
// `eq` and `neq` would become `is` / `is not` (comparison_op) + `exact date` (comparison_sub_op)
// `migrateEqAndNeqFilters` in this upgrader is to add `exact date` in comparison_sub_op

// Change Summary:
// - Date / DateTime columns:
//   - remove `is like` and `is not like`
//   - migrate `null` or `empty` filters to `blank`
//   - add `exact date` in comparison_sub_op for existing filters `eq` and `neq`

async function removeLikeAndNlikeFilters(ncMeta: NcMetaIO) {
  let actions = [];
  const filters = await ncMeta.metaList2(null, null, MetaTable.FILTER_EXP);
  for (const filter of filters) {
    if (!filter.fk_column_id || filter.is_group) {
      continue;
    }
    const col = await Column.get({ colId: filter.fk_column_id }, ncMeta);
    if ([UITypes.Date, UITypes.DateTime].includes(col.uidt)) {
      // remove `is like` and `is not like`
      if (['like', 'nlike'].includes(filter.comparison_op)) {
        actions.push(Filter.delete(filter.id, ncMeta));
      }
    }
  }
  await Promise.all(actions);
}

async function migrateEqAndNeqFilters(ncMeta: NcMetaIO) {
  let actions = [];
  const filters = await ncMeta.metaList2(null, null, MetaTable.FILTER_EXP);
  for (const filter of filters) {
    if (
      !filter.fk_column_id ||
      filter.is_group ||
      !['eq', 'neq'].includes(filter.comparison_op)
    ) {
      continue;
    }
    actions.push(
      Filter.update(
        filter.id,
        {
          comparison_sub_op: 'exactDate',
        },
        ncMeta
      )
    );
  }
  await Promise.all(actions);
}

async function migrateEmptyAndNullFilters(ncMeta: NcMetaIO) {
  let actions = [];
  const filters = await ncMeta.metaList2(null, null, MetaTable.FILTER_EXP);
  for (const filter of filters) {
    if (
      !filter.fk_column_id ||
      filter.is_group ||
      !['empty', 'notempty', 'null', 'notnull'].includes(filter.comparison_op)
    ) {
      continue;
    }
    if (['empty', 'null'].includes(filter.comparison_op)) {
      // migrate to blank
      actions.push(
        Filter.update(
          filter.id,
          {
            comparison_op: 'blank',
          },
          ncMeta
        )
      );
    } else if (['notempty', 'notnull'].includes(filter.comparison_op)) {
      // migrate to not blank
      actions.push(
        Filter.update(
          filter.id,
          {
            comparison_op: 'notblank',
          },
          ncMeta
        )
      );
    }
  }
  await Promise.all(actions);
}

export default async function ({ ncMeta }: NcUpgraderCtx) {
  await removeLikeAndNlikeFilters(ncMeta);
  await migrateEmptyAndNullFilters(ncMeta);
  await migrateEqAndNeqFilters(ncMeta);
}
