import { NcUpgraderCtx } from './NcUpgrader';
import { MetaTable } from '../utils/globals';
import NcMetaIO from '../meta/NcMetaIO';
import Column from '../models/Column';
import Filter from '../models/Filter';
import Project from '../models/Project';
import { UITypes, SelectOptionsType } from 'nocodb-sdk';

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
    actions.push(await Filter.delete(filter.id, ncMeta));
  }
  return actions;
};

const removeArithmeticFilters = async (filter, actions: any[], ncMeta) => {
  // remove `>`, `<`, `>=`, `<=`
  if (['gt', 'lt', 'gte', 'lte'].includes(filter.comparison_op)) {
    actions.push(await Filter.delete(filter.id, ncMeta));
  }
  return actions;
};

const removeLikeFilters = async (filter, actions: any[], ncMeta) => {
  // remove `is like`, `is not like`
  if (['like', 'nlike'].includes(filter.comparison_op)) {
    actions.push(await Filter.delete(filter.id, ncMeta));
  }
  return actions;
};

const migrateToBlankFilter = async (filter, actions: any[], ncMeta) => {
  if (['empty', 'null'].includes(filter.comparison_op)) {
    // migrate to blank
    actions.push(
      await Filter.update(
        filter.id,
        {
          ...filter,
          comparison_op: 'blank',
        },
        ncMeta
      )
    );
  } else if (['notempty', 'notnull'].includes(filter.comparison_op)) {
    // migrate to not blank
    actions.push(
      await Filter.update(
        filter.id,
        {
          ...filter,
          comparison_op: 'notblank',
        },
        ncMeta
      )
    );
  }
  return actions;
};

const migrateMultiSelectEq = async (
  filter,
  actions: any[],
  col: Column,
  ncMeta
) => {
  // only allow eq / neq
  if (!['eq', 'neq'].includes(filter.comparison_op)) return actions;
  // if there is no value -> delete this filter
  if (!filter.value) {
    actions.push(await Filter.delete(filter.id, ncMeta));
    return actions;
  }
  // options inputted from users
  const options = filter.value.split(',');
  // retrieve the possible col options
  const colOptions = (await col.getColOptions()) as SelectOptionsType;
  // only include valid options as the input value becomes dropdown type now
  let validOptions = [];
  for (const option of options) {
    if (colOptions.options.includes(option)) {
      validOptions.push(option);
    }
  }
  const newFilterValue = validOptions.join(',');
  // if all inputted options are invalid -> delete this filter
  if (!newFilterValue) {
    actions.push(await Filter.delete(filter.id, ncMeta));
    return actions;
  }
  if (filter.comparison_op === 'eq') {
    // migrate to `contains all of`
    actions.push(
      await Filter.update(
        filter.id,
        {
          ...filter,
          comparison_op: 'anyof',
          value: newFilterValue,
        },
        ncMeta
      )
    );
  } else if (filter.comparison_op === 'neq') {
    // migrate to `doesn't contain all of`
    actions.push(
      await Filter.update(
        filter.id,
        {
          ...filter,
          comparison_op: 'nanyof',
          value: newFilterValue,
        },
        ncMeta
      )
    );
  }
  return actions;
};

const migrateToCheckboxFilter = async (filter, actions: any[], ncMeta) => {
  if (['empty', 'null'].includes(filter.comparison_op)) {
    // migrate to checked
    actions.push(
      await Filter.update(
        filter.id,
        {
          ...filter,
          comparison_op: 'checked',
        },
        ncMeta
      )
    );
  } else if (['notempty', 'notnull'].includes(filter.comparison_op)) {
    //  migrate to not checked
    actions.push(
      await Filter.update(
        filter.id,
        {
          ...filter,
          comparison_op: 'notchecked',
        },
        ncMeta
      )
    );
  } else if (filter.comparison_op === 'eq') {
    if (['true', 'True', '1', 'T', 'Y'].includes(filter.value)) {
      // migrate to checked
      actions.push(
        await Filter.update(
          filter.id,
          {
            ...filter,
            comparison_op: 'checked',
            value: '',
          },
          ncMeta
        )
      );
    } else {
      // invalid value - good to delete
      actions.push(await Filter.delete(filter.id, ncMeta));
    }
  } else if (filter.comparison_op === 'neq') {
    if (['false', 'False', '0', 'F', 'N'].includes(filter.value)) {
      // migrate to not checked
      actions.push(
        await Filter.update(
          filter.id,
          {
            ...filter,
            comparison_op: 'notchecked',
            value: '',
          },
          ncMeta
        )
      );
    } else {
      // invalid value - good to delete
      actions.push(await Filter.delete(filter.id, ncMeta));
    }
  }
  return actions;
};

async function migrateFilters(ncMeta: NcMetaIO) {
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
      actions = await migrateToCheckboxFilter(filter, actions, ncMeta);
    } else if (col.uidt === UITypes.MultiSelect) {
      actions = await removeLikeFilters(filter, actions, ncMeta);
      actions = await migrateToBlankFilter(filter, actions, ncMeta);
      actions = await migrateMultiSelectEq(filter, actions, col, ncMeta);
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

async function updateProjectMeta(ncMeta: NcMetaIO) {
  const projectHasEmptyOrFilters: Record<string, boolean> = {};
  const filters = await ncMeta.metaList2(null, null, MetaTable.FILTER_EXP);
  let actions = [];
  for (const filter of filters) {
    if (
      ['notempty', 'notnull', 'empty', 'null'].includes(filter.comparison_op)
    ) {
      projectHasEmptyOrFilters[filter.project_id] = true;
    }
  }
  const projects = await ncMeta.metaList2(null, null, MetaTable.PROJECT);
  const defaultProjectMeta = {
    showNullAndEmptyInFilter: false,
  };
  for (const project of projects) {
    const oldProjectMeta = project.meta;
    let newProjectMeta = defaultProjectMeta;
    try {
      newProjectMeta =
        (typeof oldProjectMeta === 'string'
          ? JSON.parse(oldProjectMeta)
          : oldProjectMeta) ?? defaultProjectMeta;
    } catch {}

    newProjectMeta = {
      ...newProjectMeta,
      showNullAndEmptyInFilter: projectHasEmptyOrFilters[project.id] ?? false,
    };

    actions.push(
      await Project.update(project.id, {
        meta: JSON.stringify(newProjectMeta),
      })
    );
  }
  await Promise.all(actions);
}

export default async function ({ ncMeta }: NcUpgraderCtx) {
  // fix the existing filter behaviours or
  // migrate incorrect filters to Blank
  await migrateFilters(ncMeta);
  // enrich `showNullAndEmptyInFilter` in project meta
  // if there is empty / null filters in existing filters
  // -> set `showNullAndEmptyInFilter` to true
  // else false
  await updateProjectMeta(ncMeta);
}
