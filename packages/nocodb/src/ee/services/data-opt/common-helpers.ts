import type { Filter } from '~/models';

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
