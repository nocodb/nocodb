import type { PaginatedType } from 'nocodb-sdk';

const config: any = {
  limitDefault: Math.max(+process.env.DB_QUERY_LIMIT_DEFAULT || 25, 1),
  limitMin: Math.max(+process.env.DB_QUERY_LIMIT_MIN || 1, 1),
  limitMax: Math.max(+process.env.DB_QUERY_LIMIT_MAX || 1000, 1),
};

export class PagedResponseImpl<T> {
  constructor(
    list: T[],
    args: {
      limit?: number;
      offset?: number;
      count?: number | string;
      l?: number;
      o?: number;
    } = {}
  ) {
    const limit = Math.max(
      Math.min(args.limit || args.l || config.limitDefault, config.limitMax),
      config.limitMin
    );

    const offset = Math.max(+(args.offset || args.o) || 0, 0);

    let count = args.count ?? null;

    if (count !== null) count = +count;

    this.list = list;

    if (count !== null) {
      this.pageInfo = { totalRows: +count };
      this.pageInfo.page = offset ? offset / limit + 1 : 1;
      this.pageInfo.pageSize = limit;
      this.pageInfo.isFirstPage =
        this.pageInfo.isFirstPage ?? this.pageInfo.page === 1;
      this.pageInfo.isLastPage =
        this.pageInfo.page ===
        (Math.ceil(this.pageInfo.totalRows / this.pageInfo.pageSize) || 1);
    }
  }

  list: Array<T>;
  pageInfo: PaginatedType;
}
