import {
  FormBuilderInputType,
  FormBuilderValidatorType,
  type FormDefinition,
  NocoSDK,
  WorkflowNodeCategory,
  type WorkflowNodeConfig,
  type WorkflowNodeDefinition,
  WorkflowNodeIntegration,
  type WorkflowNodeLog,
  type WorkflowNodeResult,
  type WorkflowNodeRunContext,
} from '@noco-integrations/core';

interface DeleteRecordNodeConfig extends WorkflowNodeConfig {
  modelId: string;
  rowId: string;
}

export class DeleteRecordNode extends WorkflowNodeIntegration<DeleteRecordNodeConfig> {
  public async definition(): Promise<WorkflowNodeDefinition> {
    // Fetch tables from services if available
    let tableOptions: { label: string; value: string }[] = [];
    if (this.nocodb.tablesService && this.nocodb.context) {
      try {
        const models = await this.nocodb.tablesService.getAccessibleTables(
          this.nocodb.context,
          {
            baseId: this.nocodb.context.base_id,
            roles: { [NocoSDK.ProjectRoles.EDITOR]: true },
          },
        );
        tableOptions = models.map((model: any) => ({
          label: model.title || model.table_name,
          value: model.id,
        }));
      } catch (error: any) {
        console.error('Failed to fetch tables:', error);
      }
    }

    const form: FormDefinition = [
      {
        type: FormBuilderInputType.Select,
        label: 'Table',
        width: 100,
        model: 'config.modelId',
        placeholder: 'Select a table',
        options: tableOptions,
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Table is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.Input,
        label: 'Record ID',
        width: 100,
        model: 'config.rowId',
        placeholder: 'Enter the record ID',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Record ID is required',
          },
        ],
      },
    ];

    return {
      id: 'nocodb.delete_record',
      title: 'Delete Record',
      description: 'Delete a record from a NocoDB table',
      icon: 'ncRecordDelete',
      category: WorkflowNodeCategory.ACTION,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      keywords: ['nocodb', 'database', 'delete', 'remove', 'record'],
    };
  }

  public async validate(config: DeleteRecordNodeConfig) {
    const errors: { path?: string; message: string }[] = [];

    if (!config.modelId) {
      errors.push({ path: 'config.modelId', message: 'Table is required' });
    }

    if (!config.rowId) {
      errors.push({
        path: 'config.rowId',
        message: 'Record ID is required',
      });
    }

    return { valid: errors.length === 0, errors };
  }

  public async run(
    ctx: WorkflowNodeRunContext<DeleteRecordNodeConfig>,
  ): Promise<WorkflowNodeResult> {
    const logs: WorkflowNodeLog[] = [];
    const startTime = Date.now();

    try {
      const { modelId, rowId } = ctx.inputs.config;

      logs.push({
        level: 'info',
        message: `Deleting record ${rowId} from model ${modelId}`,
        ts: Date.now(),
      });

      const context = {
        workspace_id: ctx.workspaceId,
        base_id: ctx.baseId,
      } as NocoSDK.NcContext;

      const result = await this.nocodb.dataService.dataDelete(context, {
        modelId,
        body: { id: rowId },
        cookie: {},
      });

      const executionTime = Date.now() - startTime;

      logs.push({
        level: 'info',
        message: `Record deleted successfully`,
        ts: Date.now(),
        data: { recordId: rowId },
      });

      return {
        outputs: {
          deleted: result.records[0],
        },
        status: 'success',
        logs,
        metrics: {
          recordsDeleted: result.records.length,
          executionTimeMs: executionTime,
        },
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      logs.push({
        level: 'error',
        message: `Failed to delete record: ${error.message}`,
        ts: Date.now(),
        data: error.response?.data || error.stack,
      });

      return {
        outputs: {},
        status: 'error',
        error: {
          message: error.message || 'Failed to delete record',
          code: error.code || error.response?.status?.toString(),
          data: error.response?.data,
        },
        logs,
        metrics: {
          executionTimeMs: executionTime,
        },
      };
    }
  }
}
