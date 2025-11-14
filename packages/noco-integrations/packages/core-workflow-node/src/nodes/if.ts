import {
  FormBuilderInputType,
  FormBuilderValidatorType,
  type FormDefinition,
  WorkflowNodeCategory,
  WorkflowNodeConfig,
  type WorkflowNodeDefinition,
  WorkflowNodeIntegration,
  type WorkflowNodeLog,
  type WorkflowNodeResult,
  type WorkflowNodeRunContext,
} from '@noco-integrations/core';

export enum ConditionOperation {
  EQUALS = 'equals',
  NOT_EQUALS = 'notEquals',
  CONTAINS = 'contains',
  NOT_CONTAINS = 'notContains',
  STARTS_WITH = 'startsWith',
  ENDS_WITH = 'endsWith',
  GREATER_THAN = 'greaterThan',
  GREATER_THAN_OR_EQUAL = 'greaterThanOrEqual',
  LESS_THAN = 'lessThan',
  LESS_THAN_OR_EQUAL = 'lessThanOrEqual',
  IS_EMPTY = 'isEmpty',
  IS_NOT_EMPTY = 'isNotEmpty',
  IS_TRUE = 'isTrue',
  IS_FALSE = 'isFalse',
}

interface IfNodeConfig extends WorkflowNodeConfig {
  value1: any;
  operation: ConditionOperation;
  value2?: any;
}

export class IfNode extends WorkflowNodeIntegration<IfNodeConfig> {
  public async definition(): Promise<WorkflowNodeDefinition> {
    const form: FormDefinition = [
      {
        type: FormBuilderInputType.Input,
        label: 'Value 1',
        width: 100,
        model: 'config.value1',
        placeholder: 'First value to compare',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Value 1 is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.Select,
        label: 'Operation',
        width: 100,
        model: 'config.operation',
        placeholder: 'Select condition',
        options: [
          { label: 'Equals', value: ConditionOperation.EQUALS },
          { label: 'Not Equals', value: ConditionOperation.NOT_EQUALS },
          { label: 'Contains', value: ConditionOperation.CONTAINS },
          { label: 'Not Contains', value: ConditionOperation.NOT_CONTAINS },
          { label: 'Starts With', value: ConditionOperation.STARTS_WITH },
          { label: 'Ends With', value: ConditionOperation.ENDS_WITH },
          { label: 'Greater Than', value: ConditionOperation.GREATER_THAN },
          {
            label: 'Greater Than or Equal',
            value: ConditionOperation.GREATER_THAN_OR_EQUAL,
          },
          { label: 'Less Than', value: ConditionOperation.LESS_THAN },
          {
            label: 'Less Than or Equal',
            value: ConditionOperation.LESS_THAN_OR_EQUAL,
          },
          { label: 'Is Empty', value: ConditionOperation.IS_EMPTY },
          { label: 'Is Not Empty', value: ConditionOperation.IS_NOT_EMPTY },
          { label: 'Is True', value: ConditionOperation.IS_TRUE },
          { label: 'Is False', value: ConditionOperation.IS_FALSE },
        ],
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Operation is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.Input,
        label: 'Value 2',
        width: 100,
        model: 'config.value2',
        placeholder: 'Second value to compare',
      },
    ];

    return {
      key: 'core.flow.if',
      title: 'If',
      description: 'Route execution based on a condition',
      category: WorkflowNodeCategory.FLOW,
      ports: [
        { id: 'true', direction: 'output', order: 0, label: 'True' },
        { id: 'false', direction: 'output', order: 1, label: 'False' },
      ],
      form,
      ui: { icon: 'ncGitBranch', color: '#F59E0B' },
      keywords: ['if', 'condition', 'branch', 'decision', 'flow'],
    };
  }

  public async validate(config: IfNodeConfig) {
    const errors: { path?: string; message: string }[] = [];

    if (!config.value1) {
      errors.push({ path: 'config.value1', message: 'Value 1 is required' });
    }

    if (!config.operation) {
      errors.push({
        path: 'config.operation',
        message: 'Operation is required',
      });
    }

    // Check if operation requires value2
    const requiresValue2 = [
      ConditionOperation.EQUALS,
      ConditionOperation.NOT_EQUALS,
      ConditionOperation.CONTAINS,
      ConditionOperation.NOT_CONTAINS,
      ConditionOperation.STARTS_WITH,
      ConditionOperation.ENDS_WITH,
      ConditionOperation.GREATER_THAN,
      ConditionOperation.GREATER_THAN_OR_EQUAL,
      ConditionOperation.LESS_THAN,
      ConditionOperation.LESS_THAN_OR_EQUAL,
    ].includes(config.operation);

    if (requiresValue2 && !config.value2) {
      errors.push({
        path: 'config.value2',
        message: 'Value 2 is required for this operation',
      });
    }

    return { valid: errors.length === 0, errors };
  }

