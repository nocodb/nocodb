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

interface RecordEntersViewTriggerConfig extends WorkflowNodeConfig {
  modelId: string;
  viewId: string;
}

export class RecordEntersViewTriggerNode extends WorkflowNodeIntegration<RecordEntersViewTriggerConfig> {
  public async definition(): Promise<WorkflowNodeDefinition> {
    const form: FormDefinition = [
      {
        type: FormBuilderInputType.SelectTable,
        label: 'Select Table',
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
        label: 'Select View',
        span: 24,
        model: 'config.viewId',
        placeholder: 'Select a view',
        fetchOptionsKey: 'views',
        dependsOn: 'config.modelId',
        condition: {
          model: 'config.modelId',
          notEmpty: true,
        },
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'View is required',
          },
        ],
      },
    ];

    return {
      id: 'nocodb.trigger.record_enters_view',
      title: 'When record enters a view',
      description:
        'Triggers when a record enters a view (matches view filters)',
      icon: 'ncRecordEntersView',
      category: WorkflowNodeCategory.TRIGGER,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      documentation:
        'https://nocodb.com/docs/workflows/nodes/trigger-nodes/record-enters-view',
      keywords: ['trigger', 'view', 'filter', 'enters', 'condition', 'matches'],
    };
  }

  public async fetchOptions(key: 'tables' | 'views') {
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
      case 'views': {
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

          const validViews = table.views.filter(
            (view: any) => view.type !== NocoSDK.ViewTypes.FORM,
          );

          if (validViews.length === 0) {
            return [];
          }

          return validViews.map((view: any) => ({
            label: view.title,
            value: view.id,
            view,
          }));
        } catch (error) {
          console.error('Failed to fetch views:', error);
          return [];
        }
      }
      default:
        return [];
    }
  }

  public async validate(config: RecordEntersViewTriggerConfig) {
    const errors: { path?: string; message: string }[] = [];

    if (!config.modelId) {
      errors.push({ path: 'config.modelId', message: 'Table is required' });
    }

    if (!config.viewId) {
      errors.push({
        path: 'config.viewId',
        message: 'View is required',
      });
    }

    if (config.modelId && config.viewId) {
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
          const view = table.views?.find((v: any) => v.id === config.viewId);

          if (!view) {
            errors.push({
              path: 'config.viewId',
              message: 'View not found or not accessible',
            });
          }
        }
      } catch {
        errors.push({
          path: 'config.modelId',
          message: 'Failed to validate table and view',
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
      let { newData, user, timestamp } = ctx.inputs as any;
      let tableName = '';
      let viewName = '';

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

        // Get view name
        if (table?.views) {
          const view = table.views.find(
            (v: any) => v.id === this.config.viewId,
          );
          viewName = view?.title || '';
        }
      } catch {
        tableName = '';
        viewName = '';
      }

      if (ctx.testMode) {
        newData = await this.fetchSampleRecord();
        user = this.nocodb.user;
        timestamp = new Date().toISOString();

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

      logs.push({
        level: 'info',
        message: 'Record entered view trigger activated',
        ts: Date.now(),
        data: {
          recordId: newData?.id,
          userId: user?.id,
          viewId: this.config.viewId,
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
          view: {
            id: this.config.viewId,
            name: viewName,
          },
          trigger: {
            timestamp: timestamp,
            type: 'record-enters-view',
          },
          user: {
            id: user?.id,
            name: user?.display_name,
            email: user?.email,
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
        message: `Record enters view trigger failed: ${error.message}`,
        ts: Date.now(),
        data: error.stack,
      });

      return {
        outputs: {},
        status: 'error',
        error: {
          message: error.message || 'Record enters view trigger failed',
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
    const { modelId, viewId } = this.config;

    if (!modelId || !viewId) return [];

    try {
      const table = await this.nocodb.tablesService.getTableWithAccessibleViews(
        this.nocodb.context,
        {
          tableId: modelId,
          user: this.nocodb.user as any,
        },
      );

      if (!table) return [];

      const view = table.views?.find((v: any) => v.id === viewId);

      const iconMap = {
        [NocoSDK.ViewTypes.FORM]: 'form',
        [NocoSDK.ViewTypes.GRID]: 'grid',
        [NocoSDK.ViewTypes.KANBAN]: 'kanban',
        [NocoSDK.ViewTypes.CALENDAR]: 'calendar',
        [NocoSDK.ViewTypes.GALLERY]: 'gallery',
        [NocoSDK.ViewTypes.MAP]: 'map',
      };

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
            description: 'Table to monitor',
          },
        },
        {
          key: 'config.viewId',
          name: 'View',
          type: NocoSDK.VariableType.String,
          groupKey: NocoSDK.VariableGroupKey.Fields,
          extra: {
            icon: view?.type
              ? iconMap[view.type as keyof typeof iconMap]
              : 'view',
            entity_id: viewId,
            entity: 'view',
            viewName: view?.title,
            description: `View: ${view?.title || 'Unknown'}`,
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
    const { modelId, viewId } = this.config;

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

      const view = table.views?.find((v: any) => v.id === viewId);

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

      const iconMap = {
        [NocoSDK.ViewTypes.FORM]: 'form',
        [NocoSDK.ViewTypes.GRID]: 'grid',
        [NocoSDK.ViewTypes.KANBAN]: 'kanban',
        [NocoSDK.ViewTypes.CALENDAR]: 'calendar',
        [NocoSDK.ViewTypes.GALLERY]: 'gallery',
        [NocoSDK.ViewTypes.MAP]: 'map',
      };

      // View group
      const viewVariable: NocoSDK.VariableDefinition = {
        key: 'view',
        name: 'View',
        type: NocoSDK.VariableType.Object,
        groupKey: NocoSDK.VariableGroupKey.Meta,
        extra: {
          description: 'View information',
          icon: view?.type
            ? iconMap[view.type as keyof typeof iconMap]
            : 'view',
          entity_id: viewId,
          entity: 'view',
        },
        children: [
          {
            key: 'view.id',
            name: 'ID',
            type: NocoSDK.VariableType.String,
            groupKey: NocoSDK.VariableGroupKey.Meta,
            extra: {
              description: 'View ID',
              icon: 'cellNumber',
            },
          },
          {
            key: 'view.name',
            name: 'Name',
            type: NocoSDK.VariableType.String,
            groupKey: NocoSDK.VariableGroupKey.Meta,
            extra: {
              description: `View name: ${view?.title || 'Unknown'}`,
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
              description: 'When the record entered the view',
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

      const userVariables: NocoSDK.VariableDefinition = {
        key: 'user',
        name: 'User',
        type: NocoSDK.VariableType.Object,
        groupKey: NocoSDK.VariableGroupKey.Meta,
        extra: {
          description: 'User who triggered the change',
          icon: 'ncUser',
        },
        children: [
          {
            key: 'user.id',
            name: 'ID',
            type: NocoSDK.VariableType.String,
            groupKey: NocoSDK.VariableGroupKey.Meta,
            extra: {
              description: 'User ID',
              icon: 'cellNumber',
            },
          },
          {
            key: 'user.name',
            name: 'Name',
            type: NocoSDK.VariableType.String,
            groupKey: NocoSDK.VariableGroupKey.Meta,
            extra: {
              description: 'User name',
              icon: 'cellText',
            },
          },
          {
            key: 'user.email',
            name: 'Email',
            type: NocoSDK.VariableType.String,
            groupKey: NocoSDK.VariableGroupKey.Meta,
            extra: {
              description: 'User email',
              icon: 'cellEmail',
            },
          },
        ],
      };

      return [
        ...recordVariables,
        tableVariable,
        viewVariable,
        triggerVariable,
        userVariables,
      ];
    } catch {
      return [];
    }
  }
}
