import { extractLimitAndOffset } from '.';
import type { PaginatedType } from 'nocodb-sdk';

export class PagedResponseImpl<T> {
  constructor(
    list: T[],
    args: {
      limit?: number;
      offset?: number;
      count?: number | string;
      l?: number;
      o?: number;
    } = {},
    additionalProps?: Record<string, any>,
  ) {
    const { offset, limit } = extractLimitAndOffset(args);

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

    if (additionalProps) Object.assign(this, additionalProps);

    if (offset && offset >= +count) {
      this.errors = [
        {
          message: 'Offset is beyond the total number of records',
        },
      ];
    }
  }

  list: Array<T>;
  pageInfo: PaginatedType;
  errors?: any[];
}
