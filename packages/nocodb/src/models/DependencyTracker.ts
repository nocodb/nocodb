import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';
import { NcError } from '~/helpers/catchError';

export enum DependencyTableType {
  Column = 'column',
  Model = 'table',
  View = 'view',
  Widget = 'widget',
  Workflow = 'workflow',
}

export enum DependencySlotTypes {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  ARRAY = 'array',
  OBJECT = 'object',
}

export interface DependencyTrackerType {
  id?: string;
  fk_workspace_id?: string;
  base_id?: string;
  source_type: DependencyTableType;
  source_id: string;
  dependent_type: DependencyTableType;
  dependent_id: string;
  created_at?: string;
  updated_at?: string;
}

export interface DependencyInfo {
  id: string;
  path?: string;
}

export interface WidgetDependencyInfo extends DependencyInfo {
  widgetType?: string;
  widgetSubtype?: string;
}

export interface WorkflowDependencyInfo extends DependencyInfo {
  nodeType?: string;
  nodeId?: string;
  nodeIndex?: number;
}

export interface Dependencies {
  columns?: DependencyInfo[];
  models?: DependencyInfo[];
  views?: DependencyInfo[];
}

export interface WidgetDependencies {
  columns?: WidgetDependencyInfo[];
  models?: WidgetDependencyInfo[];
  views?: WidgetDependencyInfo[];
}

export interface WorkflowDependencies {
  columns?: WorkflowDependencyInfo[];
  models?: WorkflowDependencyInfo[];
  views?: WorkflowDependencyInfo[];
}

enum DependencySlots {
  SLOT0 = 'slot_0',
  SLOT1 = 'slot_1',
  SLOT2 = 'slot_2',
  SLOT3 = 'slot_3',
  SLOT4 = 'slot_4',
}

interface SlotDefinition {
  id: string;
  type: DependencySlotTypes;
  required?: boolean;
}

const SLOT_MAPPINGS: Record<
  DependencyTableType,
  Record<string, SlotDefinition>
> = {
  [DependencyTableType.Widget]: {
    path: {
      id: DependencySlots.SLOT0,
      type: DependencySlotTypes.STRING,
      required: false,
    },
    widgetType: {
      id: DependencySlots.SLOT1,
      type: DependencySlotTypes.STRING,
      required: false,
    },
    widgetSubtype: {
      id: DependencySlots.SLOT2,
      type: DependencySlotTypes.STRING,
      required: false,
    },
  },
  [DependencyTableType.Workflow]: {
    path: {
      id: DependencySlots.SLOT0,
      type: DependencySlotTypes.STRING,
      required: false,
    },
    nodeType: {
      id: DependencySlots.SLOT1,
      type: DependencySlotTypes.STRING,
      required: false,
    },
    nodeId: {
      id: DependencySlots.SLOT2,
      type: DependencySlotTypes.STRING,
      required: false,
    },
    nodeIndex: {
      id: DependencySlots.SLOT3,
      type: DependencySlotTypes.NUMBER,
      required: false,
    },
  },
  [DependencyTableType.Column]: {
    path: {
      id: DependencySlots.SLOT0,
      type: DependencySlotTypes.STRING,
      required: false,
    },
  },
  [DependencyTableType.Model]: {
    path: {
      id: DependencySlots.SLOT0,
      type: DependencySlotTypes.STRING,
      required: false,
    },
  },
  [DependencyTableType.View]: {
    path: {
      id: DependencySlots.SLOT0,
      type: DependencySlotTypes.STRING,
      required: false,
    },
  },
};

export default class DependencyTracker implements DependencyTrackerType {
  id: string;
  fk_workspace_id: string;
  base_id: string;
  source_type: DependencyTableType;
  source_id: string;
  dependent_type: DependencyTableType;
  dependent_id: string;
  path: string;
  meta: any;
  created_at: string;
  updated_at: string;

  constructor(data: DependencyTrackerType) {
    Object.assign(this, data);
  }

