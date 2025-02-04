export const defaultLimitConfig = {
  limitDefault: Math.max(+process.env.DB_QUERY_LIMIT_DEFAULT || 25, 1),
  limitMin: Math.max(+process.env.DB_QUERY_LIMIT_MIN || 10, 1),
  limitMax: Math.max(+process.env.DB_QUERY_LIMIT_MAX || 1000, 1),
  ltarV3Limit: Math.max(+process.env.DB_QUERY_LIMIT_LTAR_V3_LIMIT || 1000, 1),
} as const;

export const defaultGroupByLimitConfig = {
  limitGroup: Math.max(+process.env.DB_QUERY_LIMIT_GROUP_BY_GROUP || 25, 1),
  limitRecord: Math.max(+process.env.DB_QUERY_LIMIT_GROUP_BY_RECORD || 10, 1),
} as const;

export function extractLimitAndOffset(
  args: {
    limit?: number | string;
    offset?: number | string;
    l?: number | string;
    o?: number | string;
    limitOverride?: number;
    page?: number | string;
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

  if (args.page) {
    obj.offset = Math.max((+args.page - 1) * obj.limit, 0);
  } else {
    // skip any invalid offset, ignore negative and non-integer values
    const offset = +(args.offset || args.o) || 0;
    obj.offset = Math.max(Number.isInteger(offset) ? offset : 0, 0);
  }
  // override limit if provided
  if (args.limitOverride) {
    obj.limit = +args.limitOverride;
  }

  return obj;
}
