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

interface CreateRecordNodeConfig extends WorkflowNodeConfig {
  modelId: string;
  fieldsJson: string;
}

function parseJson(jsonString: object | string | undefined) {
  if (!jsonString) return undefined;
  if (typeof jsonString === 'object') return jsonString;
  try {
    return JSON.parse(jsonString);
  } catch {
    return undefined;
  }
}

export class CreateRecordNode extends WorkflowNodeIntegration<CreateRecordNodeConfig> {
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
        label: 'Fields JSON',
        width: 100,
        model: 'config.fieldsJson',
        placeholder: '{ "Title": "Hello", "Status": "Active" }',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Fields JSON is required',
          },
        ],
      },
    ];

    return {
      id: 'nocodb.create_record',
      title: 'Create Record',
      description: 'Create a new record in a NocoDB table',
      icon: 'nocodb',
      category: WorkflowNodeCategory.ACTION,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      keywords: ['nocodb', 'database', 'create', 'insert', 'record'],
    };
  }

  public async validate(config: CreateRecordNodeConfig) {
    const errors: { path?: string; message: string }[] = [];

    if (!config.modelId) {
      errors.push({ path: 'config.modelId', message: 'Table is required' });
    }

    if (!config.fieldsJson) {
      errors.push({
        path: 'config.fieldsJson',
        message: 'Fields JSON is required',
      });
    } else {
      try {
        const parsed = parseJson(config.fieldsJson);
        if (!parsed || typeof parsed !== 'object') {
          errors.push({
            path: 'config.fieldsJson',
            message: 'Fields JSON must parse to an object',
          });
        }
      } catch {
        errors.push({ path: 'config.fieldsJson', message: 'Invalid JSON' });
      }
    }

    return { valid: errors.length === 0, errors };
  }

  public async run(
    ctx: WorkflowNodeRunContext<CreateRecordNodeConfig>,
  ): Promise<WorkflowNodeResult> {
    const logs: WorkflowNodeLog[] = [];
    const startTime = Date.now();

    try {
      const { modelId, fieldsJson } = ctx.inputs.config;

      logs.push({
        level: 'info',
        message: `Creating record in model ${modelId}`,
        ts: Date.now(),
      });

      const fields = parseJson(fieldsJson);

      const context = {
        workspace_id: ctx.workspaceId,
        base_id: ctx.baseId,
      } as NocoSDK.NcContext;

      const result = await this.nocodb.dataService.dataInsert(context, {
        modelId,
        body: { fields },
        cookie: {},
      });

      const executionTime = Date.now() - startTime;

      logs.push({
        level: 'info',
        message: `Record created successfully`,
        ts: Date.now(),
        data: { recordId: result.records[0]?.id },
      });

      return {
        outputs: {
          record: result.records[0],
        },
        status: 'success',
        logs,
        metrics: {
          recordsCreated: result.records.length,
          executionTimeMs: executionTime,
        },
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      logs.push({
        level: 'error',
        message: `Failed to create record: ${error.message}`,
        ts: Date.now(),
        data: error.response?.data || error.stack,
      });

      return {
        outputs: {},
        status: 'error',
        error: {
          message: error.message || 'Failed to create record',
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
