import { Injectable } from '@nestjs/common';
import type {
  SortCreateV3Type,
  SortReqType,
  SortType,
  SortUpdateV3Type,
} from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { Column, Sort } from '~/models';
import { SortsService } from '~/services/sorts.service';
import {
  builderGenerator,
  sortBuilder,
} from '~/utils/api-v3-data-transformation.builder';
import { NcError } from '~/helpers/catchError';
import { validatePayload } from '~/helpers';

@Injectable()
export class SortsV3Service {
  private revBuilder = builderGenerator<
    SortCreateV3Type | SortUpdateV3Type,
    SortType
  >({
    allowed: ['id', 'field_id', 'direction'],
    mappings: {
      field_id: 'fk_column_id',
    },
  });

  constructor(protected readonly sortsService: SortsService) {}

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
    param: {
      sortId: string;
      sort: SortUpdateV3Type;
      req: NcRequest;
      viewId: string;
    },
  ) {
    validatePayload(
      'swagger-v3.json#/components/schemas/SortUpdate',
      param.sort,
      true,
    );

    let sort;

    if (param.sortId) {
      sort = await Sort.get(context, param.sortId);
    } else {
      const sorts = await Sort.list(context, { viewId: param.viewId });
      sort = sorts.find((s) => s.fk_column_id === param.sort.field_id);
    }

    if (!sort || sort.fk_view_id !== param.viewId) {
      NcError.notFound('Sort not found');
    }

    const updateObj = this.revBuilder().build(param.sort);
    await this.sortsService.sortUpdate(context, {
      ...param,
      sortId: sort.id,
      sort: updateObj as SortReqType,
    });
    return this.sortGet(context, param);
  }

  async sortCreate(
    context: NcContext,
    param: { viewId: string; sort: SortCreateV3Type; req: NcRequest },
  ) {
    validatePayload(
      'swagger-v3.json#/components/schemas/SortCreate',
      param.sort,
      true,
    );

    // check for existing filter with same field
    const sorts = await Sort.list(context, { viewId: param.viewId });
    const existingSort = sorts.find(
      (s) => s.fk_column_id === param.sort.field_id,
    );
    if (existingSort) {
      NcError.badRequest('Sort already exists for this field');
    }

    // check column exists
    const column = await Column.get(context, { colId: param.sort.field_id });

    if (!column) {
      NcError.notFound('Column not found');
    }

    const sort = await this.sortsService.sortCreate(context, {
      ...param,
      sort: this.revBuilder().build(param.sort) as SortReqType,
    });
    return sortBuilder().build(sort);
  }

  async sortList(context: NcContext, param: { viewId: string }) {
    return sortBuilder().build(
      await Sort.list(context, { viewId: param.viewId }),
    ) as SortType[];
  }
}