  /**
   * Internal: Extract queryable fields from dependency info based on dependent type
   */
  private static extractQueryableFields(
    dependentType: DependencyTableType,
    item: DependencyInfo,
  ): Record<string, any> {
    const mapping = SLOT_MAPPINGS[dependentType];
    const fields: Record<string, any> = {};

    for (const [logicalField, slotDef] of Object.entries(mapping)) {
      let value = (item as any)[logicalField];

      // Check required fields
      if (slotDef.required && value === undefined) {
        NcError.badRequest(`Missing required field: ${logicalField}`);
      }

      // Skip undefined optional fields
      if (value === undefined) {
        continue;
      }

      // Validate and coerce types
      switch (slotDef.type) {
        case DependencySlotTypes.NUMBER:
          if (isNaN(Number(value))) {
            NcError.badRequest(`Invalid type for field: ${logicalField}`);
          }
          value = Number(value);
          break;

        case DependencySlotTypes.BOOLEAN:
          value = !!value;
          break;

        case DependencySlotTypes.ARRAY:
          if (typeof value === 'string') {
            try {
              value = JSON.parse(value);
            } catch (e) {
              NcError.badRequest(`Invalid type for field: ${logicalField}`);
            }
          }
          if (!Array.isArray(value)) {
            NcError.badRequest(`Invalid type for field: ${logicalField}`);
          }
          value = JSON.stringify(value);
          break;

        case DependencySlotTypes.OBJECT:
          if (typeof value === 'string') {
            try {
              value = JSON.parse(value);
            } catch (e) {
              NcError.badRequest(`Invalid type for field: ${logicalField}`);
            }
          }
          if (typeof value !== 'object' || value === null) {
            NcError.badRequest(`Invalid type for field: ${logicalField}`);
          }
          value = JSON.stringify(value);
          break;

        case DependencySlotTypes.STRING:
          if (typeof value !== 'string') {
            NcError.badRequest(`Invalid type for field: ${logicalField}`);
          }
          break;

        default:
          break;
      }

      fields[slotDef.id] = value;
    }

    return fields;
  }

  /**
   * Internal: Hydrate queryable fields back to logical names
   */
  private static hydrateQueryableFields(
    dependentType: DependencyTableType,
    record: any,
  ): Record<string, any> {
    const mapping = SLOT_MAPPINGS[dependentType];
    const fields: Record<string, any> = {};

    for (const [logicalField, slotDef] of Object.entries(mapping)) {
      let value = record[slotDef.id];

      if (value === undefined) {
        continue;
      }

      // Parse back types that were stringified
      switch (slotDef.type) {
        case DependencySlotTypes.ARRAY:
        case DependencySlotTypes.OBJECT:
          if (typeof value === 'string') {
            try {
              value = JSON.parse(value);
            } catch (e) {
              // Keep as string if parsing fails
            }
          }
          break;

        default:
          break;
      }

      fields[logicalField] = value;
    }

    return fields;
  }

  /**
   * Track dependencies - type-safe overloads
   */
  public static async trackDependencies(
    context: NcContext,
    dependentType: DependencyTableType.Widget,
    dependentId: string,
    dependencies: WidgetDependencies,
    ncMeta?: any,
  ): Promise<void>;
  public static async trackDependencies(
    context: NcContext,
    dependentType: DependencyTableType.Workflow,
    dependentId: string,
    dependencies: WorkflowDependencies,
    ncMeta?: any,
  ): Promise<void>;
  public static async trackDependencies(
    context: NcContext,
    dependentType: DependencyTableType,
    dependentId: string,
    dependencies: Dependencies | WidgetDependencies | WorkflowDependencies,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    await this.clearDependencies(context, dependentType, dependentId, ncMeta);

    const deps: any[] = [];

    const sourceTypes: Array<{
      key: 'columns' | 'models' | 'views';
      type: DependencyTableType;
    }> = [
      { key: 'columns', type: DependencyTableType.Column },
      { key: 'models', type: DependencyTableType.Model },
      { key: 'views', type: DependencyTableType.View },
    ];

    for (const { key, type } of sourceTypes) {
      const items = dependencies[key];
      if (items) {
        for (const item of items) {
          const queryableFields = this.extractQueryableFields(
            dependentType,
            item,
          );

          deps.push({
            fk_workspace_id: context.workspace_id,
            base_id: context.base_id,
            source_type: type,
            source_id: item.id,
            dependent_type: dependentType,
            dependent_id: dependentId,
            ...queryableFields,
          });
        }
      }
    }

    if (deps.length > 0) {
      await ncMeta.bulkMetaInsert(
        context.workspace_id,
        context.base_id,
        MetaTable.DEPENDENCY_TRACKER,
        deps,
      );
    }
  }

