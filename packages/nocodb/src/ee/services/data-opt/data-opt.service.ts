import { Injectable } from '@nestjs/common';
import type { Model, Source, View } from '~/models';
import type { PagedResponseImpl } from '~/helpers/PagedResponse';
import { singleQueryList, singleQueryRead } from '~/services/data-opt/helpers';
import {
  singleQueryList as mysqlSingleQueryList,
  singleQueryRead as mysqlSingleQueryRead,
} from '~/services/data-opt/mysql-helpers';
import { haveFormulaColumn } from '~/db/BaseModelSqlv2';

@Injectable()
export class DataOptService {
  async list(ctx: {
    model: Model;
    view: View;
    source: Source;
    params;
    throwErrorIfInvalidParams?: boolean;
    validateFormula?: boolean;
  }): Promise<PagedResponseImpl<Record<string, any>>> {
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
        return await mysqlSingleQueryList({ ...ctx, params });
      }
      return await singleQueryList({ ...ctx, params });
    } catch (e) {
      if (
        ctx.validateFormula ||
        !haveFormulaColumn(await ctx.model.getColumns())
      )
        throw e;
      console.log(e);
      return this.list({ ...ctx, validateFormula: true });
    }
  }

  async read(ctx: {
    model: Model;
    view: View;
    source: Source;
    params;
    id: string;
    throwErrorIfInvalidParams?: boolean;
    validateFormula?: boolean;
  }): Promise<PagedResponseImpl<Record<string, any>>> {
    try {
      if (['mysql', 'mysql2'].includes(ctx.source.type)) {
        return mysqlSingleQueryRead(ctx);
      }
      return singleQueryRead(ctx);
    } catch (e) {
      if (
        ctx.validateFormula ||
        !haveFormulaColumn(await ctx.model.getColumns())
      )
        throw e;
      console.log(e);
      return this.read({ ...ctx, validateFormula: true });
    }
  }
}
