import { extractLimitAndOffset } from '.';
import type { NcContext, PaginatedType, PaginatedV3Type } from 'nocodb-sdk';
import { NcError } from '~/helpers/catchError';
import { extractProps } from '~/helpers/extractProps';

type SearchParamValue = string | number | boolean | null | undefined;
type SearchParamsObject = {
  [key: string]: SearchParamValue | SearchParamValue[];
};

// handle fields[] in array format
function objectToSearchParams(obj: SearchParamsObject): URLSearchParams {
  const params = new URLSearchParams();

  Object.entries(obj).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item !== null && item !== undefined) {
          params.append(key, String(item));
        }
      });
    } else if (value !== null && value !== undefined) {
      params.append(key, String(value));
    }
  });

  return params;
}

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
    const queryStr = objectToSearchParams(query).toString();
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
      /** Return an empty page past the end instead of throwing. */
      allowPastEnd?: boolean;
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

      if (offset && offset >= +count && !args.allowPastEnd) {
        // `details` lets a caller rebuild this page (see `allowPastEnd`).
        NcError.invalidOffsetValue(offset, {
          details: { offset, limit, totalRows: +count },
        });
      }
    }

    if (additionalProps) Object.assign(this, additionalProps);
  }

  list: Array<T>;
  pageInfo: PaginatedType;
  errors?: any[];
}

// With `excludeCount` the list carries no pageInfo: take the page from the
// request, and assume a next page only when a full page came back.
function countlessPageInfo(
  list: unknown[],
  queryParams: Record<string, any> = {},
): PaginatedType {
  const { limit, offset } = extractLimitAndOffset({
    limit: +queryParams.limit || +queryParams.pageSize,
    offset: queryParams.offset,
    page: queryParams.page,
  });
  const page = offset / limit + 1;
  return {
    page: page % 1 === 0 ? page : undefined,
    pageSize: limit,
    isFirstPage: offset === 0,
    isLastPage: (list?.length ?? 0) < limit,
  };
}

export class PagedResponseV3Impl<T> {
  next?: string;
  prev?: string;
  nestedNext?: string;
  nestedPrev?: string;

  constructor(
    pagedResponse: PagedResponseImpl<T>,
    {
      context,
      baseUrl = '',
      tableId,
      path,
      nestedNextPageAvail,
      nestedPrevPageAvail,
      queryParams = {},
    }: {
      context: NcContext;
      baseUrl?: string;
      tableId: string;
      /**
       * Path the next/prev URLs are built on. Defaults to the table records
       * path; the linked-records list passes its own `/links/...` path so the
       * URLs page the link list and not the parent table.
       */
      path?: string;
      nestedNextPageAvail?: boolean;
      nestedPrevPageAvail?: boolean;
      queryParams?: Record<string, any>;
    },
  ) {
    this.list = pagedResponse.list;
    const pageInfo: PaginatedV3Type = {};
    const info =
      pagedResponse.pageInfo ??
      countlessPageInfo(pagedResponse.list, queryParams);

    const commonProps = {
      baseUrl,
      path: path ?? `/api/v3/data/${context.base_id}/${tableId}/records`,
    };

    const commonQueryParams = extractProps(queryParams || {}, [
      'sort',
      'where',
      'viewId',
      'nestedLimit',
      'fieldIdOnResult',
      'fields',
      'nestedPage',
      'linksAsLtar',
      'excludeCount',
    ]);

    // The page numbers below are derived from the page size the request
    // actually used, so the URL has to carry that size — without it the next
    // page is read at the default size from an offset computed at the
    // caller's, and rows repeat. `limit` and `pageSize` are both accepted on
    // the way in and `limit` wins, so emit the single resolved size instead of
    // echoing back whichever name the caller happened to use.
    const resolvedPageSize =
      info.pageSize ??
      (+queryParams?.limit || +queryParams?.pageSize || undefined);

    if (!info.isFirstPage && info.page) {
      // Past the end, `prev` is the last page that has records (1 if none).
      const lastPage =
        info.totalRows !== undefined && info.pageSize
          ? Math.max(Math.ceil(info.totalRows / info.pageSize), 1)
          : Infinity;
      pageInfo.prev = constructUrl({
        ...commonProps,
        query: {
          ...commonQueryParams,
          page: Math.min(info.page - 1, lastPage),
          pageSize: resolvedPageSize,
        },
      });
    }

    if (!info.isLastPage && info.page) {
      pageInfo.next = constructUrl({
        ...commonProps,
        query: {
          ...commonQueryParams,
          page: info.page + 1,
          pageSize: resolvedPageSize,
        },
      });
    }

    const nestedPage = Math.max(+queryParams?.nestedPage, 1);

    if (nestedNextPageAvail) {
      pageInfo.nestedNext = constructUrl({
        ...commonProps,
        query: {
          ...commonQueryParams,
          page: info.page,
          pageSize: resolvedPageSize,
          nestedPage: nestedPage + 1,
        },
      });
    }

    if (nestedPrevPageAvail) {
      pageInfo.nestedPrev = constructUrl({
        ...commonProps,
        query: {
          ...commonQueryParams,
          page: info.page,
          pageSize: resolvedPageSize,
          nestedPage: nestedPage - 1,
        },
      });
    }

    this.pageInfo = pageInfo;
  }

  list: Array<T>;
  pageInfo: PaginatedV3Type;
}
