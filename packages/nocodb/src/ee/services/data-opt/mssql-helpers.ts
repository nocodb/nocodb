import { ClientType } from 'nocodb-sdk';
import type { NcApiVersion } from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { PagedResponseImpl } from '~/helpers/PagedResponse';
import type { NcContext } from '~/interface/config';
import type { Filter, Model, View } from '~/models';
import { DBQueryClient } from '~/dbQueryClient';
import { Source } from '~/models';

export async function singleQueryRead(
  context: NcContext,
  ctx: {
    model: Model;
    view: View;
    source: Source;
    params;
    id: string | Record<string, any>;
    getHiddenColumn?: boolean;
    throwErrorIfInvalidParams?: boolean;
    validateFormula?: boolean;
    apiVersion?: NcApiVersion;
    extractOnlyPrimaries?: boolean;
    extractOrderColumn?: boolean;
    customConditions?: Filter[];
    ignoreRls?: boolean;
    deletedOnly?: boolean;
    fk_display_value_column_id?: string | null;
    skipPublicRedaction?: boolean;
  },
): Promise<Record<string, any>> {
  const dbQuery = DBQueryClient.get(ClientType.MSSQL);
  return dbQuery.singleQueryRead(context, ctx);
}

export async function singleQueryList(
  context: NcContext,
  ctx: {
    model: Model;
    view?: View;
    source: Source;
    params;
    throwErrorIfInvalidParams?: boolean;
    validateFormula?: boolean;
    ignorePagination?: boolean;
    limitOverride?: number;
    baseModel?: IBaseModelSqlV2;
    customConditions?: Filter[];
    getHiddenColumns?: boolean;
    apiVersion?: NcApiVersion;
    includeSortAndFilterColumns?: boolean;
    skipPaginateWrapper?: boolean;
    skipSortBasedOnOrderCol?: boolean;
    ignoreViewFilterAndSort?: boolean;
    ignoreRls?: boolean;
    deletedOnly?: boolean;
    fk_display_value_column_id?: string | null;
  },
): Promise<
  PagedResponseImpl<Record<string, any>> | Array<Record<string, any>>
> {
  const dbQuery = DBQueryClient.get(ClientType.MSSQL);
  return dbQuery.singleQueryList(context, ctx);
}
