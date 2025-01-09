import { Injectable } from '@nestjs/common';
import { AppEvents } from 'nocodb-sdk';
import type { FilterReqType, UserType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type { FilterGroup } from '~/controllers/v3/filters-v3.controller';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import { Filter, Hook, View } from '~/models';
import {
  filterBuilder,
  filterRevBuilder,
} from '~/utils/api-v3-data-transformation.builder';
import { FiltersService } from '~/services/filters.service';

function extractLogicalOp(group_operator: 'AND' | 'OR') {
  return {
    AND: 'and',
    OR: 'or',
  }[group_operator] as 'and' | 'or';
}

@Injectable()
export class FiltersV3Service {
  constructor(
    protected readonly appHooksService: AppHooksService,
    protected readonly filtersService: FiltersService,
  ) {}

  async filterCreate(
    context: NcContext,
    param: {
      filter: FilterGroup;
      user: UserType;
      req: NcRequest;
    } & ({ viewId: string } | { hookId: string } | { linkColumnId: string }),
  ) {
    validatePayload(
      'swagger-v3.json#/components/schemas/FilterV3Req',
      param.filter,
    );

    // const filter = await Filter.insert(context, {
    //   ...param.filter,
    //   ...additionalProps,
    // });

    await this.insertFilterGroup(context, param, param.filter);

    const list = this.filterList(context, param);

    /*    for(const filter of list) {
      this.appHooksService.emit(AppEvents.FILTER_CREATE, {
        filter,
        req: param.req,
        ...additionalAuditProps,
      });
    }*/

    return list;
  }

  async insertFilterGroup(
    context: any,
    param: { viewId: string } | { hookId: string } | { linkColumnId: string },
    group: FilterGroup,
    parentId: string | null = null,
    logicalOp: 'AND' | 'OR' | null = null,
    isRoot: boolean = true, // Flag to check if it's the root group
  ): Promise<void> {
    let currentParentId = parentId;

    const { additionalProps } = await this.extractAdditionalProps(
      param,
      context,
    );

    if (!isRoot) {
      // Insert the current group (not the root group)
      const groupResponse = await Filter.insert(context, {
        is_group: true, // Mark as a group
        fk_parent_id: parentId, // Link to the parent group
        logical_op: extractLogicalOp(logicalOp), // Logical operator passed down
        ...additionalProps,
      });

      // Update the parent ID for children to this group's ID
      currentParentId = groupResponse.id;
    }

    for (const filterOrGroup of group.filters) {
      if ('field_id' in filterOrGroup) {
        // Insert individual filter
        await Filter.insert(context, {
          ...filterOrGroup,
          fk_parent_id: currentParentId, // Link to the parent group or new group
          logical_op: extractLogicalOp(group.group_operator), // Pass the current group's operator to the filter
          ...additionalProps,
        });
      } else if ('group_operator' in filterOrGroup) {
        // Recursively handle nested groups
        await this.insertFilterGroup(
          context,
          param,
          filterOrGroup,
          currentParentId, // Pass the current group's ID as parent
          group.group_operator, // Pass the current group's logical operator
          false, // Indicate it's not the root
        );
      }
    }
  }

  private async extractAdditionalProps(
    param:
      | {
          viewId: string;
        }
      | { hookId: string }
      | {
          linkColumnId: string;
        },
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

  async filterUpdate(
    context: NcContext,
    param: {
      filter: FilterReqType;
      filterId: string;
      user: UserType;
      req: NcRequest;
    },
  ) {
    validatePayload(
      'swagger-v3.json#/components/schemas/FilterReq',
      param.filter,
    );

    const filter = await Filter.get(context, param.filterId);

    if (!filter) {
      NcError.badRequest('Filter not found');
    }

    const remappedFilter = filterRevBuilder().build(param.filter);

    await this.filtersService.filterUpdate(context, {
      filterId: param.filterId,
      filter: remappedFilter as FilterReqType,
      user: param.user,
      req: param.req,
    });

    return filterBuilder().build(await Filter.get(context, param.filterId));
  }

  async filterList(
    context: NcContext,
    param: { viewId: string } | { hookId: string } | { linkColumnId: string },
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

  async filterReplace(
    context: NcContext,
    param: {
      filter: FilterGroup;
      user: UserType & {
        base_roles?: Record<string, boolean>;
        workspace_roles?: Record<string, boolean>;
        provider?: string;
      };
      req: NcRequest;
    } & { viewId: string }, // | { hookId: string } | { linkColumnId: string }),
  ) {
    // delete existing filters
    await Filter.deleteAll(context, param.viewId);

    // then create filters using filterCreate
    return this.filterCreate(context, {
      filter: param.filter,
      user: param.user,
      req: param.req,
      ...param,
    });
  }
}
