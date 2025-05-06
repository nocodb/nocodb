import { CURRENT_USER_TOKEN, type NcContext, UITypes } from 'nocodb-sdk';
import { isFilterValueConsistOf } from '~/helpers/dbHelpers';
import { travelLookupColumn } from '~/helpers/columnHelpers';
import { Column, type Filter } from '~/models';

export function shouldSkipCache(
  ctx: {
    params: any;
    validateFormula?: boolean;
    customConditions?: Filter[];
  },
  isList = true,
) {
  const queryParamKeys = isList
    ? [
        'sortArr',
        'filterArr',
        'sort',
        'filter',
        'where',
        'w',
        'fields',
        'f',
        'nested',
        'shuffle',
        'r',
        'pks',
      ]
    : ['filterArr', 'filter', 'where', 'w', 'fields', 'f', 'nested'];
  return (
    process.env.NC_DISABLE_CACHE === 'true' ||
    ctx.validateFormula ||
    queryParamKeys.some((key) => key in ctx.params) ||
    ctx.customConditions?.length > 0
  );
}

export const checkForStaticDateValFilters = (filters) => {
  return filters.some((filter) => {
    if (Array.isArray(filter.children)) {
      return checkForStaticDateValFilters(filter.children);
    }
    return (
      filter.comparison_sub_op &&
      [
        'today',
        'tomorrow',
        'yesterday',
        'oneWeekAgo',
        'oneWeekFromNow',
        'oneMonthAgo',
        'oneMonthFromNow',
        'daysAgo',
        'daysFromNow',
        'exactDate',
        'pastWeek',
        'pastMonth',
        'pastYear',
        'nextWeek',
        'nextMonth',
        'nextYear',
        'pastNumberOfDays',
        'nextNumberOfDays',
      ].includes(filter.comparison_sub_op)
    );
  });
};

export const checkForCurrentUserFilters = async ({
  context,
  filters,
}: {
  context: NcContext;
  filters: Filter[];
}) => {
  for (const filter of filters) {
    if (filter.is_group && filter.children && filter.children.length > 0) {
      const childResult = checkForCurrentUserFilters({
        context,
        filters: filter.children,
      });
      if (childResult === true) {
        return childResult;
      }
    }
    if (!filter.is_group && filter.fk_column_id) {
      const filterValueCurrentUserTokenResult = isFilterValueConsistOf(
        filter.value,
        CURRENT_USER_TOKEN,
      );
      if (filterValueCurrentUserTokenResult?.exists) {
        const column = await Column.get(context, {
          colId: filter.fk_column_id!,
        });
        if (
          [UITypes.User, UITypes.CreatedBy, UITypes.LastModifiedBy].includes(
            column.uidt,
          )
        ) {
          return true;
        }
        if ([UITypes.Lookup].includes(column.uidt)) {
          const actualColumn = travelLookupColumn({ context, column });
          if (
            [UITypes.User, UITypes.CreatedBy, UITypes.LastModifiedBy].includes(
              actualColumn.uidt,
            )
          ) {
            return true;
          }
        }
      }
    }
  }
  return false;
};
