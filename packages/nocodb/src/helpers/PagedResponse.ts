import { extractLimitAndOffset } from '.';
import type { PaginatedType, PaginatedV3Type } from 'nocodb-sdk';
import { NcError } from '~/helpers/catchError';

export class PagedResponseImpl<T> {
  constructor(
    list: T[],
    args: {
      limit?: number;
      offset?: number;
      count?: number | string;
      l?: number;
      o?: number;
      limitOverride?: number;
    } = {},
    additionalProps?: Record<string, any>,
  ) {
    const { offset, limit } = extractLimitAndOffset(args);

    let count = args.count ?? null;

    if (count !== null) count = +count;

    this.list = list;

    if (count !== null && count !== undefined) {
      this.pageInfo = { totalRows: +count };
      this.pageInfo.page = offset ? offset / limit + 1 : 1;
      this.pageInfo.pageSize = limit;
      this.pageInfo.isFirstPage =
        this.pageInfo.isFirstPage ?? this.pageInfo.page === 1;
      this.pageInfo.isLastPage =
        this.pageInfo.page >=
        (Math.ceil(this.pageInfo.totalRows / this.pageInfo.pageSize) || 1);

      if (this.pageInfo.page % 1 !== 0) {
        this.pageInfo.offset = offset;
        delete this.pageInfo.page;
      }

      if (offset && offset >= +count) {
        NcError.invalidOffsetValue(offset);
      }
    }

    if (additionalProps) Object.assign(this, additionalProps);
  }

  list: Array<T>;
  pageInfo: PaginatedType;
  errors?: any[];
}

export class PagedResponseV3Impl<T> {
  next?: string;
  prev?: string;
  nestedNext?: string;
  nestedPrev?: string;

  constructor(
    pagedResponse: PagedResponseImpl<T>,
    {
      baseUrl = '',
      tableId,
    }: {
      baseUrl?: string;
      tableId: string;
    },
  ) {
    this.list = pagedResponse.list;
    const pageInfo: PaginatedV3Type = {};

    if (!pagedResponse.pageInfo.isFirstPage && pagedResponse.pageInfo.page) {
      pageInfo.prev = `${baseUrl}/api/v3/tables/${tableId}/records?page=${
        pagedResponse.pageInfo.page - 1
      }`;
    }

    if (!pagedResponse.pageInfo.isLastPage && pagedResponse.pageInfo.page) {
      pageInfo.next = `${baseUrl}/api/v3/tables/${tableId}/records?page=${
        pagedResponse.pageInfo.page + 1
      }`;
    }

    this.pageInfo = pageInfo;
  }

  list: Array<T>;
  pageInfo: PaginatedV3Type;
}
