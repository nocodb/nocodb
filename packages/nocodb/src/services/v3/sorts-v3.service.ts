import { Injectable } from '@nestjs/common';
import type { SortReqType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { Sort } from '~/models';
import { SortsService } from '~/services/sorts.service';
import {builderGenerator, sortBuilder} from '~/utils/api-v3-data-transformation.builder';

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
    param: { sortId: string; req: NcRequest },
  ) {
    await this.sortsService.sortDelete(context, param);
    return {};
  }

  async sortUpdate(
    context: NcContext,
    param: { sortId: any; sort: SortReqType; req: NcRequest },
  ) {
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
    return sortBuilder().build(Sort.list(context, { viewId: param.viewId }));
  }
}
