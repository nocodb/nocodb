import { Injectable } from '@nestjs/common';
import { AppEvents } from 'nocodb-sdk';
import type { FilterReqType, UserType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import { Filter, Hook, View } from '~/models';
import {
  filterBuilder,
  filterRevBuilder,
} from '~/utils/api-v3-data-transformation.builder';
import { FiltersService } from '~/services/filters.service';

@Injectable()
export class FiltersV3Service {
  constructor(
    protected readonly appHooksService: AppHooksService,
    protected readonly filtersService: FiltersService,
  ) {}

  async filterCreate(
    context: NcContext,
    param: {
      filter: FilterReqType;
      user: UserType;
      req: NcRequest;
    } & ({ viewId: string } | { hookId: string }),
  ) {
    validatePayload(
      'swagger-v3.json#/components/schemas/FilterV3Req',
      param.filter,
    );

    const { additionalProps, additionalAuditProps } =
      await this.extractAdditionalProps(param, context);

    const filter = await Filter.insert(context, {
      ...param.filter,
      ...additionalProps,
    });

    this.appHooksService.emit(AppEvents.FILTER_CREATE, {
      filter,
      req: param.req,
      ...additionalAuditProps,
    });

    return filterBuilder().build(filter);
  }

  private async extractAdditionalProps(
    param:
      | ({ filter: FilterReqType; user: UserType; req: NcRequest } & {
          viewId: string;
        })
      | ({
          filter: FilterReqType;
          user: UserType;
          req: NcRequest;
        } & { hookId: string })
      | ({ filter: FilterReqType; user: UserType; req: NcRequest } & {
          viewId: string;
        } & {
          viewId: unknown;
        }),
    context: NcContext,
  ) {
    let additionalProps = {};
    let additionalAuditProps = {};

    if ('hookId' in param) {
      const hook = await Hook.get(context, param.hookId);

      if (!hook) {
        NcError.hookNotFound(param.hookId);
      }

      additionalProps = {
        fk_hook_id: param.hookId,
      };
      additionalAuditProps = {
        hook,
      };
    } else if ('viewId' in param) {
      const view = await View.get(context, param.viewId);

      if (!view) {
        NcError.viewNotFound(param.viewId);
      }

      additionalProps = {
        fk_view_id: param.viewId,
      };
      additionalAuditProps = {
        view,
      };
    }
    return { additionalProps, additionalAuditProps };
  }

  async filterDelete(
    context: NcContext,
    param: { filterId: string; req: NcRequest },
  ) {
    await this.filtersService.filterDelete(context, param);

    return {};
  }

  async filterCreate(
    context: NcContext,
    param: {
      filter: FilterReqType;
      viewId: string;
      user: UserType;
      req: NcRequest;
    },
  ) {
    validatePayload('swagger.json#/components/schemas/FilterReq', param.filter);

    const view = await View.get(context, param.viewId);

    const remappedFilter = filterRevBuilder().build(param.filter);

    const filter = await Filter.insert(context, {
      ...remappedFilter,
      fk_view_id: param.viewId,
    });

    this.appHooksService.emit(AppEvents.FILTER_CREATE, {
      filter,
      view,
      req: param.req,
    });

    return filterBuilder().build(filter);
  }

  async filterUpdate(
    context: NcContext,
    param: {
      filter: FilterReqType;
      filterId: string;
      user: UserType;
      req: NcRequest;
    },
  ) {
    validatePayload('swagger-v3.json#/components/schemas/FilterReq', param.filter);

    const filter = await Filter.get(context, param.filterId);

    if (!filter) {
      NcError.badRequest('Filter not found');
    }

    const remappedFilter = filterRevBuilder().build(param.filter);

    await this.filtersService.filterUpdate(context, {
      filterId: param.filterId,
      filter: remappedFilter,
      user: param.user,
      req: param.req,
    });

    return filterBuilder().build(await Filter.get(context, param.filterId));
  }

  async filterList(
    context: NcContext,
    param: { viewId: string } | { hookId: boolean } | { linkColumnId: boolean },
  ) {
    let filters = [];

    if ('hookId' in param && param.hookId) {
      filters = await Filter.allHookFilterList(context, {
        hookId: param.hookId,
      });
    } else if ('linkColumnId' in param && param.linkColumnId) {
      filters = await Filter.allLinkFilterList(context, {
        linkColumnId: param.linkColumnId,
      });
    } else if ('viewId' in param && param.viewId) {
      filters = await Filter.allViewFilterList(context, {
        viewId: param.viewId,
      });
    }
    return filterBuilder().build(filters);
  }
}
