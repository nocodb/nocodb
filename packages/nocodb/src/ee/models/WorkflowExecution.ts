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

export default class WorkflowExecution {
  id?: string;
  fk_workspace_id?: string;
  base_id?: string;
  fk_workflow_id?: string;

  workflow_data?: string;
  execution_data?: string;

  finished?: boolean;
  started_at?: Date | string;
  finished_at?: Date | string;
  status?: string; // 'success', 'error', 'in_progress'

  created_at?: string;
  updated_at?: string;

  constructor(workflowExecution: WorkflowExecution) {
    Object.assign(this, workflowExecution);
  }

  public static async get(
    context: NcContext,
    executionId: string,
    ncMeta = Noco.ncMeta,
  ) {
    let execution = await NocoCache.get(
      context,
      `${CacheScope.WORKFLOW_EXECUTION}:${executionId}`,
      CacheGetType.TYPE_OBJECT,
    );

    if (!execution) {
      execution = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.WORKFLOW_EXECUTIONS,
        executionId,
      );

      if (execution) {
        execution = prepareForResponse(execution, [
          'workflow_data',
          'execution_data',
        ]);

        await NocoCache.set(
          context,
          `${CacheScope.WORKFLOW_EXECUTION}:${executionId}`,
          execution,
        );
      }
    }

    return execution && new WorkflowExecution(execution);
  }

  public static async list(
    context: NcContext,
    params: {
      workflowId?: string;
      limit?: number;
      offset?: number;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const { workflowId, limit = 25, offset = 0 } = params;

    // Build cache key based on params
    const cacheKey = workflowId ? [workflowId] : ['all'];

    const cachedList = await NocoCache.getList(
      context,
      CacheScope.WORKFLOW_EXECUTION,
      cacheKey,
    );

    let { list: executionList } = cachedList;

    if (!cachedList.isNoneList && !executionList.length) {
      const condition: any = {};

      if (workflowId) {
        condition.fk_workflow_id = workflowId;
      }

      executionList = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.WORKFLOW_EXECUTIONS,
        {
          condition,
          orderBy: {
            created_at: 'desc',
          },
          limit,
          offset,
        },
      );

      executionList = executionList.map((execution) =>
        prepareForResponse(execution, ['workflow_data', 'execution_data']),
      );

      await NocoCache.setList(
        context,
        CacheScope.WORKFLOW_EXECUTION,
        cacheKey,
        executionList,
      );
    }

    return executionList.map((execution) => new WorkflowExecution(execution));
  }

  public static async insert(
    context: NcContext,
    execution: Partial<WorkflowExecution>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(execution, [
      'fk_workflow_id',
      'base_id',
      'fk_workspace_id',
      'workflow_data',
      'execution_data',
      'finished',
      'started_at',
      'finished_at',
      'status',
    ]);

    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.WORKFLOW_EXECUTIONS,
      prepareForDb(insertObj, ['workflow_data', 'execution_data']),
    );

    return this.get(context, id, ncMeta).then(async (res) => {
      // Append to both workflow-specific and base-level caches
      if (execution.fk_workflow_id) {
        await NocoCache.appendToList(
          context,
          CacheScope.WORKFLOW_EXECUTION,
          [execution.fk_workflow_id],
          `${CacheScope.WORKFLOW_EXECUTION}:${id}`,
        );
      }
      if (execution.base_id) {
        await NocoCache.appendToList(
          context,
          CacheScope.WORKFLOW_EXECUTION,
          [execution.base_id],
          `${CacheScope.WORKFLOW_EXECUTION}:${id}`,
        );
      }
      return res;
    });
  }

  public static async update(
    context: NcContext,
    executionId: string,
    execution: Partial<WorkflowExecution>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(execution, [
      'workflow_data',
      'execution_data',
      'finished',
      'finished_at',
      'status',
    ]);

    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.WORKFLOW_EXECUTIONS,
      prepareForDb(updateObj, ['workflow_data', 'execution_data']),
      executionId,
    );

    await NocoCache.update(
      context,
      `${CacheScope.WORKFLOW_EXECUTION}:${executionId}`,
      updateObj,
    );

    return this.get(context, executionId, ncMeta);
  }

  static async delete(
    context: NcContext,
    executionId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const res = await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.WORKFLOW_EXECUTIONS,
      executionId,
    );

    await NocoCache.deepDel(
      context,
      `${CacheScope.WORKFLOW_EXECUTION}:${executionId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    return res;
  }
}