  public async run(ctx: WorkflowNodeRunContext): Promise<WorkflowNodeResult> {
    const logs: WorkflowNodeLog[] = [];
    const startTime = Date.now();

    try {
      const { value1, operation, value2 } = ctx.inputs.config;

      logs.push({
        level: 'info',
        message: `Evaluating condition: ${value1} ${operation} ${value2 || ''}`,
        ts: Date.now(),
      });

      const result = this.evaluateCondition(value1, operation, value2);
      const executionTime = Date.now() - startTime;

      logs.push({
        level: 'info',
        message: `Condition evaluated to: ${result}`,
        ts: Date.now(),
        data: { result, value1, operation, value2 },
      });

      return {
        outputs: {
          result,
          value1,
          operation,
          value2,
        },
        status: 'success',
        logs,
        metrics: {
          executionTimeMs: executionTime,
          conditionResult: result ? 1 : 0,
        },
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      logs.push({
        level: 'error',
        message: `Condition evaluation failed: ${error.message}`,
        ts: Date.now(),
        data: error.stack,
      });

      return {
        outputs: {},
        status: 'error',
        error: {
          message: error.message || 'Condition evaluation failed',
          code: error.code,
        },
        logs,
        metrics: {
          executionTimeMs: executionTime,
        },
      };
    }
  }

  private evaluateCondition(
    value1: any,
    operation: ConditionOperation,
    value2?: any,
  ): boolean {
    // Convert values to strings for consistent handling
    const str1 = value1 == null ? '' : String(value1);
    const str2 = value2 == null ? '' : String(value2);

    // Try to parse as numbers for numeric comparisons
    const num1 = parseFloat(str1);
    const num2 = parseFloat(str2);
    const isNumeric = !isNaN(num1) && (str2 !== '' ? !isNaN(num2) : true);

    switch (operation) {
      case ConditionOperation.EQUALS:
        // Use numeric comparison if both are valid numbers
        if (isNumeric && str2 !== '') {
          return num1 === num2;
        }
        // Otherwise use string comparison
        return str1 === str2;

      case ConditionOperation.NOT_EQUALS:
        if (isNumeric && str2 !== '') {
          return num1 !== num2;
        }
        return str1 !== str2;

      case ConditionOperation.CONTAINS:
        return str1.includes(str2);

      case ConditionOperation.NOT_CONTAINS:
        return !str1.includes(str2);

      case ConditionOperation.STARTS_WITH:
        return str1.startsWith(str2);

      case ConditionOperation.ENDS_WITH:
        return str1.endsWith(str2);

      case ConditionOperation.GREATER_THAN:
        if (isNumeric && str2 !== '') {
          return num1 > num2;
        }
        // Lexicographic comparison for strings
        return str1 > str2;

      case ConditionOperation.GREATER_THAN_OR_EQUAL:
        if (isNumeric && str2 !== '') {
          return num1 >= num2;
        }
        return str1 >= str2;

      case ConditionOperation.LESS_THAN:
        if (isNumeric && str2 !== '') {
          return num1 < num2;
        }
        return str1 < str2;

      case ConditionOperation.LESS_THAN_OR_EQUAL:
        if (isNumeric && str2 !== '') {
          return num1 <= num2;
        }
        return str1 <= str2;

      case ConditionOperation.IS_EMPTY:
        return str1.trim() === '';

      case ConditionOperation.IS_NOT_EMPTY:
        return str1.trim() !== '';

      case ConditionOperation.IS_TRUE:
        // Handle boolean, string, and number types
        const lowerStr1 = str1.toLowerCase().trim();
        return (
          lowerStr1 === 'true' ||
          lowerStr1 === '1' ||
          lowerStr1 === 'yes' ||
          lowerStr1 === 'on' ||
          value1 === true ||
          value1 === 1
        );

      case ConditionOperation.IS_FALSE:
        // Handle boolean, string, and number types
        const lowerStr1False = str1.toLowerCase().trim();
        return (
          lowerStr1False === 'false' ||
          lowerStr1False === '0' ||
          lowerStr1False === 'no' ||
          lowerStr1False === 'off' ||
          lowerStr1False === '' ||
          value1 === false ||
          value1 === 0
        );

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }
}
