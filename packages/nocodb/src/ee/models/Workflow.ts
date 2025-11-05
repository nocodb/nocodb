import { PlanLimitTypes } from 'nocodb-sdk';
import type { WorkflowType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import { extractProps } from '~/helpers/extractProps';
import { prepareForDb, prepareForResponse } from '~/utils/modelUtils';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '~/utils/globals';

export default class Workflow implements WorkflowType {
  id?: string;
  title?: string;
  fk_workspace_id?: string;
  base_id?: string;

  enabled?: boolean;

  trigger_count?: number;

  order?: number;

  created_at?: string;
  updated_at?: string;

  constructor(workflow: Workflow) {
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
        MetaTable.WORKFLOWS,
        workflowId,
      );

      if (workflow) {
        workflow = prepareForResponse(workflow, ['nodes', 'edges', 'meta']);

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

    let { list: workflowList } = cachedList;

    if (!cachedList.isNoneList && !workflowList.length) {
      workflowList = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.WORKFLOWS,
        {
          condition: {
            base_id: baseId,
          },
          orderBy: {
            created_at: 'asc',
          },
        },
      );

      workflowList = workflowList.map((workflow) =>
        prepareForResponse(workflow, ['nodes', 'edges', 'meta']),
      );

      await NocoCache.setList(
        context,
        CacheScope.WORKFLOW,
        [baseId],
        workflowList,
      );
    }

    return workflowList.map((workflow) => new Workflow(workflow));
  }

  public static async insert(
    context: NcContext,
    workflow: Partial<Workflow>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(workflow, [
      'title',
      'base_id',
      'fk_workspace_id',
      'enabled',
      'nodes',
      'edges',
      'meta',
      'order',
    ]);

    if (!insertObj.order) {
      insertObj.order = await ncMeta.metaGetNextOrder(MetaTable.WORKFLOWS, {
        fk_workspace_id: context.workspace_id,
        base_id: context.base_id,
      });
    }

    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.WORKFLOWS,
      prepareForDb(insertObj, ['nodes', 'edges', 'meta']),
    );

    await NocoCache.incrHashField(
      'root',
      `${CacheScope.RESOURCE_STATS}:workspace:${context.workspace_id}`,
      PlanLimitTypes.LIMIT_WORKFLOW_PER_WORKSPACE,
      1,
    );

    return this.get(context, id, ncMeta).then(async (res) => {
      await NocoCache.appendToList(
        context,
        CacheScope.WORKFLOW,
        [workflow.base_id],
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
      'enabled',
      'nodes',
      'edges',
      'meta',
      'order',
    ]);

    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.WORKFLOWS,
      prepareForDb(updateObj, ['nodes', 'edges', 'meta']),
      workflowId,
    );

    await NocoCache.update(
      context,
      `${CacheScope.WORKFLOW}:${workflowId}`,
      updateObj,
    );

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
      MetaTable.WORKFLOWS,
      workflowId,
    );

    await NocoCache.deepDel(
      context,
      `${CacheScope.WORKFLOW}:${workflowId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    await NocoCache.incrHashField(
      'root',
      `${CacheScope.RESOURCE_STATS}:workspace:${context.workspace_id}`,
      PlanLimitTypes.LIMIT_WORKFLOW_PER_WORKSPACE,
      -1,
    );

    return res;
  }
}
