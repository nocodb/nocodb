export const defaultLimitConfig = {
  limitDefault: Math.max(+process.env.DB_QUERY_LIMIT_DEFAULT || 25, 1),
  limitMin: Math.max(+process.env.DB_QUERY_LIMIT_MIN || 1, 1),
  limitMax: Math.max(+process.env.DB_QUERY_LIMIT_MAX || 1000, 1),
};

export function extractLimitAndOffset(
  args: {
    limit?: number | string;
    offset?: number | string;
    l?: number | string;
    o?: number | string;
  } = {},
) {
  const obj: {
    limit?: number;
    offset?: number;
  } = {};

  // use default value if invalid limit
  // for example, if limit is not a number, it will be ignored
  // if limit is less than 1, it will be ignored
  const limit = +(args.limit || args.l);
  obj.limit = Math.max(
    Math.min(
      limit && limit > 0 && Number.isInteger(limit)
        ? limit
        : defaultLimitConfig.limitDefault,
      defaultLimitConfig.limitMax,
    ),
    defaultLimitConfig.limitMin,
  );

  // skip any invalid offset, ignore negative and non-integer values
  const offset = +(args.offset || args.o) || 0;
  obj.offset = Math.max(Number.isInteger(offset) ? offset : 0, 0);

  return obj;
}
