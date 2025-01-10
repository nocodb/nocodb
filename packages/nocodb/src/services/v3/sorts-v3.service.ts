import { Injectable } from '@nestjs/common';
import type { SortReqType, SortType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { Sort } from '~/models';
import { SortsService } from '~/services/sorts.service';
import {
  builderGenerator,
  sortBuilder,
} from '~/utils/api-v3-data-transformation.builder';
import { NcError } from '~/helpers/catchError';

@Injectable()
export class SortsV3Service {
  private revBuilder;

  constructor(protected readonly sortsService: SortsService) {
    this.revBuilder = builderGenerator({
      allowed: ['id', 'field_id', 'direction'],
      mappings: {
        field_id: 'fk_column_id',
      },
    });
  }

  async sortGet(context: NcContext, param: { sortId: string }) {
    return sortBuilder().build(await this.sortsService.sortGet(context, param));
  }

  async sortDelete(
    context: NcContext,
    param: { viewId: string; sortId: string; req: NcRequest },
  ) {
    const sort = await Sort.get(context, param.sortId ?? '');

    if (!sort || sort.fk_view_id !== param.viewId) {
      NcError.notFound('Sort not found');
    }

    await this.sortsService.sortDelete(context, param);
    return {};
  }

  async sortUpdate(
    context: NcContext,
    param: { sortId: any; sort: SortReqType; req: NcRequest; viewId: string },
  ) {
    const sort = await Sort.get(context, param.sortId ?? '');

    if (!sort || sort.fk_view_id !== param.viewId) {
      NcError.notFound('Sort not found');
    }

    const updateObj = this.revBuilder().build(param.sort);
    await this.sortsService.sortUpdate(context, {
      ...param,
      sort: updateObj,
    });
    return this.sortGet(context, param);
  }

  async sortCreate(
    context: NcContext,
    param: { viewId: any; sort: SortReqType; req: NcRequest },
  ) {
    const sort = await this.sortsService.sortCreate(context, {
      ...param,
      sort: this.revBuilder().build(param.sort),
    });
    return sortBuilder().build(sort);
  }

  async sortList(context: NcContext, param: { viewId: string }) {
    return sortBuilder().build(
      await Sort.list(context, { viewId: param.viewId }),
    ) as SortType[];
  }
}
