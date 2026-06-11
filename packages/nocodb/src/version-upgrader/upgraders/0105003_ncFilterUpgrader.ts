import { UITypes } from 'nocodb-sdk';
import type { MetaService } from '~/meta/meta.service';
import type { NcUpgraderCtx } from '~/version-upgrader/NcUpgrader';
import type { NcContext } from '~/interface/config';
import { MetaTable } from '~/utils/globals';
import Column from '~/models/Column';
import Filter from '~/models/Filter';

// as of 0.105.3, year, time, date and datetime filters include `is like` and `is not like` which are not practical
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
// - Year / Time columns:
//   - remove `is like` and `is not like`
//   - migrate `null` or `empty` filters to `blank`

function removeLikeAndNlikeFilters(
  context: NcContext,
  filter: Filter,
  ncMeta: MetaService,
) {
  const actions = [];
  // remove `is like` and `is not like`
  if (['like', 'nlike'].includes(filter.comparison_op)) {
    actions.push(Filter.delete(context, filter.id, ncMeta));
  }
  return actions;
}

function migrateEqAndNeqFilters(
  context: NcContext,
  filter: Filter,
  ncMeta: MetaService,
) {
  const actions = [];
  // remove `is like` and `is not like`
  if (['eq', 'neq'].includes(filter.comparison_op)) {
    actions.push(
      Filter.update(
        context,
        filter.id,
        {
          comparison_sub_op: 'exactDate',
        },
        ncMeta,
      ),
    );
  }
  return actions;
}

function migrateEmptyAndNullFilters(
  context: NcContext,
  filter: Filter,
  ncMeta: MetaService,
) {
  const actions = [];
  // remove `is like` and `is not like`
  if (['empty', 'null'].includes(filter.comparison_op)) {
    // migrate to blank
    actions.push(
      Filter.update(
        context,
        filter.id,
        {
          comparison_op: 'blank',
        },
        ncMeta,
      ),
    );
  } else if (['notempty', 'notnull'].includes(filter.comparison_op)) {
    // migrate to not blank
    actions.push(
      Filter.update(
        context,
        filter.id,
        {
          comparison_op: 'notblank',
        },
        ncMeta,
      ),
    );
  }
  return actions;
}

export default async function ({ ncMeta }: NcUpgraderCtx) {
  const filters = await ncMeta.knexConnection(MetaTable.FILTER_EXP);
  for (const filter of filters) {
    if (!filter.fk_column_id || filter.is_group) {
      continue;
    }

    const context = {
      workspace_id: filter.fk_workspace_id,
      base_id: filter.fk_base_id,
    };

    const col = await Column.get(
      context,
      { colId: filter.fk_column_id },
      ncMeta,
    );
    if ([UITypes.Date, UITypes.DateTime].includes(col.uidt)) {
      await Promise.all([
        ...removeLikeAndNlikeFilters(context, filter, ncMeta),
        ...migrateEmptyAndNullFilters(context, filter, ncMeta),
        ...migrateEqAndNeqFilters(context, filter, ncMeta),
      ]);
    } else if ([UITypes.Time, UITypes.Year].includes(col.uidt)) {
      await Promise.all([
        ...removeLikeAndNlikeFilters(context, filter, ncMeta),
        ...migrateEmptyAndNullFilters(context, filter, ncMeta),
      ]);
    }
  }
}
