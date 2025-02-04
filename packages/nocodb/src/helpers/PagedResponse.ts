import { extractLimitAndOffset } from '.';
import type { PaginatedType, PaginatedV3Type } from 'nocodb-sdk';
import { NcError } from '~/helpers/catchError';

// a utility function which accept baseUrl, path and query params and constructs a url
export function constructUrl({
  baseUrl,
  path,
  query,
}: {
  baseUrl: string;
  path: string;
  query?: Record<string, any>;
}) {
  let url = `${baseUrl}${path}`;
  if (query) {
    const queryStr = new URLSearchParams(query).toString();
    url = `${url}?${queryStr}`;
  }
  return url;
}

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
      page?: number;
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
      nestedNextPageAvail,
      nestedPrevPageAvail,
      queryParams = {},
    }: {
      baseUrl?: string;
      tableId: string;
      nestedNextPageAvail?: boolean;
      nestedPrevPageAvail?: boolean;
      queryParams?: Record<string, any>;
    },
  ) {
    this.list = pagedResponse.list;
    const pageInfo: PaginatedV3Type = {};

    const commonProps = {
      baseUrl,
      path: `/api/v3/tables/${tableId}/records`,
    };

    const commonQueryParams = {};

    if (!pagedResponse.pageInfo.isFirstPage && pagedResponse.pageInfo.page) {
      pageInfo.prev = constructUrl({
        ...commonProps,
        query: { ...commonQueryParams, page: pagedResponse.pageInfo.page - 1 },
      });
    }

    if (!pagedResponse.pageInfo.isLastPage && pagedResponse.pageInfo.page) {
      pageInfo.next = constructUrl({
        ...commonProps,
        query: { ...commonQueryParams, page: pagedResponse.pageInfo.page + 1 },
      });
    }

    const nestedPage = Math.max(+queryParams?.nestedPage, 1);

    if (nestedNextPageAvail) {
      pageInfo.nestedNext = constructUrl({
        ...commonProps,
        query: {
          ...commonQueryParams,
          page: pagedResponse.pageInfo.page,
          nestedPage: nestedPage + 1,
        },
      });
    }

    if (nestedPrevPageAvail) {
      pageInfo.nestedPrev = constructUrl({
        ...commonProps,
        query: {
          ...commonQueryParams,
          page: pagedResponse.pageInfo.page,
          nestedPage: nestedPage - 1,
        },
      });
    }

    this.pageInfo = pageInfo;
  }

  list: Array<T>;
  pageInfo: PaginatedV3Type;
}
