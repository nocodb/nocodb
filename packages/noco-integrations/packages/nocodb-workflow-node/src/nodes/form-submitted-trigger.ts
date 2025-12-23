import {
  FormBuilderInputType,
  FormBuilderValidatorType,
  NocoSDK,
  WorkflowNodeCategory,
  WorkflowNodeIntegration,
} from '@noco-integrations/core';
import type {
  FormDefinition,
  WorkflowNodeConfig,
  WorkflowNodeDefinition,
  WorkflowNodeLog,
  WorkflowNodeResult,
  WorkflowNodeRunContext,
} from '@noco-integrations/core';

interface FormSubmittedTriggerConfig extends WorkflowNodeConfig {
  modelId: string;
  formViewId: string;
}

export class FormSubmittedTriggerNode extends WorkflowNodeIntegration<FormSubmittedTriggerConfig> {
  public async definition(): Promise<WorkflowNodeDefinition> {
    const form: FormDefinition = [
      {
        type: FormBuilderInputType.SelectTable,
        label: 'Table',
        span: 24,
        model: 'config.modelId',
        placeholder: 'Select a table',
        fetchOptionsKey: 'tables',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Table is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.SelectView,
        label: 'Form',
        span: 24,
        model: 'config.formViewId',
        placeholder: 'Select a form view',
        fetchOptionsKey: 'forms',
        dependsOn: 'config.modelId',
        condition: {
          model: 'config.modelId',
          notEmpty: true,
        },
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Form is required',
          },
        ],
      },
    ];

    return {
      id: 'nocodb.trigger.form_submitted',
      title: 'When form submitted',
      description: 'Triggers when a form is submitted',
      icon: 'ncFormResponse',
      category: WorkflowNodeCategory.TRIGGER,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      keywords: ['trigger', 'form', 'submit', 'submission', 'entry'],
    };
  }

  public async fetchOptions(key: 'tables' | 'forms') {
    switch (key) {
      case 'tables': {
        const tables = await this.nocodb.tablesService.getAccessibleTables(
          this.nocodb.context,
          {
            baseId: this.nocodb.context.base_id,
            roles: { [NocoSDK.ProjectRoles.EDITOR]: true },
            user: this.nocodb.user,
          },
        );

        return tables.map((table: any) => ({
          label: table.title || table.table_name,
          value: table.id,
          ncItemDisabled: table.synced,
          table,
        }));
      }
      case 'forms': {
        if (!this.config.modelId) {
          return [];
        }

        try {
          const table =
            await this.nocodb.tablesService.getTableWithAccessibleViews(
              this.nocodb.context,
              {
                tableId: this.config.modelId,
                user: this.nocodb.user as any,
              },
            );

          if (!table || !table.views) {
            return [];
          }

          const formViews = table.views.filter(
            (view: any) => view.type === NocoSDK.ViewTypes.FORM,
          );

          if (formViews.length === 0) {
            return [];
          }

          return formViews.map((view: any) => ({
            label: view.title,
            value: view.id,
            view,
          }));
        } catch (error) {
          console.error('Failed to fetch form views:', error);
          return [];
        }
      }
      default:
        return [];
    }
  }

  public async validate(config: FormSubmittedTriggerConfig) {
    const errors: { path?: string; message: string }[] = [];

    if (!config.modelId) {
      errors.push({ path: 'config.modelId', message: 'Table is required' });
    }

    if (!config.formViewId) {
      errors.push({
        path: 'config.formViewId',
        message: 'Form is required',
      });
    }

    if (config.modelId && config.formViewId) {
      try {
        const table =
          await this.nocodb.tablesService.getTableWithAccessibleViews(
            this.nocodb.context,
            {
              tableId: config.modelId,
              user: {
                ...this.nocodb.user,
                roles: { [NocoSDK.ProjectRoles.EDITOR]: true },
              } as any,
            },
          );

        if (!table) {
          errors.push({
            path: 'config.modelId',
            message: 'Table is not accessible',
          });
        } else {
          const formView = table.views?.find(
            (v: any) =>
              v.id === config.formViewId && v.type === NocoSDK.ViewTypes.FORM,
          );

          if (!formView) {
            errors.push({
              path: 'config.formViewId',
              message: 'Form view not found or not accessible',
            });
          }
        }
      } catch {
        errors.push({
          path: 'config.modelId',
          message: 'Failed to validate table and form',
        });
      }
    }

    return { valid: errors.length === 0, errors };
  }

  private async fetchSampleRecord() {
    if (!this.config.modelId) {
      return {};
    }
    try {
      const result = await this.nocodb.dataService.dataList(
        this.nocodb.context,
        {
          modelId: this.config.modelId,
          query: {
            limit: 1,
            offset: 0,
          },
          req: {
            user: this.nocodb.user,
          } as any,
        },
        false,
      );

      if (result.length) {
        return result[0];
      }
      return {};
    } catch (error) {
      console.error('Failed to fetch sample record:', error);
      return {};
    }
  }

  public async run(ctx: WorkflowNodeRunContext): Promise<WorkflowNodeResult> {
    const logs: WorkflowNodeLog[] = [];
    const startTime = Date.now();

    try {
      let { newData, user, timestamp, formViewId } = ctx.inputs as any;
      let tableName = '';
      let formName = '';

      try {
        const table =
          await this.nocodb.tablesService.getTableWithAccessibleViews(
            this.nocodb.context,
            {
              tableId: this.config.modelId,
              user: this.nocodb.user as any,
            },
          );
        tableName = table?.title || '';

        // Get form view name
        if (table?.views) {
          const formView = table.views.find(
            (v: any) => v.id === this.config.formViewId,
          );
          formName = formView?.title || '';
        }
      } catch {
        tableName = '';
        formName = '';
      }

      if (ctx.testMode) {
        newData = await this.fetchSampleRecord();
        user = this.nocodb.user;
        timestamp = new Date().toISOString();
        formViewId = this.config.formViewId;

        if (Object.keys(newData).length === 0) {
          logs.push({
            level: 'info',
            message:
              'No records found in table, using empty object for testing',
            ts: Date.now(),
          });
        } else {
          logs.push({
            level: 'info',
            message: 'Fetched sample record from database for testing',
            ts: Date.now(),
            data: { recordId: newData?.Id || newData?.id },
          });
        }
      }

      // Check if this submission is from the configured form
      if (
        !ctx.testMode &&
        formViewId &&
        formViewId !== this.config.formViewId
      ) {
        logs.push({
          level: 'info',
          message: `Form submission skipped: expected form ${this.config.formViewId}, got ${formViewId}`,
          ts: Date.now(),
        });

        return {
          outputs: {},
          status: 'skipped',
          logs,
          metrics: {
            executionTimeMs: Date.now() - startTime,
          },
        };
      }

      logs.push({
        level: 'info',
        message: 'Form submission trigger activated',
        ts: Date.now(),
        data: {
          recordId: newData?.id,
          userId: user?.id,
          formViewId: formViewId || this.config.formViewId,
        },
      });

      const executionTime = Date.now() - startTime;

      return {
        outputs: {
          record: newData,
          table: {
            id: this.config.modelId,
            name: tableName,
          },
          form: {
            id: this.config.formViewId,
            name: formName,
          },
          trigger: {
            timestamp: timestamp,
            type: 'form-submitted',
          },
        },
        status: 'success',
        logs,
        metrics: {
          executionTimeMs: executionTime,
        },
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      logs.push({
        level: 'error',
        message: `Form submission trigger failed: ${error.message}`,
        ts: Date.now(),
        data: error.stack,
      });

      return {
        outputs: {},
        status: 'error',
        error: {
          message: error.message || 'Form submission trigger failed',
          code: error.code,
        },
        logs,
        metrics: {
          executionTimeMs: executionTime,
        },
      };
    }
  }

  public async generateInputVariables(): Promise<NocoSDK.VariableDefinition[]> {
    const { modelId, formViewId } = this.config;

    if (!modelId || !formViewId) return [];

    try {
      const table = await this.nocodb.tablesService.getTableWithAccessibleViews(
        this.nocodb.context,
        {
          tableId: modelId,
          user: this.nocodb.user as any,
        },
      );

      if (!table) return [];

      const formView = table.views?.find((v: any) => v.id === formViewId);

      return [
        {
          key: 'config.modelId',
          name: 'Table',
          type: NocoSDK.VariableType.String,
          groupKey: NocoSDK.VariableGroupKey.Fields,
          extra: {
            icon: table.synced ? 'ncZap' : 'table',
            entity_id: modelId,
            entity: 'table',
            tableName: table.title,
            description: 'Table to monitor for form submissions',
          },
        },
        {
          key: 'config.formViewId',
          name: 'Form',
          type: NocoSDK.VariableType.String,
          groupKey: NocoSDK.VariableGroupKey.Fields,
          extra: {
            icon: 'form',
            entity_id: formViewId,
            entity: 'view',
            viewName: formView?.title,
            description: `Form view: ${formView?.title || 'Unknown'}`,
          },
        },
      ];
    } catch {
      return [];
    }
  }

  public async generateOutputVariables(
    context: NocoSDK.VariableGeneratorContext,
  ): Promise<NocoSDK.VariableDefinition[]> {
    const { modelId, formViewId } = this.config;

    if (!modelId) return [];

    try {
      const table = await this.nocodb.tablesService.getTableWithAccessibleViews(
        this.nocodb.context,
        {
          tableId: modelId,
          user: this.nocodb.user as any,
        },
      );

      if (!table) return [];

      const recordVariables = await NocoSDK.genRecordVariables(
        table.columns,
        false,
        'record',
        context,
      );

      const formView = table.views?.find((v: any) => v.id === formViewId);

      // Table group
      const tableVariable: NocoSDK.VariableDefinition = {
        key: 'table',
        name: 'Table',
        type: NocoSDK.VariableType.Object,
        groupKey: NocoSDK.VariableGroupKey.Meta,
        extra: {
          description: 'Table information',
          icon: table.synced ? 'ncZap' : 'table',
          entity_id: modelId,
          entity: 'table',
        },
        children: [
          {
            key: 'table.id',
            name: 'ID',
            type: NocoSDK.VariableType.String,
            groupKey: NocoSDK.VariableGroupKey.Meta,
            extra: {
              description: 'Table ID',
              icon: 'cellNumber',
            },
          },
          {
            key: 'table.name',
            name: 'Name',
            type: NocoSDK.VariableType.String,
            groupKey: NocoSDK.VariableGroupKey.Meta,
            extra: {
              description: 'Table name',
              icon: 'cellText',
            },
          },
        ],
      };

      // Form group
      const formVariable: NocoSDK.VariableDefinition = {
        key: 'form',
        name: 'Form',
        type: NocoSDK.VariableType.Object,
        groupKey: NocoSDK.VariableGroupKey.Meta,
        extra: {
          description: 'Form information',
          icon: 'form',
          entity_id: formViewId,
          entity: 'view',
        },
        children: [
          {
            key: 'form.id',
            name: 'ID',
            type: NocoSDK.VariableType.String,
            groupKey: NocoSDK.VariableGroupKey.Meta,
            extra: {
              description: 'Form view ID',
              icon: 'cellNumber',
            },
          },
          {
            key: 'form.name',
            name: 'Name',
            type: NocoSDK.VariableType.String,
            groupKey: NocoSDK.VariableGroupKey.Meta,
            extra: {
              description: `Form view name: ${formView?.title || 'Unknown'}`,
              icon: 'cellText',
            },
          },
        ],
      };

      const triggerVariable: NocoSDK.VariableDefinition = {
        key: 'trigger',
        name: 'Trigger',
        type: NocoSDK.VariableType.Object,
        groupKey: NocoSDK.VariableGroupKey.Meta,
        extra: {
          description: 'Trigger information',
          icon: 'cellJson',
        },
        children: [
          {
            key: 'trigger.timestamp',
            name: 'Timestamp',
            type: NocoSDK.VariableType.DateTime,
            groupKey: NocoSDK.VariableGroupKey.Meta,
            extra: {
              description: 'Form submission timestamp',
              icon: 'cellDatetime',
            },
          },
          {
            key: 'trigger.type',
            name: 'Type',
            type: NocoSDK.VariableType.String,
            groupKey: NocoSDK.VariableGroupKey.Meta,
            extra: {
              description: 'Trigger type',
              icon: 'cellText',
            },
          },
        ],
      };

      return [...recordVariables, tableVariable, formVariable, triggerVariable];
    } catch {
      return [];
    }
  }
}
