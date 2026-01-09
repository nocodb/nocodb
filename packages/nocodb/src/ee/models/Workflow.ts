import { AutomationTypes, DependencyTableType } from 'nocodb-sdk';
import { default as WorkflowCE } from 'src/models/Workflow';
import { Logger } from '@nestjs/common';
import type {
  WorkflowGeneralEdge,
  WorkflowGeneralNode,
  WorkflowType,
} from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import { extractProps } from '~/helpers/extractProps';
import { prepareForDb, prepareForResponse } from '~/utils/modelUtils';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { WorkflowExecution } from '~/models';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '~/utils/globals';
import DependencyTracker, {
  type HydratedDependencyTrackerType,
} from '~/models/DependencyTracker';
import { processConcurrently } from '~/utils';
import { cleanCommandPaletteCache } from '~/helpers/commandPaletteHelpers';

const logger = new Logger('Workflow');

export default class Workflow extends WorkflowCE implements WorkflowType {
  id?: string;
  title?: string;
  description?: string;
  fk_workspace_id?: string;
  base_id?: string;
  meta?: any;
  draft?: {
    nodes?: WorkflowGeneralNode[];
    edges?: WorkflowGeneralEdge[];
  };

  nodes?: WorkflowGeneralNode[];
  edges?: WorkflowGeneralEdge[];

  type?: AutomationTypes;
  enabled?: boolean;

  trigger_count?: number;

  order?: number;

  wf_is_polling?: boolean;
  wf_polling_interval?: number;
  wf_next_polling_at?: number;
  wf_is_polling_heartbeat?: boolean;

  created_at?: string;
  updated_at?: string;

  created_by?: string;
  updated_by?: string;

  constructor(workflow: Workflow) {
    super(workflow);
    Object.assign(this, workflow);
  }

  public static async get(
    context: NcContext,
    workflowId: string,
    ncMeta = Noco.ncMeta,
  ) {
    let workflow = await NocoCache.get(
      context,
      `${CacheScope.WORKFLOW}:${workflowId}`,
      CacheGetType.TYPE_OBJECT,
    );

    if (!workflow) {
      workflow = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.AUTOMATIONS,
        {
          id: workflowId,
          type: AutomationTypes.WORKFLOW,
        },
      );

      if (workflow) {
        workflow = prepareForResponse(workflow, [
          'nodes',
          'edges',
          'meta',
          'draft',
        ]);

        await NocoCache.set(
          context,
          `${CacheScope.WORKFLOW}:${workflowId}`,
          workflow,
        );
      }
    }

