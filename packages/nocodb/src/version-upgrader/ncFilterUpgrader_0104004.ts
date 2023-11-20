import { UITypes } from 'nocodb-sdk';
import type { MetaService } from '~/meta/meta.service';
import type { NcUpgraderCtx } from './NcUpgrader';
import type { SelectOptionsType } from 'nocodb-sdk';
import { MetaTable } from '~/utils/globals';
import Column from '~/models/Column';
import Filter from '~/models/Filter';
import Base from '~/models/Base';

// as of 0.104.3, almost all filter operators are available to all column types
// while some of them aren't supposed to be shown
// this upgrader is to remove those unsupported filters / migrate to the correct filter

// Change Summary:
// - Text-based columns:
//     - remove `>`, `<`, `>=`, `<=`
//     - Numeric-based / SingleSelect columns:
//     - remove `like`
//     - migrate `null`, and `empty` to `blank`
// - Checkbox columns:
//     - remove `equal`
//     - migrate `empty` and `null` to `notchecked`
// - MultiSelect columns:
//     - remove `like`
//     - migrate `equal`, `null`, `empty`
//     - Attachment columns:
//     - remove `>`, `<`, `>=`, `<=`, `equal`
//     - migrate `empty`, `null` to `blank`
// - LTAR columns:
//     - remove `>`, `<`, `>=`, `<=`
//     - migrate `empty`, `null` to `blank`
// - Lookup columns:
//     - migrate `empty`, `null` to `blank`
// - Duration columns:
//     - remove  `like`
//     - migrate `empty`, `null` to `blank`

const removeEqualFilters = (filter, ncMeta) => {
  const actions = [];
  // remove `is equal`, `is not equal`
  if (['eq', 'neq'].includes(filter.comparison_op)) {
    actions.push(Filter.delete(filter.id, ncMeta));
  }
  return actions;
};

const removeArithmeticFilters = (filter, ncMeta) => {
  const actions = [];
  // remove `>`, `<`, `>=`, `<=`
  if (['gt', 'lt', 'gte', 'lte'].includes(filter.comparison_op)) {
    actions.push(Filter.delete(filter.id, ncMeta));
  }
  return actions;
};

const removeLikeFilters = (filter, ncMeta) => {
  const actions = [];
  // remove `is like`, `is not like`
  if (['like', 'nlike'].includes(filter.comparison_op)) {
    actions.push(Filter.delete(filter.id, ncMeta));
  }
  return actions;
};

const migrateNullAndEmptyToBlankFilters = (filter, ncMeta) => {
  const actions = [];
  if (['empty', 'null'].includes(filter.comparison_op)) {
    // migrate to blank
    actions.push(
      Filter.update(
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
        filter.id,
        {
          comparison_op: 'notblank',
        },
        ncMeta,
      ),
    );
  }
  return actions;
};

const migrateMultiSelectEq = async (filter, col: Column, ncMeta) => {
  // only allow eq / neq
  if (!['eq', 'neq'].includes(filter.comparison_op)) return;
  // if there is no value -> delete this filter
  if (!filter.value) {
    return await Filter.delete(filter.id, ncMeta);
  }
  // options inputted from users
  const options = filter.value.split(',');
  // retrieve the possible col options
  const colOptions = (await col.getColOptions()) as SelectOptionsType;
  // only include valid options as the input value becomes dropdown type now
  const validOptions = [];
  for (const option of options) {
    if (colOptions.options.includes(option)) {
      validOptions.push(option);
    }
  }
  const newFilterValue = validOptions.join(',');
  // if all inputted options are invalid -> delete this filter
  if (!newFilterValue) {
    return await Filter.delete(filter.id, ncMeta);
  }
  const actions = [];
  if (filter.comparison_op === 'eq') {
    // migrate to `contains all of`
    actions.push(
      Filter.update(
        filter.id,
        {
          comparison_op: 'anyof',
          value: newFilterValue,
        },
        ncMeta,
      ),
    );
  } else if (filter.comparison_op === 'neq') {
    // migrate to `doesn't contain all of`
    actions.push(
      Filter.update(
        filter.id,
        {
          comparison_op: 'nanyof',
          value: newFilterValue,
        },
        ncMeta,
      ),
    );
  }
  return await Promise.all(actions);
};

