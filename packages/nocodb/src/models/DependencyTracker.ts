import { DependencyTableType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';
import { dependencySlotMapper } from '~/helpers/DependencySlotMapper';

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

/**
 * Hydrated fields for each DependencyTableType
 * These match the mappings defined in DependencySlotMapper
 */
export interface WorkflowDependencyFields {
  nodeType?: string;
  triggerId?: string;
  nextSyncAt?: Date | string;
  path?: string;
  nodeId?: string;
  activationState?: Record<string, any>;
}

export interface WidgetDependencyFields {
  path?: string;
}

export interface GeneralDependencyFields {}

/**
 * Map DependencyTableType to its hydrated fields
 */
export type DependencyFieldsMap = {
  [DependencyTableType.Workflow]: WorkflowDependencyFields;
  [DependencyTableType.Widget]: WidgetDependencyFields;
  [DependencyTableType.Column]: GeneralDependencyFields;
  [DependencyTableType.Model]: GeneralDependencyFields;
  [DependencyTableType.View]: GeneralDependencyFields;
};

/**
 * Generic hydrated dependency type with type parameter
 * T specifies which DependencyTableType to use for hydrated fields
 */
export type HydratedDependencyTrackerType<
  T extends DependencyTableType = DependencyTableType,
> = DependencyTrackerType & DependencyFieldsMap[T];

export interface DependencyInfo {
  id: string;
  path?: string;
}

export interface WorkflowDependencyInfo extends DependencyInfo {
  nodeType?: string;
  nodeId?: string;
  triggerId?: string;
  nextSyncAt?: Date | string;
  activationState?: Record<string, any>;
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
  workflows?: WorkflowDependencyInfo[];
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
    ignoreClear?: boolean,
  ): Promise<void>;

  public static async trackDependencies(
    context: NcContext,
    dependentType: DependencyTableType.Workflow,
    dependentId: string,
    dependencies: WorkflowDependencies,
    ncMeta?: any,
    ignoreClear?: boolean,
  ): Promise<void>;

  public static async trackDependencies(
    context: NcContext,
    dependentType: DependencyTableType,
    dependentId: string,
    dependencies: Dependencies | WidgetDependencies | WorkflowDependencies,
    ncMeta = Noco.ncMeta,
    ignoreClear?: boolean,
  ): Promise<void> {
    if (!ignoreClear) {
      await this.clearDependencies(context, dependentType, dependentId, ncMeta);
    }

    const deps: any[] = [];

    const sourceTypes: Array<{
      key: 'columns' | 'models' | 'views' | 'workflows';
      type: DependencyTableType;
    }> = [
      { key: 'columns', type: DependencyTableType.Column },
      {
        key: 'models',
        type: DependencyTableType.Model,
      },
      { key: 'views', type: DependencyTableType.View },
      { key: 'workflows', type: DependencyTableType.Workflow },
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
  public static async getDependentsBySource<T extends DependencyTableType>(
    context: NcContext,
    sourceType: T,
    sourceId: string,
    options: {
      dependentType: DependencyTableType.Workflow;
      dependentId?: string;
      nodeType?: string;
    },
    ncMeta?: any,
  ): Promise<HydratedDependencyTrackerType<T>[]>;

  public static async getDependentsBySource<T extends DependencyTableType>(
    context: NcContext,
    sourceType: T,
    sourceId: string,
    options?: {
      dependentType?: DependencyTableType;
      dependentId?: string;
      nodeType?: string;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<HydratedDependencyTrackerType<T>[]> {
    const condition: any = {
      source_type: sourceType,
      source_id: sourceId,
    };

    if (options?.dependentType) {
      condition.dependent_type = options.dependentType;

      if (options.dependentType === DependencyTableType.Workflow) {
        if (options.dependentId) {
          condition.dependent_id = options.dependentId;
        }

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
    affected: Array<{ type: DependencyTableType; id: string }>;
    dependents: HydratedDependencyTrackerType[];
  }> {
    const dependents = await this.getDependentsBySource(
      context,
      sourceType,
      sourceId,
      undefined,
      ncMeta,
    );

    const affectedMap = new Map<string, DependencyTableType>();

    for (const dep of dependents) {
      affectedMap.set(dep.dependent_id, dep.dependent_type);
    }

    return {
      hasBreakingChanges: dependents.length > 0,
      affected: Array.from(affectedMap.entries()).map(([id, type]) => ({
        type,
        id,
      })),
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
      HydratedDependencyTrackerType & {
        depth: number;
        dependencyPath: string[];
      }
    >
  > {
    const visited = new Set<string>();
    const result: Array<
      HydratedDependencyTrackerType & {
        depth: number;
        dependencyPath: string[];
      }
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
    affected: Array<{
      type: DependencyTableType;
      id: string;
      depth: number;
      path: string[];
    }>;
    totalAffected: number;
  }> {
    const transitiveDeps = await this.getTransitiveDependents(
      context,
      sourceType,
      sourceId,
      10,
      ncMeta,
    );

    const affectedMap = new Map<
      string,
      { type: DependencyTableType; id: string; depth: number; path: string[] }
    >();

    for (const dep of transitiveDeps) {
      if (!affectedMap.has(dep.dependent_id)) {
        affectedMap.set(dep.dependent_id, {
          type: dep.dependent_type,
          id: dep.dependent_id,
          depth: dep.depth,
          path: dep.dependencyPath,
        });
      }
    }

    return {
      hasBreakingChanges: transitiveDeps.length > 0,
      affected: Array.from(affectedMap.values()),
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