    return workflow && new Workflow(workflow);
  }

  public static async list(
    context: NcContext,
    baseId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const cachedList = await NocoCache.getList(context, CacheScope.WORKFLOW, [
      baseId,
    ]);

    // eslint-disable-next-line prefer-const
    let { list: workflowList, isNoneList } = cachedList;

    if (!isNoneList && !workflowList.length) {
      workflowList = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.AUTOMATIONS,
        {
          condition: {
            base_id: baseId,
            type: AutomationTypes.WORKFLOW,
          },
          orderBy: {
            created_at: 'asc',
          },
        },
      );

      workflowList = workflowList.map((workflow) =>
        prepareForResponse(workflow, ['nodes', 'edges', 'meta', 'draft']),
      );

      await NocoCache.setList(
        context,
        CacheScope.WORKFLOW,
        [baseId],
        workflowList,
      );
    }

    workflowList.sort((a, b) => a.order - b.order);

    return workflowList.map((workflow) => new Workflow(workflow));
  }

  public static async getNextPollingWorkflows(ncMeta = Noco.ncMeta) {
    const workflows = await ncMeta
      .knexConnection(MetaTable.AUTOMATIONS)
      .whereNotNull('wf_polling_interval')
      .andWhere('wf_polling_interval', '>', 0)
      .andWhere('wf_is_polling', true)
      .andWhere('enabled', true)
      .andWhere((subQb) => {
        subQb.where('wf_next_polling_at', '<=', new Date().getTime());
        subQb.orWhereNull('wf_next_polling_at');
      });

    return workflows.map((workflow) => new Workflow(workflow));
  }

  public static async insert(
    context: NcContext,
    workflow: Partial<Workflow>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(workflow, [
      'title',
      'description',
      'base_id',
      'fk_workspace_id',
      'enabled',
      'nodes',
      'edges',
      'meta',
      'draft',
      'order',
      'type',
      'created_by',
    ]);

    if (!insertObj.order) {
      insertObj.order = await ncMeta.metaGetNextOrder(MetaTable.AUTOMATIONS, {
        fk_workspace_id: context.workspace_id,
        base_id: context.base_id,
      });
    }
    insertObj.type = AutomationTypes.WORKFLOW;

    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.AUTOMATIONS,
      prepareForDb(insertObj, ['nodes', 'edges', 'meta', 'draft']),
    );
    cleanCommandPaletteCache(context.workspace_id).catch(() => {
      logger.error('Failed to clean command palette cache');
    });

    return this.get(context, id, ncMeta).then(async (res) => {
      await NocoCache.appendToList(
        context,
        CacheScope.WORKFLOW,
        [context.base_id],
        `${CacheScope.WORKFLOW}:${id}`,
      );
      return res;
    });
  }

  public static async update(
    context: NcContext,
    workflowId: string,
    workflow: Partial<Workflow>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(workflow, [
      'title',
      'description',
      'enabled',
      'nodes',
      'edges',
      'meta',
      'draft',
      'order',
      'updated_by',
    ]);

    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.AUTOMATIONS,
      prepareForDb(updateObj, ['nodes', 'edges', 'meta', 'draft']),
      workflowId,
    );

    await NocoCache.update(
      context,
      `${CacheScope.WORKFLOW}:${workflowId}`,
      prepareForResponse(updateObj, ['nodes', 'edges', 'meta', 'draft']),
    );

    cleanCommandPaletteCache(context.workspace_id).catch(() => {
      logger.error('Failed to clean command palette cache');
    });

    return this.get(context, workflowId, ncMeta);
  }

  static async delete(
    context: NcContext,
    workflowId: any,
    ncMeta = Noco.ncMeta,
  ) {
    const res = await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.AUTOMATIONS,
      workflowId,
    );

    await NocoCache.deepDel(
      context,
      `${CacheScope.WORKFLOW}:${workflowId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    cleanCommandPaletteCache(context.workspace_id).catch(() => {
      logger.error('Failed to clean command palette cache');
    });

    await WorkflowExecution.deleteByWorkflow(context, workflowId, ncMeta);

    return res;
  }

  public static async findByTrigger(
    context: NcContext,
    triggerType: string,
    modelId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<Workflow[]> {
    const dependencies = await DependencyTracker.getDependentsBySource(
      context,
      DependencyTableType.Model,
      modelId,
      {
        nodeType: triggerType,
        dependentType: DependencyTableType.Workflow,
      },
      ncMeta,
    );

    const workflows = await processConcurrently(dependencies, (dependency) =>
      this.get(context, dependency.dependent_id, ncMeta),
    );

    return workflows.filter((wf) => wf.enabled);
  }

  /**
   * Get external triggers for a workflow
   * External triggers are self-referencing dependencies with a triggerId
   */
  public static async getExternalTriggers(
    context: NcContext,
    workflowId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<HydratedDependencyTrackerType<DependencyTableType.Workflow>[]> {
    const dependencies = await DependencyTracker.getDependentsBySource(
      context,
      DependencyTableType.Workflow,
      workflowId,
      {
        dependentType: DependencyTableType.Workflow,
        dependentId: workflowId,
      },
      ncMeta,
    );

    return dependencies.filter((dep) => dep.triggerId || dep.nextSyncAt);
  }

  /**
   * Track an external trigger as a self-referencing dependency
   */
  public static async trackExternalTrigger(
    context: NcContext,
    workflowId: string,
    triggerData: {
      nodeId: string;
      nodeType: string;
      triggerId?: string | null;
      nextSyncAt?: string;
      activationState?: Record<string, any>;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    await DependencyTracker.trackDependencies(
      context,
      DependencyTableType.Workflow,
      workflowId,
      {
        workflows: [
          {
            id: workflowId, // Self-reference
            nodeId: triggerData.nodeId,
            nodeType: triggerData.nodeType,
            triggerId: triggerData.triggerId,
            nextSyncAt: triggerData.nextSyncAt,
            activationState: triggerData.activationState,
          },
        ],
      },
      ncMeta,
      true,
    );
  }
}