  /**
   * Generic method to clear all dependencies for a dependent
   */
  public static async clearDependencies(
    context: NcContext,
    dependentType: DependencyTableType,
    dependentId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.DEPENDENCY_TRACKER,
      {
        dependent_type: dependentType,
        dependent_id: dependentId,
      },
    );
  }

  /**
   * Get dependencies with filters based on dependent type - type-safe overloads
   */
  public static async getDependentsBySource(
    context: NcContext,
    sourceType: DependencyTableType,
    sourceId: string,
    options: {
      dependentType: DependencyTableType.Widget;
      widgetType?: string;
      widgetSubtype?: string;
    },
    ncMeta?: any,
  ): Promise<DependencyTrackerType[]>;
  public static async getDependentsBySource(
    context: NcContext,
    sourceType: DependencyTableType,
    sourceId: string,
    options: {
      dependentType: DependencyTableType.Workflow;
      nodeType?: string;
      nodeId?: string;
    },
    ncMeta?: any,
  ): Promise<DependencyTrackerType[]>;
  public static async getDependentsBySource(
    context: NcContext,
    sourceType: DependencyTableType,
    sourceId: string,
    options?: {
      dependentType?: DependencyTableType;
      widgetType?: string;
      widgetSubtype?: string;
      nodeType?: string;
      nodeId?: string;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<DependencyTrackerType[]> {
    const condition: any = {
      source_type: sourceType,
      source_id: sourceId,
    };

    if (options?.dependentType) {
      condition.dependent_type = options.dependentType;

      const mapping = SLOT_MAPPINGS[options.dependentType];

      if (options.dependentType === DependencyTableType.Widget) {
        if (options.widgetType && mapping.widgetType) {
          condition[mapping.widgetType.id] = options.widgetType;
        }
        if (options.widgetSubtype && mapping.widgetSubtype) {
          condition[mapping.widgetSubtype.id] = options.widgetSubtype;
        }
      } else if (options.dependentType === DependencyTableType.Workflow) {
        if (options.nodeType && mapping.nodeType) {
          condition[mapping.nodeType.id] = options.nodeType;
        }
        if (options.nodeId && mapping.nodeId) {
          condition[mapping.nodeId.id] = options.nodeId;
        }
      }
    }

    const results = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.DEPENDENCY_TRACKER,
      { condition },
    );

    // Hydrate results with logical field names
    return results.map((record) => {
      if (record.dependent_type) {
        const hydratedFields = this.hydrateQueryableFields(
          record.dependent_type,
          record,
        );
        return { ...record, ...hydratedFields };
      }
      return record;
    });
  }

  /**
   * Check if deleting a source would break any dependents
   */
  public static async checkBreakingChanges(
    context: NcContext,
    sourceType: DependencyTableType,
    sourceId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<{
    hasBreakingChanges: boolean;
    affectedWidgets: string[];
    affectedWorkflows: string[];
  }> {
    const dependents = await this.getDependentsBySource(
      context,
      sourceType,
      sourceId,
      undefined,
      ncMeta,
    );

    const widgets = new Set<string>();
    const workflows = new Set<string>();

    for (const dep of dependents) {
      if (dep.dependent_type === DependencyTableType.Widget) {
        widgets.add(dep.dependent_id);
      } else if (dep.dependent_type === DependencyTableType.Workflow) {
        workflows.add(dep.dependent_id);
      }
    }

    return {
      hasBreakingChanges: dependents.length > 0,
      affectedWidgets: Array.from(widgets),
      affectedWorkflows: Array.from(workflows),
    };
  }

  /**
   * Recursively find all transitive dependents of a source.
   */
  public static async getTransitiveDependents(
    context: NcContext,
    sourceType: DependencyTableType,
    sourceId: string,
    maxDepth: number = 10,
    ncMeta = Noco.ncMeta,
  ): Promise<
    Array<DependencyTrackerType & { depth: number; dependencyPath: string[] }>
  > {
    const visited = new Set<string>();
    const result: Array<
      DependencyTrackerType & { depth: number; dependencyPath: string[] }
    > = [];

    const createKey = (type: DependencyTableType, id: string) =>
      `${type}:${id}`;

    const traverse = async (
      currentType: DependencyTableType,
      currentId: string,
      depth: number,
      pathSoFar: string[],
    ): Promise<void> => {
      if (depth > maxDepth) {
        return;
      }

      const key = createKey(currentType, currentId);
      if (visited.has(key)) {
        return;
      }
      visited.add(key);

      const directDependents = await this.getDependentsBySource(
        context,
        currentType,
        currentId,
        undefined,
        ncMeta,
      );

      for (const dep of directDependents) {
        const depKey = createKey(dep.dependent_type, dep.dependent_id);
        const currentPath = [...pathSoFar, depKey];

        if (!visited.has(depKey)) {
          result.push({
            ...dep,
            depth,
            dependencyPath: currentPath,
          });

          if (
            dep.dependent_type === DependencyTableType.Column ||
            dep.dependent_type === DependencyTableType.Model ||
            dep.dependent_type === DependencyTableType.View
          ) {
            await traverse(
              dep.dependent_type,
              dep.dependent_id,
              depth + 1,
              currentPath,
            );
          }
        }
      }
    };

    await traverse(sourceType, sourceId, 1, [createKey(sourceType, sourceId)]);

    return result;
  }

  /**
   * Check breaking changes including transitive dependencies.
   */
  public static async checkTransitiveBreakingChanges(
    context: NcContext,
    sourceType: DependencyTableType,
    sourceId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<{
    hasBreakingChanges: boolean;
    affectedWidgets: Array<{ id: string; depth: number; path: string[] }>;
    affectedWorkflows: Array<{ id: string; depth: number; path: string[] }>;
    affectedColumns: Array<{ id: string; depth: number; path: string[] }>;
    affectedViews: Array<{ id: string; depth: number; path: string[] }>;
    totalAffected: number;
  }> {
    const transitiveDeps = await this.getTransitiveDependents(
      context,
      sourceType,
      sourceId,
      10,
      ncMeta,
    );

    const widgets = new Map<
      string,
      { id: string; depth: number; path: string[] }
    >();
    const workflows = new Map<
      string,
      { id: string; depth: number; path: string[] }
    >();
    const columns = new Map<
      string,
      { id: string; depth: number; path: string[] }
    >();
    const views = new Map<
      string,
      { id: string; depth: number; path: string[] }
    >();

    for (const dep of transitiveDeps) {
      const info = {
        id: dep.dependent_id,
        depth: dep.depth,
        path: dep.dependencyPath,
      };

      switch (dep.dependent_type) {
        case DependencyTableType.Widget:
          if (!widgets.has(dep.dependent_id)) {
            widgets.set(dep.dependent_id, info);
          }
          break;
        case DependencyTableType.Workflow:
          if (!workflows.has(dep.dependent_id)) {
            workflows.set(dep.dependent_id, info);
          }
          break;
        case DependencyTableType.Column:
          if (!columns.has(dep.dependent_id)) {
            columns.set(dep.dependent_id, info);
          }
          break;
        case DependencyTableType.View:
          if (!views.has(dep.dependent_id)) {
            views.set(dep.dependent_id, info);
          }
          break;
      }
    }

    return {
      hasBreakingChanges: transitiveDeps.length > 0,
      affectedWidgets: Array.from(widgets.values()),
      affectedWorkflows: Array.from(workflows.values()),
      affectedColumns: Array.from(columns.values()),
      affectedViews: Array.from(views.values()),
      totalAffected: transitiveDeps.length,
    };
  }
}
