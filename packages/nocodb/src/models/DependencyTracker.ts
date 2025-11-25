import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';

export enum DependencyTableType {
  Column = 'column',
  Model = 'table',
  View = 'view',
  Widget = 'widget',
  Workflow = 'workflow',
}

export interface DependencyTrackerType {
  id?: string;
  fk_workspace_id?: string;
  base_id?: string;
  source_type: DependencyTableType;
  source_id: string;
  dependent_type: DependencyTableType;
  dependent_id: string;
  path: string;
  meta?: any;
  created_at?: string;
  updated_at?: string;
}

export interface DependencyInfo {
  id: string;
  path: string;
  meta?: any;
}

export interface Dependencies {
  columns?: DependencyInfo[];
  models?: DependencyInfo[];
  views?: DependencyInfo[];
}

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
   * Generic method to track dependencies for any dependent type
   */
  public static async trackDependencies(
    context: NcContext,
    dependentType: DependencyTableType,
    dependentId: string,
    dependencies: Dependencies,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    await this.clearDependencies(context, dependentType, dependentId, ncMeta);

    const deps: DependencyTrackerType[] = [];

    const sourceTypes: Array<{
      key: keyof Dependencies;
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
          deps.push({
            fk_workspace_id: context.workspace_id,
            base_id: context.base_id,
            source_type: type,
            source_id: item.id,
            dependent_type: dependentType,
            dependent_id: dependentId,
            path: item.path,
            meta: item.meta,
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
   * Generic method to get all dependents of a specific source
   */
  public static async getDependentsBySource(
    context: NcContext,
    sourceType: DependencyTableType,
    sourceId: string,
    dependentType?: DependencyTableType,
    ncMeta = Noco.ncMeta,
  ): Promise<DependencyTrackerType[]> {
    const condition: any = {
      source_type: sourceType,
      source_id: sourceId,
    };

    if (dependentType) {
      condition.dependent_type = dependentType;
    }

    return await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.DEPENDENCY_TRACKER,
      { condition },
    );
  }

  /**
   * Get all dependencies (sources) of a specific dependent
   */
  public static async getDependenciesByDependent(
    context: NcContext,
    dependentType: DependencyTableType,
    dependentId: string,
    sourceType?: DependencyTableType,
    ncMeta = Noco.ncMeta,
  ): Promise<DependencyTrackerType[]> {
    const condition: any = {
      dependent_type: dependentType,
      dependent_id: dependentId,
    };

    if (sourceType) {
      condition.source_type = sourceType;
    }

    return await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.DEPENDENCY_TRACKER,
      { condition },
    );
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
}
