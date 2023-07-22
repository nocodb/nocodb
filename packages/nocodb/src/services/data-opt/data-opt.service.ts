import { Injectable } from '@nestjs/common';
import type { Base, Model, View } from '~/models';
import type { PagedResponseImpl } from '~/helpers/PagedResponse';
import { getListData, readByPk } from '~/services/data-opt/helpers';

@Injectable()
export class DataOptService {
  async list(ctx: {
    model: Model;
    view: View;
    base: Base;
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

    return getListData({ ...ctx, params });
  }

  async read(ctx: {
    model: Model;
    view: View;
    base: Base;
    params;
    id: string;
  }): Promise<PagedResponseImpl<Record<string, any>>> {
    return readByPk(ctx);
  }
}
