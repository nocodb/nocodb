import { PaginatedType } from 'nocodb-sdk';

export class PagedResponseImpl<T> {
  constructor(
    list: T[],
    {
      limit = 25,
      offset = 0,
      count = null
    }: { limit?: number; offset?: number; count?: number } = {}
  ) {
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
