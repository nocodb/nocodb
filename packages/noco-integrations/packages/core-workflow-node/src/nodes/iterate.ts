import {
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

export interface IterateNodeConfig extends WorkflowNodeConfig {
  array: string;
}

export class IterateNode extends WorkflowNodeIntegration<IterateNodeConfig> {
  public async definition(): Promise<WorkflowNodeDefinition> {
    const form: FormDefinition = [];

    return {
      id: 'core.flow.iterate',
      title: 'Iterate',
      description: 'Loop over an array and execute child nodes for each item',
      icon: 'ncRepeat',
      category: WorkflowNodeCategory.FLOW,
      ports: [
        { id: 'body', direction: 'output', order: 0, label: 'For Each Item' },
        { id: 'output', direction: 'output', order: 1, label: 'After Iterate' },
      ],
      form,
      keywords: ['loop', 'iterate', 'for', 'each', 'array', 'repeat', 'map'],
    };
  }

  public async validate(config: IterateNodeConfig) {
    const errors: { path?: string; message: string }[] = [];

    if (!config.array) {
      errors.push({ path: 'config.array', message: 'Array is required' });
    }

    return { valid: errors.length === 0, errors };
  }

  public async run(
    ctx: WorkflowNodeRunContext<IterateNodeConfig>,
  ): Promise<WorkflowNodeResult> {
    const logs: WorkflowNodeLog[] = [];
    const startTime = Date.now();

    try {
      const { array } = ctx.inputs.config;

      if (!NocoSDK.ncIsArray(array)) {
        logs.push({
          level: 'error',
          message: 'Array input must be an array',
          ts: Date.now(),
          data: { type: typeof array },
        });

        return {
          outputs: {},
          status: 'error',
          error: {
            message: 'Array input must be an array',
            code: 'NOT_AN_ARRAY',
          },
          logs,
          metrics: {
            executionTimeMs: Date.now() - startTime,
          },
        };
      }

      if (array.length === 0) {
        logs.push({
          level: 'info',
          message: 'Array is empty, skipping iteration',
          ts: Date.now(),
        });

        return {
          outputs: {
            itemCount: 0,
            port: 'output', // Skip to "After Loop" port
          },
          status: 'success',
          logs,
          metrics: {
            itemCount: 0,
            executionTimeMs: Date.now() - startTime,
          },
        };
      }

      logs.push({
        level: 'info',
        message: `Starting iteration over ${array.length} item(s)`,
        ts: Date.now(),
        data: { itemCount: array.length },
      });

      const executionTime = Date.now() - startTime;

      logs.push({
        level: 'info',
        message: `Iteration setup complete`,
        ts: Date.now(),
        data: { itemCount: array.length },
      });

      return {
        outputs: {
          itemCount: array.length,
          items: array,
          port: 'body', // Start with "For Each Item" port
        },
        status: 'success',
        logs,
        metrics: {
          itemCount: array.length,
          executionTimeMs: executionTime,
        },
        loopContext: {
          state: {
            items: array,
            currentIndex: 0,
            totalItems: array.length,
          },
          bodyPort: 'body',
          exitPort: 'output',
        },
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      logs.push({
        level: 'error',
        message: `Iteration failed: ${error.message}`,
        ts: Date.now(),
        data: { error: error.message, stack: error.stack },
      });

      return {
        outputs: {},
        status: 'error',
        error: {
          message: error.message || 'Iteration failed',
          code: error.code || 'ITERATION_ERROR',
        },
        logs,
        metrics: {
          executionTimeMs: executionTime,
        },
      };
    }
  }

  public async generateInputVariables(
    _context: NocoSDK.VariableGeneratorContext,
  ): Promise<NocoSDK.VariableDefinition[]> {
    const variables: NocoSDK.VariableDefinition[] = [];

    // TODO: Figure out a way to get the VariableDefinition of the Input Array
    variables.push({
      key: 'config.array',
      name: 'Array',
      type: NocoSDK.VariableType.Array,
      groupKey: NocoSDK.VariableGroupKey.Fields,
      extra: {
        icon: 'cellJson',
        description:
          'Array to iterate over. Each item will be processed sequentially.',
      },
    });

    return variables;
  }

  public async generateOutputVariables(
    _context: NocoSDK.VariableGeneratorContext,
  ): Promise<NocoSDK.VariableDefinition[]> {
    // TODO: Figure out to pass the itemSchema from input
    let itemSchema: NocoSDK.VariableDefinition[] | undefined;

    const bodyPortVariables: NocoSDK.VariableDefinition[] = [
      {
        key: 'item',
        name: 'Current Item',
        type: NocoSDK.VariableType.Object,
        groupKey: NocoSDK.VariableGroupKey.Iteration,
        extra: {
          icon: 'cellJson',
          description: 'The current item being processed in the iteration',
          port: 'body',
          itemSchema: itemSchema,
        },
      },
      {
        key: 'index',
        name: 'Current Index',
        type: NocoSDK.VariableType.Number,
        groupKey: NocoSDK.VariableGroupKey.Iteration,
        extra: {
          icon: 'cellNumber',
          description: 'The index of the current item',
          port: 'body',
        },
      },
    ];

    const outputPortVariables: NocoSDK.VariableDefinition[] = [
      {
        key: 'itemCount',
        name: 'Item Count',
        type: NocoSDK.VariableType.Number,
        groupKey: NocoSDK.VariableGroupKey.Meta,
        extra: {
          icon: 'cellNumber',
          description: 'Items processed',
          port: 'output',
        },
      },
    ];

    return [...bodyPortVariables, ...outputPortVariables];
  }
}
