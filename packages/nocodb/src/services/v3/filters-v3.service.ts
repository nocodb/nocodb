import { Injectable } from '@nestjs/common';
import type {
  FilterCreateV3Type,
  FilterGroupV3Type,
  FilterReqType,
  FilterType,
  FilterUpdateV3Type,
  FilterV3Type,
  UserType,
} from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type { MetaService } from '~/meta/meta.service';
import type { ViewWebhookManager } from '~/utils/view-webhook-manager';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import { Filter, Hook, View } from '~/models';
import RowColorCondition from '~/models/RowColorCondition';
import Noco from '~/Noco';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { FiltersService } from '~/services/filters.service';
import {
  filterBuilder,
  filterRevBuilder,
} from '~/utils/api-v3-data-transformation.builder';
import { ViewWebhookManagerBuilder } from '~/utils/view-webhook-manager';

function extractLogicalOp(group_operator: 'AND' | 'OR') {
  return group_operator?.toLowerCase() as 'and' | 'or';
}

export function addDummyRootAndNest(filters: any[]): any {
  // If empty, return undefined
  if (filters.length === 0) {
    return undefined;
  }

  // Create a map of filters by parent_id for easy lookup
  const filterMap = new Map<string | null, any[]>();
  filters.forEach((filter) => {
    const parentId = filter.parent_id || null;
    if (!filterMap.has(parentId)) {
      filterMap.set(parentId, []);
    }
    filterMap.get(parentId)!.push(filter);
  });

  // Helper function to determine group_operator for a group
  const getGroupOperatorFromFirstChild = (
    groupId: string | null,
  ): 'AND' | 'OR' | null => {
    const children = filterMap.get(groupId) || [];
    return children.length > 0 && children[0].logical_op
      ? // if the second child is a logical operator, return it or fallback to the first child
        // since in the current implementation, the first child logical op doesn't matter and it always and
        (children[1] || children[0]).logical_op?.toUpperCase()
      : null;
  };

  // Build a nested structure recursively
  const buildNestedStructure = (parentId: string | null): any[] => {
    const children = filterMap.get(parentId) || [];
    return children.map((child) => {
      const isGroup = !!child.is_group;
      const groupOperator = isGroup
        ? getGroupOperatorFromFirstChild(child.id)
        : undefined;
      const currentItem = {
        ...child,
        parent_id: undefined, // Root-level items have no parent_id
        group_operator: isGroup ? groupOperator : undefined, // Only groups get updated group_operator
        logical_op: undefined, // Remove logical_op from filters
        filters: isGroup ? buildNestedStructure(child.id) : undefined, // Recursively nest children for groups
        is_group: undefined,
      };

      if (!isGroup) {
        delete currentItem.logical_op; // Remove logical_op from non-groups
      }

      return currentItem;
    });
  };

  // Build the nested structure starting from the dummy root
  const nestedFilters = buildNestedStructure(null);

  // Add the dummy root group
  return {
    id: 'root',
    group_operator:
      nestedFilters.length > 0 ? getGroupOperatorFromFirstChild(null) : null,
    filters: nestedFilters,
  };
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
      filter: FilterCreateV3Type;
      user: UserType;
      req: NcRequest;
    } & { viewId: string }, // | { hookId: string } | { linkColumnId: string }),
  ) {
    // if root group creation then check existing root group

    await this.insertFilterGroup({
      context,
      param,
      groupOrFilter: param.filter,
      viewId: param.viewId,
    });

    const list = this.filterList(context, param);

    return list;
  }

  async insertFilterGroup({
    context,
    param,
    groupOrFilter,
    parentId = null,
    logicalOp = null,
    isRoot = true, // Flag to check if it's the root group
    viewId,
    viewWebhookManager,
    ncMeta = Noco.ncMeta,
  }: {
    context: any;
    param:
      | { viewId: string }
      | { hookId: string }
      | { linkColumnId: string }
      | { rowColorConditionId: string };
    groupOrFilter: FilterCreateV3Type;
    parentId?: string | null;
    logicalOp?: 'AND' | 'OR' | null;
    isRoot?: boolean;
    viewId: string;
    viewWebhookManager?: ViewWebhookManager;
    ncMeta?: MetaService;
  }): Promise<void> {
    validatePayload(
      'swagger-v3.json#/components/schemas/FilterCreate',
      groupOrFilter,
      true,
      context,
    );

    let currentParentId = parentId;
    const { additionalProps } = await this.extractAdditionalProps(
      param,
      context,
      ncMeta,
    );
    let innerViewWebhookManager: ViewWebhookManager;
    if ((param as any).viewId && !viewWebhookManager) {
      const view = await View.get(context, (param as any).viewId, ncMeta);
      innerViewWebhookManager = (param as any).viewId
        ? (
            await (
              await new ViewWebhookManagerBuilder(context, ncMeta).withModelId(
                view.fk_model_id,
              )
            ).withViewId(view.id)
          ).forUpdate()
        : null;
    } else if ((param as any).rowColorConditionId && !viewWebhookManager) {
      const rowColorCondition = await RowColorCondition.getById(
        context,
        (param as any).rowColorConditionId,
        ncMeta,
      );
      const view = await View.get(
        context,
        rowColorCondition.fk_view_id,
        ncMeta,
      );
      innerViewWebhookManager = (
        await (
          await new ViewWebhookManagerBuilder(context, ncMeta).withModelId(
            view.fk_model_id,
          )
        ).withViewId(rowColorCondition.fk_view_id)
      ).forUpdate();
    }

    // if logicalOp is not provided, extract based on the parent group
    if (!logicalOp) {
      logicalOp =
        (
          await this.extractGroup(
            context,
            {
              viewId: viewId,
              parentFilterId:
                parentId || (groupOrFilter as any)?.parent_id || 'root',
            },
            ncMeta,
          )
        )?.group_operator || 'AND';
    }

    // if not filter group simply insert filter
    if ('field_id' in groupOrFilter && (groupOrFilter as any).field_id) {
      await Filter.insert(
        context,
        {
          ...filterRevBuilder().build(groupOrFilter),
          fk_parent_id: parentId === 'root' ? null : parentId,
          ...additionalProps,
          logical_op: extractLogicalOp(logicalOp),
          id: undefined,
        },
        ncMeta,
      );
      return;
    }

    if (isRoot) {
      // Check if parentId exists within groupOrFilter
      const hasParentInGroup =
        'parent_id' in groupOrFilter && groupOrFilter.parent_id;
      if (!hasParentInGroup) {
        // Root group handling when parent_id is not provided in groupOrFilter
        const existingRootFilters = await Filter.rootFilterList(
          context,
          {
            viewId,
          },
          ncMeta,
        );
        const existingRootFilter =
          existingRootFilters[1] || existingRootFilters[0];
        if (existingRootFilter) {
          if (
            'group_operator' in groupOrFilter &&
            existingRootFilter.logical_op !==
              extractLogicalOp(groupOrFilter.group_operator)
          ) {
            throw new Error(
              `A root group with a different group operator already exists. Existing: ${existingRootFilter.logical_op?.toUpperCase()}, New: ${
                groupOrFilter.group_operator
              }`,
            );
          } else if (!('group_operator' in groupOrFilter)) {
            throw new Error(
              `A root group already exists. Cannot add a standalone filter to the root.`,
            );
          }
        }
        currentParentId = null;
      } else {
        // Insert root group
        const rootGroupResponse = await Filter.insert(
          context,
          {
            is_group: true,
            fk_parent_id: null, // Root groups have no parent
            logical_op: extractLogicalOp(logicalOp),
            ...additionalProps,
            id: undefined,
          },
          ncMeta,
        );
        currentParentId = rootGroupResponse.id;
      }
    } else if (parentId === 'root') {
      currentParentId = null;
    } else {
      // Insert root group
      const rootGroupResponse = await Filter.insert(
        context,
        {
          is_group: true,
          fk_parent_id: parentId, // Root groups have no parent
          logical_op: extractLogicalOp(logicalOp),
          ...additionalProps,
          id: undefined,
        },
        ncMeta,
      );
      currentParentId = rootGroupResponse.id;
    }

    if ('group_operator' in groupOrFilter) {
      // Handle nested groups and filters recursively
      for (const child of groupOrFilter.filters || []) {
        if ('field_id' in child) {
          // Insert individual filter
          await Filter.insert(
            context,
            {
              ...filterRevBuilder().build(child),
              fk_parent_id: currentParentId, // Link to the parent group
              logical_op:
                extractLogicalOp(groupOrFilter.group_operator) || 'and', // Pass the logical operator
              ...additionalProps,
              id: undefined,
            },
            ncMeta,
          );
        } else if ('group_operator' in child) {
          // Recursively handle nested groups
          await this.insertFilterGroup({
            context,
            param,
            groupOrFilter: child,
            parentId: currentParentId, // Pass the current group's ID as parent
            logicalOp: groupOrFilter.group_operator, // Pass the current group's logical operator
            isRoot: false, // Indicate it's not the root
            viewId,
            viewWebhookManager,
            ncMeta,
          });
        }
      }
    } else if ('field_id' in groupOrFilter) {
      // Handle a single filter directly
      await Filter.insert(
        context,
        {
          ...groupOrFilter,
          fk_parent_id: currentParentId, // Link to the parent group or root
          logical_op: extractLogicalOp(logicalOp), // Pass the logical operator
          ...additionalProps,
          id: undefined,
        },
        ncMeta,
      );
    } else {
      throw new Error('Invalid structure: Expected a group or filter.');
    }

    if (innerViewWebhookManager) {
      (
        await innerViewWebhookManager.withNewViewId(
          innerViewWebhookManager.getViewId(),
        )
      ).emit();
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
        }
      | { rowColorConditionId: string },
    context: NcContext,
    ncMeta?: MetaService,
  ) {
    let additionalProps = {};
    let additionalAuditProps = {};

    if ('hookId' in param && param.hookId) {
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
    } else if ('rowColorConditionId' in param && param.rowColorConditionId) {
      const rowColorCondition = await RowColorCondition.getById(
        context,
        param.rowColorConditionId,
        ncMeta,
      );
      if (!rowColorCondition) {
        NcError.get(context).invalidRequestBody(
          `Row color condition with id ${param.rowColorConditionId} not found`,
        );
      }
      additionalProps = {
        fk_row_color_condition_id: param.rowColorConditionId,
      };
      additionalAuditProps = {
        rowColorCondition,
      };
    } else if ('viewId' in param && param.viewId) {
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
    param: { filterId: string; req: NcRequest; viewId: string },
  ) {
    // if filter id is `root` then delete whole filters of the view
    if (param.filterId === 'root') {
      await Filter.deleteAll(context, param.viewId);
      return {};
    }

    // confirm if filter belongs to view
    const filter = await Filter.get(context, param.filterId ?? '');

    if (!filter || filter.fk_view_id !== param.viewId) {
      NcError.badRequest('Filter not found');
    }

    await this.filtersService.filterDelete(context, param);

    return {};
  }

  async filterUpdate(
    context: NcContext,
    param: {
      filter: FilterUpdateV3Type;
      filterId: string;
      viewId: string;
      user: UserType;
      req: NcRequest;
    },
  ) {
    validatePayload(
      'swagger-v3.json#/components/schemas/FilterUpdate',
      param.filter,
      true,
    );

    const filter = await Filter.get(context, param.filterId ?? '');

    if (!filter) {
      NcError.badRequest('Filter not found');
    }

    // if group operator is changed, update all children logical_op
    if (filter.is_group) {
      if ((param.filter as FilterGroupV3Type).group_operator) {
        await Filter.updateAllChildrenLogicalOp(context, {
          viewId: param.viewId,
          parentFilterId: param.filterId,
          logicalOp: extractLogicalOp(
            (param.filter as FilterGroupV3Type).group_operator,
          ),
        });
      }
    } else {
      const remappedFilter = filterRevBuilder().build(
        param.filter as FilterGroupV3Type | FilterV3Type,
      ) as FilterType;
      delete remappedFilter.logical_op;
      await this.filtersService.filterUpdate(context, {
        filterId: param.filterId,
        filter: remappedFilter as FilterReqType,
        user: param.user,
        req: param.req,
      });
    }

    // if (filter.is_group) {
    //   return await this.extractGroup(context, {
    //     viewId: param.viewId,
    //     parentFilterId: param.filterId,
    //   });
    // }

    return this.filterList(context, {
      viewId: param.viewId,
    });
  }

  private async extractGroup(
    context: NcContext,
    param: {
      viewId: string;
      parentFilterId: string;
    },
    ncMeta = Noco.ncMeta,
  ) {
    // get nested list
    const list = await this.filterList(
      context,
      {
        viewId: param.viewId,
      },
      ncMeta,
    );

    if (param.parentFilterId === 'root') {
      return list;
    }

    // iterate recursively and extract filter and return
    const extractFilter = (list: any[]) => {
      for (const item of list) {
        if (item.id === param.parentFilterId) {
          return item;
        }
        if (item.filters) {
          const filter = extractFilter(item.filters);
          if (filter) {
            return filter;
          }
        }
      }
    };
    return extractFilter(list?.filters);
  }

  async filterList(
    context: NcContext,
    param: { viewId: string } | { hookId: string } | { linkColumnId: string },
    ncMeta = Noco.ncMeta,
  ) {
    let filters = [];

    if ('hookId' in param && param.hookId) {
      filters = await Filter.allHookFilterList(
        context,
        {
          hookId: param.hookId,
        },
        ncMeta,
      );
    } else if ('linkColumnId' in param && param.linkColumnId) {
      filters = await Filter.allLinkFilterList(
        context,
        {
          linkColumnId: param.linkColumnId,
        },
        ncMeta,
      );
    } else if ('viewId' in param && param.viewId) {
      filters = await Filter.allViewFilterList(
        context,
        {
          viewId: param.viewId,
        },
        ncMeta,
      );
    }

    return addDummyRootAndNest(filterBuilder().build(filters) as Filter[]);
  }

  async filterReplace(
    context: NcContext,
    param: {
      filter: FilterCreateV3Type;
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

  // skip viewWebhookManager for this, deleteAll is not a standalone operation, it's invoked by view service
  async filterDeleteAll(
    context: NcContext,
    param: {
      viewId: string;
    },
    ncMeta?: MetaService,
  ) {
    return Filter.deleteAll(context, param.viewId, ncMeta);
  }
}
