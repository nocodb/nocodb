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
    return getListData(ctx);
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
