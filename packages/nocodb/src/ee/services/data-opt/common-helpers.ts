import type { NcContext } from '~/interface/config';
import type { Filter, Source } from '~/models';
import { isMysqlVersionSupported } from '~/services/data-opt/mysql-helpers';

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
    ctx.customConditions?.length
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
