import { Injectable } from '@nestjs/common';
import type { Model, Source, View } from '~/models';
import type { PagedResponseImpl } from '~/helpers/PagedResponse';
import { singleQueryList, singleQueryRead } from '~/services/data-opt/helpers';
import {
  singleQueryList as mysqlSingleQueryList,
  singleQueryRead as mysqlSingleQueryRead,
} from '~/services/data-opt/mysql-helpers';

@Injectable()
export class DataOptService {
  async list(ctx: {
    model: Model;
    view: View;
    source: Source;
    params;
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
    if (['mysql', 'mysql2'].includes(ctx.source.type)) {
      return mysqlSingleQueryList({ ...ctx, params });
    }
    return singleQueryList({ ...ctx, params });
  }

  async read(ctx: {
    model: Model;
    view: View;
    source: Source;
    params;
    id: string;
  }): Promise<PagedResponseImpl<Record<string, any>>> {
    if (['mysql', 'mysql2'].includes(ctx.source.type)) {
      return mysqlSingleQueryRead(ctx);
    }
    return singleQueryRead(ctx);
  }
}
