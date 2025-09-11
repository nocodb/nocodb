import { Injectable } from '@nestjs/common';
import type { NcApiVersion } from 'nocodb-sdk';
import type { Model, Source, View } from '~/models';
import type { PagedResponseImpl } from '~/helpers/PagedResponse';
import type { NcContext } from '~/interface/config';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import type { Filter } from '~/models';
import {
  singleQueryList,
  singleQueryRead,
} from '~/services/data-opt/pg-helpers';
import {
  singleQueryList as mysqlSingleQueryList,
  singleQueryRead as mysqlSingleQueryRead,
} from '~/services/data-opt/mysql-helpers';
import { haveFormulaColumn } from '~/db/BaseModelSqlv2';

@Injectable()
export class DataOptService {
  async list(
    context: NcContext,
    ctx: {
      model: Model;
      view: View;
      source: Source;
      params;
      throwErrorIfInvalidParams?: boolean;
      validateFormula?: boolean;
      ignorePagination?: boolean;
      limitOverride?: number;
      baseModel?: BaseModelSqlv2;
      customConditions?: Filter[];
      getHiddenColumns?: boolean;
      apiVersion?: NcApiVersion;
      includeSortAndFilterColumns?: boolean;
      skipSortBasedOnOrderCol?: boolean;
    },
  ): Promise<PagedResponseImpl<Record<string, any>>> {
    const params = { ...(ctx.params || {}) };

    // parse json filter/sort params if found
    if (params) {
      if (params.filterArrJson)
        try {
          params.filterArr = JSON.parse(params.filterArrJson);
        } catch (e) {}

      if (params.sortArrJson)
        try {
          params.sortArr = JSON.parse(params.sortArrJson);
        } catch (e) {}
    }
    try {
      if (['mysql', 'mysql2'].includes(ctx.source.type)) {
        return (await mysqlSingleQueryList(context, {
          ...ctx,
          params,
        })) as PagedResponseImpl<Record<string, any>>;
      }
      return (await singleQueryList(context, {
        ...ctx,
        params,
      })) as PagedResponseImpl<Record<string, any>>;
    } catch (e) {
      if (
        ctx.validateFormula ||
        !haveFormulaColumn(await ctx.model.getColumns(context))
      )
        throw e;
      console.log(e);
      return this.list(context, { ...ctx, validateFormula: true });
    }
  }

  async read(
    context: NcContext,
    ctx: {
      model: Model;
      view: View;
      source: Source;
      params;
      id: string;
      throwErrorIfInvalidParams?: boolean;
      validateFormula?: boolean;
      apiVersion?: NcApiVersion;
    },
  ): Promise<PagedResponseImpl<Record<string, any>>> {
    try {
      if (['mysql', 'mysql2'].includes(ctx.source.type)) {
        return mysqlSingleQueryRead(context, ctx);
      }
      return singleQueryRead(context, ctx);
    } catch (e) {
      if (
        ctx.validateFormula ||
        !haveFormulaColumn(await ctx.model.getColumns(context))
      )
        throw e;
      console.log(e);
      return this.read(context, { ...ctx, validateFormula: true });
    }
  }
}
