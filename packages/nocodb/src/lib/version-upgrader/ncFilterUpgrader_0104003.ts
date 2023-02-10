import { NcUpgraderCtx } from './NcUpgrader';
import { MetaTable } from '../utils/globals';
import Column from '../models/Column';
import Filter from '../models/Filter';
import { UITypes } from 'nocodb-sdk';

// as of 0.104.3, almost all filter operators are available to all column types
// while some of them aren't supposed to be shown
// this upgrader is to remove those unsupported filters / migrate to the correct filter
// changes:
// - remove `>`, `<`, `>=`, `<=` for text-based columns
// - remove `like`; migrate `null`, and `empty` for numeric-based / singleSelect columns to`blank`
// - remove `equal`; migrate `null` to `checked` for checkbox columns
// - remove `like`; migrate `equal`, `null`, `empty` for multiSelect columns
// - remove `>`, `<`, `>=`, `<=`; migrate `empty`, `equal`, `null` for attachment
// - remove `>`, `<`, `>=`, `<=`; migrate `empty`, `null` for LTAR columns
// - migrate `empty`, `null` for Lookup columns
// - remove  `>`, `<`, `>=`, `<=`, `like`, `equal`; migrate `empty`, `null`
// - remove `empty`, `like`, `equal`, `null` for duration columns

const removeEqualFilters = async (filter, actions: any[], ncMeta) => {
  // remove `is equal`, `is not equal`
  if (['eq', 'neq'].includes(filter.comparison_op)) {
    actions.push(await Filter.delete(filter, ncMeta));
  }
  return actions;
};

const removeArithmeticFilters = async (filter, actions: any[], ncMeta) => {
  // remove `>`, `<`, `>=`, `<=`
  if (['gt', 'lt', 'gte', 'lte'].includes(filter.comparison_op)) {
    actions.push(await Filter.delete(filter, ncMeta));
  }
  return actions;
};

const removeLikeFilters = async (filter, actions: any[], ncMeta) => {
  // remove `is like`, `is not like`
  if (['like', 'nlike'].includes(filter.comparison_op)) {
    actions.push(await Filter.delete(filter, ncMeta));
  }
  return actions;
};

const migrateToBlankFilter = async (filter, actions: any[], ncMeta) => {
  if (['empty', 'null'].includes(filter.comparision_op)) {
    // migrate to blank
    actions.push(
      await Filter.update(
        filter.id,
        {
          ...filter,
          comparision_op: 'blank',
        },
        ncMeta
      )
    );
  } else if (['notempty', 'notnull'].includes(filter.comparision_op)) {
    // migrate to not blank
    actions.push(
      await Filter.update(
        filter.id,
        {
          ...filter,
          comparision_op: 'notblank',
        },
        ncMeta
      )
    );
  }
  return actions;
};

const migrateToCheckboxFilter = async (filter, actions: any[], ncMeta) => {
  if (['empty', 'null'].includes(filter.comparision_op)) {
    // migrate to checked
    actions.push(
      await Filter.update(
        filter.id,
        {
          ...filter,
          comparision_op: 'checked',
        },
        ncMeta
      )
    );
  } else if (['notempty', 'notnull'].includes(filter.comparision_op)) {
    //  migrate to not checked
    actions.push(
      await Filter.update(
        filter.id,
        {
          ...filter,
          comparision_op: 'notchecked',
        },
        ncMeta
      )
    );
  }
  return actions;
};

export default async function ({ ncMeta }: NcUpgraderCtx) {
  const filters = await ncMeta.metaList2(null, null, MetaTable.FILTER_EXP);
  let actions = [];
  for (const filter of filters) {
    const col = await Column.get({ colId: filter.fk_column_id }, ncMeta);
    if (!col || !col.uidt) {
      // column not found -> skip
      continue;
    }
    if (
      [
        UITypes.SingleLineText,
        UITypes.LongText,
        UITypes.PhoneNumber,
        UITypes.Email,
        UITypes.URL,
      ].includes(col.uidt)
    ) {
      actions = await removeArithmeticFilters(filter, actions, ncMeta);
    } else if (
      [
        // numeric fields
        UITypes.Duration,
        UITypes.Currency,
        UITypes.Percent,
        UITypes.Number,
        UITypes.Decimal,
        UITypes.Rating,
        UITypes.Rollup,
        // select fields
        UITypes.SingleSelect,
      ].includes(col.uidt)
    ) {
      actions = await removeLikeFilters(filter, actions, ncMeta);
      actions = await migrateToBlankFilter(filter, actions, ncMeta);
    } else if (col.uidt === UITypes.Checkbox) {
      actions = await removeEqualFilters(filter, actions, ncMeta);
      actions = await migrateToCheckboxFilter(filter, actions, ncMeta);
    } else if (col.uidt === UITypes.MultiSelect) {
      // TODO: migrate to "contains any of" or "contains all of"
      // TODO: migrate to "doesnt contain any of" or "doesnt contain all of"
      // actions = await removeEqualFilters(filter, actions, ncMeta);
      actions = await removeLikeFilters(filter, actions, ncMeta);
      actions = await migrateToBlankFilter(filter, actions, ncMeta);
    } else if (col.uidt === UITypes.Attachment) {
      actions = await removeArithmeticFilters(filter, actions, ncMeta);
      actions = await removeEqualFilters(filter, actions, ncMeta);
      actions = await migrateToBlankFilter(filter, actions, ncMeta);
    } else if (col.uidt === UITypes.LinkToAnotherRecord) {
      actions = await removeArithmeticFilters(filter, actions, ncMeta);
      actions = await migrateToBlankFilter(filter, actions, ncMeta);
    } else if (col.uidt === UITypes.Lookup) {
      actions = await removeArithmeticFilters(filter, actions, ncMeta);
      actions = await migrateToBlankFilter(filter, actions, ncMeta);
    } else if (col.uidt === UITypes.Duration) {
      actions = await removeLikeFilters(filter, actions, ncMeta);
      actions = await removeEqualFilters(filter, actions, ncMeta);
      actions = await migrateToBlankFilter(filter, actions, ncMeta);
    }
  }
  await Promise.all(actions);
}
