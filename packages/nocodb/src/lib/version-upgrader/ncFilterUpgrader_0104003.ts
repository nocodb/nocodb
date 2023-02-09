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
// - remove `like`, `null`, and `empty` for numeric-based / singleSelect columns - migrate to `blank` from `null` and `empty`
// - remove `is null`, `is not null` for checkbox columns - migrate `equal` and `not equal` to `checked` and `not checked`
// - remove `like`, `null`, `equal` and `empty` for multiSelect columns
// - remove `>`, `<`, `>=`, `<=`, `is empty`, `is not empty`, `is equal`, `is not equal` for attachment / LTAR columns

const removeEqualFilters = async (
  filter,
  actions: any[],
  ncMeta,
  migrateFn = () => {}
) => {
  // remove `is equal`, `is not equal`
  if (['eq', 'neq'].includes(filter.comparison_op)) {
    actions.push(await Filter.delete(filter, ncMeta));
    if (migrateFn) migrateFn();
  }
  return actions;
};

const removeArithmeticFilters = async (
  filter,
  actions: any[],
  ncMeta,
  migrateFn = () => {}
) => {
  // remove `>`, `<`, `>=`, `<=`
  if (['gt', 'lt', 'gte', 'lte'].includes(filter.comparison_op)) {
    actions.push(await Filter.delete(filter, ncMeta));
    if (migrateFn) migrateFn();
  }
  return actions;
};

const removeLikeFilters = async (
  filter,
  actions: any[],
  ncMeta,
  migrateFn = () => {}
) => {
  // remove `is like`, `is not like`
  if (['like', 'nlike'].includes(filter.comparison_op)) {
    actions.push(await Filter.delete(filter, ncMeta));
    if (migrateFn) migrateFn();
  }
  return actions;
};

const removeNullFilters = async (
  filter,
  actions: any[],
  ncMeta,
  migrateFn = () => {}
) => {
  // remove `is null`, `is not null`
  if (['null', 'notnull'].includes(filter.comparison_op)) {
    actions.push(await Filter.delete(filter, ncMeta));
    if (migrateFn) migrateFn();
  }
  return actions;
};

const removeEmptyFilters = async (
  filter,
  actions: any[],
  ncMeta,
  migrateFn = () => {}
) => {
  // remove `is empty`, `is not empty`
  if (['empty', 'notempty'].includes(filter.comparison_op))
    if (migrateFn) migrateFn();
  {
    actions.push(await Filter.delete(filter, ncMeta));
  }
  return actions;
};

const migrateToBlankFilter = async () => {
  // TODO:
};

const migrateToCheckboxFilter = async () => {
  // TODO
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
      actions = await removeNullFilters(
        filter,
        actions,
        ncMeta,
        migrateToBlankFilter
      );
      actions = await removeEmptyFilters(
        filter,
        actions,
        ncMeta,
        migrateToBlankFilter
      );
    } else if (col.uidt === UITypes.Checkbox) {
      actions = await removeEqualFilters(
        filter,
        actions,
        ncMeta,
        migrateToCheckboxFilter
      );
      actions = await removeNullFilters(filter, actions, ncMeta);
    } else if (col.uidt === UITypes.MultiSelect) {
      // TODO: migrate to "contains any of" or "contains all of"
      // TODO: migrate to "doesnt contain any of" or "doesnt contain all of"
      actions = await removeEqualFilters(filter, actions, ncMeta);
      actions = await removeLikeFilters(filter, actions, ncMeta);
      actions = await removeNullFilters(
        filter,
        actions,
        ncMeta,
        migrateToBlankFilter
      );
      actions = await removeEmptyFilters(
        filter,
        actions,
        ncMeta,
        migrateToBlankFilter
      );
    } else if (col.uidt === UITypes.Attachment) {
      actions = await removeArithmeticFilters(filter, actions, ncMeta);
      actions = await removeEmptyFilters(filter, actions, ncMeta);
      actions = await removeEqualFilters(
        filter,
        actions,
        ncMeta,
        migrateToCheckboxFilter
      );
    } else if (col.uidt === UITypes.LinkToAnotherRecord) {
      actions = await removeArithmeticFilters(filter, actions, ncMeta);
      actions = await removeEmptyFilters(
        filter,
        actions,
        ncMeta,
        migrateToBlankFilter
      );
      actions = await removeNullFilters(
        filter,
        actions,
        ncMeta,
        migrateToBlankFilter
      );
    }
  }
  await Promise.all(actions);
}
