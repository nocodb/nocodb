import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';
import {
  dependencySlotMapper,
  DependencyTableType,
} from '~/helpers/DependencySlotMapper';

export { DependencyTableType } from '~/helpers/DependencySlotMapper';

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

export interface WorkflowDependencyInfo extends DependencyInfo {
  nodeType?: string;
  nodeId?: string;
}

export interface Dependencies {
  columns?: DependencyInfo[];
  models?: DependencyInfo[];
  views?: DependencyInfo[];
}

export type WidgetDependencies = Dependencies;

export interface WorkflowDependencies {
  columns?: WorkflowDependencyInfo[];
  models?: WorkflowDependencyInfo[];
  views?: WorkflowDependencyInfo[];
}

export default class DependencyTracker implements DependencyTrackerType {
  id: string;
  fk_workspace_id: string;
  base_id: string;
  source_type: DependencyTableType;
  source_id: string;
  dependent_type: DependencyTableType;
  dependent_id: string;
  created_at: string;
  updated_at: string;

  constructor(data: DependencyTrackerType) {
    Object.assign(this, data);
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
      {
        key: 'models',
        type: DependencyTableType.Model,
      },
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
      dependentType: DependencyTableType.Workflow;
      nodeType?: string;
    },
    ncMeta?: any,
  ): Promise<DependencyTrackerType[]>;

  public static async getDependentsBySource(
    context: NcContext,
    sourceType: DependencyTableType,
    sourceId: string,
    options?: {
      dependentType?: DependencyTableType;
      nodeType?: string;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<DependencyTrackerType[]> {
    const condition: any = {
      source_type: sourceType,
      source_id: sourceId,
    };

    if (options?.dependentType) {
      condition.dependent_type = options.dependentType;

      if (options.dependentType === DependencyTableType.Workflow) {
        if (options.nodeType) {
          const slotId = dependencySlotMapper.getSlotId(
            options.dependentType,
            'nodeType',
          );
          if (slotId) condition[slotId] = options.nodeType;
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

        // Remove internal storage fields
        const { queryable_field_0, queryable_field_1, meta, ...cleanRecord } =
          record;

        return { ...cleanRecord, ...hydratedFields };
      }
      return record;
    });
  }

  /**
   * Check if deleting a source would break any dependents
   */
  public static async checkBreakingChanges(
    context: NcContext,
    {
      sourceType,
      sourceId,
    }: {
      sourceType: DependencyTableType;
      sourceId: string;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<{
    hasBreakingChanges: boolean;
    affectedWidgets: string[];
    affectedWorkflows: string[];
    dependents: DependencyTrackerType[];
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
      dependents,
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
    Array<
      DependencyTrackerType & {
        depth: number;
        dependencyPath: string[];
      }
    >
  > {
    const visited = new Set<string>();
    const result: Array<
      DependencyTrackerType & { depth: number; dependencyPath: string[] }
    > = [];

    // FIXME:recursive CTE for optimization
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

  /**
   * Internal: Extract queryable fields from dependency info based on dependent type
   */
  private static extractQueryableFields(
    dependentType: DependencyTableType,
    item: DependencyInfo,
  ): Record<string, any> {
    return dependencySlotMapper.extractSlotFields(dependentType, item);
  }

  /**
   * Internal: Hydrate queryable fields back to logical names
   */
  private static hydrateQueryableFields(
    dependentType: DependencyTableType,
    record: any,
  ): Record<string, any> {
    return dependencySlotMapper.hydrateSlotFields(dependentType, record);
  }
}