const migrateToCheckboxFilter = (filter, ncMeta) => {
  const actions = [];
  const possibleTrueValues = ['true', 'True', '1', 'T', 'Y'];
  const possibleFalseValues = ['false', 'False', '0', 'F', 'N'];
  if (['empty', 'null'].includes(filter.comparison_op)) {
    // migrate to not checked
    actions.push(
      Filter.update(
        filter.id,
        {
          comparison_op: 'notchecked',
        },
        ncMeta,
      ),
    );
  } else if (['notempty', 'notnull'].includes(filter.comparison_op)) {
    //  migrate to checked
    actions.push(
      Filter.update(
        filter.id,
        {
          comparison_op: 'checked',
        },
        ncMeta,
      ),
    );
  } else if (filter.comparison_op === 'eq') {
    if (possibleTrueValues.includes(filter.value)) {
      // migrate to checked
      actions.push(
        Filter.update(
          filter.id,
          {
            comparison_op: 'checked',
            value: '',
          },
          ncMeta,
        ),
      );
    } else if (possibleFalseValues.includes(filter.value)) {
      // migrate to notchecked
      actions.push(
        Filter.update(
          filter.id,
          {
            comparison_op: 'notchecked',
            value: '',
          },
          ncMeta,
        ),
      );
    } else {
      // invalid value - good to delete
      actions.push(Filter.delete(filter.id, ncMeta));
    }
  } else if (filter.comparison_op === 'neq') {
    if (possibleFalseValues.includes(filter.value)) {
      // migrate to checked
      actions.push(
        Filter.update(
          filter.id,
          {
            comparison_op: 'checked',
            value: '',
          },
          ncMeta,
        ),
      );
    } else if (possibleTrueValues.includes(filter.value)) {
      // migrate to not checked
      actions.push(
        Filter.update(
          filter.id,
          {
            comparison_op: 'notchecked',
            value: '',
          },
          ncMeta,
        ),
      );
    } else {
      // invalid value - good to delete
      actions.push(Filter.delete(filter.id, ncMeta));
    }
  }
  return actions;
};

async function migrateFilters(ncMeta: MetaService) {
  const filters = await ncMeta.metaList2(null, null, MetaTable.FILTER_EXP);
  for (const filter of filters) {
    if (!filter.fk_column_id || filter.is_group) {
      continue;
    }
    const col = await Column.get({ colId: filter.fk_column_id }, ncMeta);
    if (
      [
        UITypes.SingleLineText,
        UITypes.LongText,
        UITypes.PhoneNumber,
        UITypes.Email,
        UITypes.URL,
      ].includes(col.uidt)
    ) {
      await Promise.all(removeArithmeticFilters(filter, ncMeta));
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
      await Promise.all([
        ...removeLikeFilters(filter, ncMeta),
        ...migrateNullAndEmptyToBlankFilters(filter, ncMeta),
      ]);
    } else if (col.uidt === UITypes.Checkbox) {
      await Promise.all(migrateToCheckboxFilter(filter, ncMeta));
    } else if (col.uidt === UITypes.MultiSelect) {
      await Promise.all([
        ...removeLikeFilters(filter, ncMeta),
        ...migrateNullAndEmptyToBlankFilters(filter, ncMeta),
      ]);
      await migrateMultiSelectEq(filter, col, ncMeta);
    } else if (col.uidt === UITypes.Attachment) {
      await Promise.all([
        ...removeArithmeticFilters(filter, ncMeta),
        ...removeEqualFilters(filter, ncMeta),
        ...migrateNullAndEmptyToBlankFilters(filter, ncMeta),
      ]);
    } else if (col.uidt === UITypes.LinkToAnotherRecord) {
      await Promise.all([
        ...removeArithmeticFilters(filter, ncMeta),
        ...migrateNullAndEmptyToBlankFilters(filter, ncMeta),
      ]);
    } else if (col.uidt === UITypes.Lookup) {
      await Promise.all([
        ...removeArithmeticFilters(filter, ncMeta),
        ...migrateNullAndEmptyToBlankFilters(filter, ncMeta),
      ]);
    } else if (col.uidt === UITypes.Duration) {
      await Promise.all([
        ...removeLikeFilters(filter, ncMeta),
        ...migrateNullAndEmptyToBlankFilters(filter, ncMeta),
      ]);
    }
  }
}

async function updateProjectMeta(ncMeta: MetaService) {
  const baseHasEmptyOrFilters: Record<string, boolean> = {};

  const filters = await ncMeta.metaList2(null, null, MetaTable.FILTER_EXP);

  const actions = [];

  for (const filter of filters) {
    if (
      ['notempty', 'notnull', 'empty', 'null'].includes(filter.comparison_op)
    ) {
      baseHasEmptyOrFilters[filter.base_id] = true;
    }
  }

  const bases = await ncMeta.metaList2(null, null, MetaTable.PROJECT);

  const defaultProjectMeta = {
    showNullAndEmptyInFilter: false,
  };

  for (const base of bases) {
    const oldProjectMeta = base.meta;
    let newProjectMeta = defaultProjectMeta;
    try {
      newProjectMeta =
        (typeof oldProjectMeta === 'string'
          ? JSON.parse(oldProjectMeta)
          : oldProjectMeta) ?? defaultProjectMeta;
    } catch {}

    newProjectMeta = {
      ...newProjectMeta,
      showNullAndEmptyInFilter: baseHasEmptyOrFilters[base.id] ?? false,
    };

    actions.push(
      Base.update(
        base.id,
        {
          meta: JSON.stringify(newProjectMeta),
        },
        ncMeta,
      ),
    );
  }
  await Promise.all(actions);
}

export default async function ({ ncMeta }: NcUpgraderCtx) {
  // fix the existing filter behaviours or
  // migrate `null` or `empty` filters to `blank`
  await migrateFilters(ncMeta);
  // enrich `showNullAndEmptyInFilter` in base meta
  // if there is empty / null filters in existing bases,
  // then set `showNullAndEmptyInFilter` to true
  // else set to false
  await updateProjectMeta(ncMeta);
}
