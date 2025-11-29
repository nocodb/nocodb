import type { NcContext } from '~/interface/config';
import { extractProps } from '~/helpers/extractProps';
import { prepareForDb, prepareForResponse } from '~/utils/modelUtils';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';

export default class WorkflowExecution {
  id?: string;
  fk_workspace_id?: string;
  base_id?: string;
  fk_workflow_id?: string;

  workflow_data?: Record<string, any>;
  execution_data?: Record<string, any>;

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
    const execution = await ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
      MetaTable.WORKFLOW_EXECUTIONS,
      executionId,
    );

    if (execution) {
      return new WorkflowExecution(
        prepareForResponse(execution, ['workflow_data', 'execution_data']),
      );
    }

    return null;
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

    const condition: any = {};

    if (workflowId) {
      condition.fk_workflow_id = workflowId;
    }

    const executionList = await ncMeta.metaList2(
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

    return executionList.map(
      (execution) =>
        new WorkflowExecution(
          prepareForResponse(execution, ['workflow_data', 'execution_data']),
        ),
    );
  }

  public static async insert(
    context: NcContext,
    workflowId: string,
    execution: Partial<WorkflowExecution>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(execution, [
      'base_id',
      'fk_workspace_id',
      'workflow_data',
      'execution_data',
      'finished',
      'started_at',
      'finished_at',
      'status',
    ]);

    insertObj.fk_workflow_id = workflowId;

    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.WORKFLOW_EXECUTIONS,
      prepareForDb(insertObj, ['workflow_data', 'execution_data']),
    );

    return this.get(context, id, ncMeta);
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

    return this.get(context, executionId, ncMeta);
  }

  static async deleteByWorkflow(
    context: NcContext,
    workflowId: string,
    ncMeta = Noco.ncMeta,
  ) {
    return await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.WORKFLOW_EXECUTIONS,
      {
        fk_workflow_id: workflowId,
      },
    );
  }
}
