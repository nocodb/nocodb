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

export enum FilterOperation {
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
}

interface FilterNodeConfig extends WorkflowNodeConfig {
  inputArrayPath: string;
  filterField: string;
  operation: FilterOperation;
  filterValue?: string;
}

export class FilterNode extends WorkflowNodeIntegration<FilterNodeConfig> {
  public async definition(): Promise<WorkflowNodeDefinition> {
    const form: FormDefinition = [
      {
        type: FormBuilderInputType.Input,
        label: 'Input Array Path',
        width: 100,
        model: 'config.inputArrayPath',
        placeholder: 'e.g., "items" or leave empty for root',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Input array path is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.Input,
        label: 'Filter Field',
        width: 100,
        model: 'config.filterField',
        placeholder: 'Field name to filter by (e.g., "status")',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Filter field is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.Select,
        label: 'Operation',
        width: 100,
        model: 'config.operation',
        placeholder: 'Select filter operation',
        options: [
          { label: 'Equals', value: FilterOperation.EQUALS },
          { label: 'Not Equals', value: FilterOperation.NOT_EQUALS },
          { label: 'Contains', value: FilterOperation.CONTAINS },
          { label: 'Not Contains', value: FilterOperation.NOT_CONTAINS },
          { label: 'Starts With', value: FilterOperation.STARTS_WITH },
          { label: 'Ends With', value: FilterOperation.ENDS_WITH },
          { label: 'Greater Than', value: FilterOperation.GREATER_THAN },
          {
            label: 'Greater Than or Equal',
            value: FilterOperation.GREATER_THAN_OR_EQUAL,
          },
          { label: 'Less Than', value: FilterOperation.LESS_THAN },
          {
            label: 'Less Than or Equal',
            value: FilterOperation.LESS_THAN_OR_EQUAL,
          },
          { label: 'Is Empty', value: FilterOperation.IS_EMPTY },
          { label: 'Is Not Empty', value: FilterOperation.IS_NOT_EMPTY },
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
        label: 'Filter Value',
        width: 100,
        model: 'config.filterValue',
        placeholder: 'Value to filter by',
      },
    ];

    return {
      key: 'core.flow.filter',
      title: 'Filter',
      description: 'Filter an array based on a condition',
      category: WorkflowNodeCategory.FLOW,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      ui: { icon: 'filter', color: '#06B6D4' },
      keywords: ['filter', 'array', 'list', 'condition', 'where'],
    };
  }

  public async validate(config: FilterNodeConfig) {
    const errors: { path?: string; message: string }[] = [];

    if (!config.inputArrayPath) {
      errors.push({
        path: 'config.inputArrayPath',
        message: 'Input array path is required',
      });
    }

    if (!config.filterField) {
      errors.push({
        path: 'config.filterField',
        message: 'Filter field is required',
      });
    }

    if (!config.operation) {
      errors.push({
        path: 'config.operation',
        message: 'Operation is required',
      });
    }

    // Check if operation requires filterValue
    const requiresValue = [
      FilterOperation.EQUALS,
      FilterOperation.NOT_EQUALS,
      FilterOperation.CONTAINS,
      FilterOperation.NOT_CONTAINS,
      FilterOperation.STARTS_WITH,
      FilterOperation.ENDS_WITH,
      FilterOperation.GREATER_THAN,
      FilterOperation.GREATER_THAN_OR_EQUAL,
      FilterOperation.LESS_THAN,
      FilterOperation.LESS_THAN_OR_EQUAL,
    ].includes(config.operation);

    if (requiresValue && !config.filterValue) {
      errors.push({
        path: 'config.filterValue',
        message: 'Filter value is required for this operation',
      });
    }

    return { valid: errors.length === 0, errors };
  }

  public async run(ctx: WorkflowNodeRunContext): Promise<WorkflowNodeResult> {
    const logs: WorkflowNodeLog[] = [];
    const startTime = Date.now();

    try {
      const { inputArrayPath, filterField, operation, filterValue } =
        ctx.inputs.config;

      logs.push({
        level: 'info',
        message: `Filtering array by ${filterField} ${operation} ${filterValue || ''}`,
        ts: Date.now(),
      });

      // Get the array from inputs
      let inputArray = ctx.inputs[inputArrayPath];

      // If inputArrayPath is empty or ".", use the entire inputs object
      if (!inputArrayPath || inputArrayPath === '.') {
        inputArray = ctx.inputs;
      }

      if (!Array.isArray(inputArray)) {
        throw new Error(
          `Input at path "${inputArrayPath}" is not an array. Got: ${typeof inputArray}`,
        );
      }

      // Filter the array
      const filteredArray = inputArray.filter((item) => {
        const fieldValue = this.getNestedValue(item, filterField);
        return this.evaluateCondition(fieldValue, operation, filterValue);
      });

      const executionTime = Date.now() - startTime;

      logs.push({
        level: 'info',
        message: `Filtered ${inputArray.length} items to ${filteredArray.length} items`,
        ts: Date.now(),
        data: {
          originalCount: inputArray.length,
          filteredCount: filteredArray.length,
        },
      });

      return {
        outputs: {
          items: filteredArray,
          count: filteredArray.length,
          originalCount: inputArray.length,
        },
        status: 'success',
        logs,
        metrics: {
          executionTimeMs: executionTime,
          itemsFiltered: filteredArray.length,
          itemsRemoved: inputArray.length - filteredArray.length,
        },
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      logs.push({
        level: 'error',
        message: `Filter operation failed: ${error.message}`,
        ts: Date.now(),
        data: error.stack,
      });

      return {
        outputs: {},
        status: 'error',
        error: {
          message: error.message || 'Filter operation failed',
          code: error.code,
        },
        logs,
        metrics: {
          executionTimeMs: executionTime,
        },
      };
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private evaluateCondition(
    fieldValue: any,
    operation: FilterOperation,
    filterValue?: string,
  ): boolean {
    // Convert to string for string operations
    const strValue = String(fieldValue ?? '');
    const strFilter = String(filterValue ?? '');

    // Try to parse as numbers for numeric comparisons
    const num1 = parseFloat(strValue);
    const num2 = parseFloat(strFilter);
    const isNumeric = !isNaN(num1) && !isNaN(num2);

    switch (operation) {
      case FilterOperation.EQUALS:
        return isNumeric ? num1 === num2 : strValue === strFilter;

      case FilterOperation.NOT_EQUALS:
        return isNumeric ? num1 !== num2 : strValue !== strFilter;

      case FilterOperation.CONTAINS:
        return strValue.includes(strFilter);

      case FilterOperation.NOT_CONTAINS:
        return !strValue.includes(strFilter);

      case FilterOperation.STARTS_WITH:
        return strValue.startsWith(strFilter);

      case FilterOperation.ENDS_WITH:
        return strValue.endsWith(strFilter);

      case FilterOperation.GREATER_THAN:
        return isNumeric ? num1 > num2 : strValue > strFilter;

      case FilterOperation.GREATER_THAN_OR_EQUAL:
        return isNumeric ? num1 >= num2 : strValue >= strFilter;

      case FilterOperation.LESS_THAN:
        return isNumeric ? num1 < num2 : strValue < strFilter;

      case FilterOperation.LESS_THAN_OR_EQUAL:
        return isNumeric ? num1 <= num2 : strValue <= strFilter;

      case FilterOperation.IS_EMPTY:
        return (
          fieldValue === null || fieldValue === undefined || strValue === ''
        );

      case FilterOperation.IS_NOT_EMPTY:
        return (
          fieldValue !== null && fieldValue !== undefined && strValue !== ''
        );

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }
}
