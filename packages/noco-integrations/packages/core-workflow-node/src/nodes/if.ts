import {
  NocoSDK,
  WorkflowNodeCategory,
  WorkflowNodeIntegration
} from '@noco-integrations/core';
import type {
  FormDefinition,
  WorkflowNodeConfig,
  WorkflowNodeDefinition,
  WorkflowNodeLog,
  WorkflowNodeResult,
  WorkflowNodeRunContext
} from '@noco-integrations/core';

export interface IfNodeConfig extends WorkflowNodeConfig {
  conditions: NocoSDK.WorkflowNodeConditionItem[];
}

export class IfNode extends WorkflowNodeIntegration<IfNodeConfig> {
  private static readonly OPERATIONS_WITHOUT_VALUE = new Set([
    NocoSDK.WorkflowNodeComparisonOp.EMPTY,
    NocoSDK.WorkflowNodeComparisonOp.NOT_EMPTY,
    NocoSDK.WorkflowNodeComparisonOp.NULL,
    NocoSDK.WorkflowNodeComparisonOp.NOT_NULL,
    NocoSDK.WorkflowNodeComparisonOp.BLANK,
    NocoSDK.WorkflowNodeComparisonOp.NOT_BLANK,
    NocoSDK.WorkflowNodeComparisonOp.CHECKED,
    NocoSDK.WorkflowNodeComparisonOp.NOT_CHECKED,
  ]);

  private static readonly MS_PER_DAY = 24 * 60 * 60 * 1000;

  public async definition(): Promise<WorkflowNodeDefinition> {
    const form: FormDefinition = [];

    return {
      id: 'core.flow.if',
      title: 'If/Else',
      icon: 'ncIfElse',
      description: 'Route execution based on conditions',
      category: WorkflowNodeCategory.FLOW,
      ports: [
        { id: 'true', direction: 'output', order: 0, label: 'True' },
        { id: 'false', direction: 'output', order: 1, label: 'False' },
      ],
      form,
      keywords: ['if', 'condition', 'branch', 'decision', 'flow', 'filter'],
    };
  }

  private validateConditionItem(item: NocoSDK.WorkflowNodeConditionItem, path: string): { path?: string; message: string }[] {
    const errors: { path?: string; message: string }[] = [];

    if ('is_group' in item && item.is_group) {
      if (!item.children || item.children.length === 0) {
        errors.push({
          path: `${path}.children`,
          message: 'Group must have at least one child condition',
        });
      } else {
        item.children.forEach((child, index) => {
          const childPath = `${path}.children[${index}]`;
          errors.push(...this.validateConditionItem(child, childPath));
        });
      }
    } else {
      const condition = item as NocoSDK.WorkflowNodeFilterCondition;
      if (!condition.field) {
        errors.push({ path: `${path}.field`, message: 'Field is required' });
      }
      if (!condition.comparison_op) {
        errors.push({ path: `${path}.comparison_op`, message: 'Comparison operation is required' });
      }
      if (this.operationRequiresValue(condition.comparison_op) &&
          condition.value === undefined ||
          condition.value === '') {
        errors.push({ path: `${path}.value`, message: 'Value is required for this operation' });
      }
    }

    return errors;
  }

  public async validate(config: IfNodeConfig) {
    const errors: { path?: string; message: string }[] = [];

    if (!config.conditions || config.conditions.length === 0) {
      errors.push({
        path: 'config.conditions',
        message: 'At least one condition is required',
      });
      return { valid: false, errors };
    }

    config.conditions.forEach((item, index) => {
      errors.push(...this.validateConditionItem(item, `config.conditions[${index}]`));
    });

    return { valid: errors.length === 0, errors };
  }

  private evaluateConditionItem(
    item: NocoSDK.WorkflowNodeConditionItem,
    ctx: WorkflowNodeRunContext,
    logs: WorkflowNodeLog[],
  ): boolean {
    if ('is_group' in item && item.is_group) {
      // Evaluate group recursively
      const group = item as NocoSDK.WorkflowNodeConditionGroup;
      const results = group.children.map((child) => this.evaluateConditionItem(child, ctx, logs));

      const result = group.logical_op === 'and'
        ? results.every((r) => r)
        : results.some((r) => r);

      logs.push({
        level: 'info',
        message: `Group (${group.logical_op.toUpperCase()}): ${result ? 'PASSED' : 'FAILED'}`,
        ts: Date.now(),
        data: { group: group.logical_op, results, finalResult: result },
      });

      return result;
    } else {
      const condition = item as NocoSDK.WorkflowNodeFilterCondition;
      return this.evaluateCondition(condition, ctx, logs);
    }
  }

  public async run(ctx: WorkflowNodeRunContext): Promise<WorkflowNodeResult> {
    const logs: WorkflowNodeLog[] = [];
    const startTime = Date.now();

    try {
      const { conditions } = ctx.inputs.config;

      logs.push({
        level: 'info',
        message: `Evaluating ${conditions.length} condition item(s)`,
        ts: Date.now(),
        data: { conditions },
      });

      const results = conditions.map((item: NocoSDK.WorkflowNodeConditionItem) => {
        return this.evaluateConditionItem(item, ctx, logs);
      });

      const finalResult = results.every((r: boolean) => r);
      const executionTime = Date.now() - startTime;

      logs.push({
        level: 'info',
        message: `Final result: ${finalResult}`,
        ts: Date.now(),
        data: { results, finalResult },
      });

      return {
        outputs: {
          result: finalResult,
          conditions: conditions.map((item: NocoSDK.WorkflowNodeConditionItem, i: number) => ({
            ...item,
            result: results[i],
          })),
        },
        status: 'success',
        logs,
        metrics: {
          executionTimeMs: executionTime,
          conditionResult: finalResult ? 1 : 0,
          totalConditions: conditions.length,
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

  private operationRequiresValue(op: NocoSDK.WorkflowNodeComparisonOp): boolean {
    return !IfNode.OPERATIONS_WITHOUT_VALUE.has(op);
  }

  private evaluateCondition(condition: NocoSDK.WorkflowNodeFilterCondition, ctx: WorkflowNodeRunContext, logs: WorkflowNodeLog[]): boolean {
    const { field, dataType, comparison_op, comparison_sub_op, value } = condition;

    const fieldValue = field;
    const comparisonValue = value;

    const detectedDataType = dataType || this.detectDataType(fieldValue) || NocoSDK.WorkflowNodeFilterDataType.TEXT;

    const result = (() => {
      switch (detectedDataType) {
        case NocoSDK.WorkflowNodeFilterDataType.TEXT:
          return this.evaluateTextCondition(fieldValue, comparison_op, comparisonValue);
        case NocoSDK.WorkflowNodeFilterDataType.NUMBER:
          return this.evaluateNumberCondition(fieldValue, comparison_op, comparisonValue);
        case NocoSDK.WorkflowNodeFilterDataType.DATE:
        case NocoSDK.WorkflowNodeFilterDataType.DATETIME:
          return this.evaluateDateCondition(fieldValue, comparison_op, comparison_sub_op, comparisonValue);
        case NocoSDK.WorkflowNodeFilterDataType.BOOLEAN:
          return this.evaluateBooleanCondition(fieldValue, comparison_op);
        case NocoSDK.WorkflowNodeFilterDataType.SELECT:
        case NocoSDK.WorkflowNodeFilterDataType.MULTI_SELECT:
          return this.evaluateSelectCondition(fieldValue, comparison_op, comparisonValue);
        case NocoSDK.WorkflowNodeFilterDataType.JSON:
          return this.evaluateJsonCondition(fieldValue, comparison_op, comparisonValue);
        default:
          throw new Error(`Unknown data type: ${detectedDataType}`);
      }
    })();

    logs.push({
      level: 'info',
      message: `Condition: ${field} ${comparison_op} ${comparisonValue || ''} = ${result}`,
      ts: Date.now(),
      data: { condition, fieldValue, comparisonValue, detectedDataType, result },
    });

    return result;
  }

  private detectDataType(value: any): NocoSDK.WorkflowNodeFilterDataType | undefined {
    if (value == null) return undefined;

    if (typeof value === 'boolean') return NocoSDK.WorkflowNodeFilterDataType.BOOLEAN;
    if (typeof value === 'number') return NocoSDK.WorkflowNodeFilterDataType.NUMBER;
    if (value instanceof Date) return NocoSDK.WorkflowNodeFilterDataType.DATETIME;
    if (typeof value === 'string') {
      const date = new Date(value);
      if (!isNaN(date.getTime()) && /^\d{4}-\d{2}-\d{2}/.test(value)) {
        return NocoSDK.WorkflowNodeFilterDataType.DATE;
      }
      return NocoSDK.WorkflowNodeFilterDataType.TEXT;
    }
    if (Array.isArray(value)) return NocoSDK.WorkflowNodeFilterDataType.MULTI_SELECT;
    if (typeof value === 'object') return NocoSDK.WorkflowNodeFilterDataType.JSON;

    return undefined;
  }

  // Helper to check NULL operations (shared across all types)
  private checkNullOp(fieldValue: any, op: NocoSDK.WorkflowNodeComparisonOp): boolean | null {
    if (op === NocoSDK.WorkflowNodeComparisonOp.NULL) return fieldValue == null;
    if (op === NocoSDK.WorkflowNodeComparisonOp.NOT_NULL) return fieldValue != null;
    return null;
  }

  // Helper to check BLANK operations (shared across all types)
  private checkBlankOp(fieldValue: any, op: NocoSDK.WorkflowNodeComparisonOp, isEmpty: (val: any) => boolean): boolean | null {
    if (op === NocoSDK.WorkflowNodeComparisonOp.BLANK) {
      return fieldValue == null || isEmpty(fieldValue);
    }
    if (op === NocoSDK.WorkflowNodeComparisonOp.NOT_BLANK) {
      return fieldValue != null && !isEmpty(fieldValue);
    }
    return null;
  }

  private evaluateTextCondition(fieldValue: any, op: NocoSDK.WorkflowNodeComparisonOp, value?: any): boolean {
    const str1 = fieldValue == null ? '' : String(fieldValue);
    const str2 = value == null ? '' : String(value);

    // Check common operations
    const nullResult = this.checkNullOp(fieldValue, op);
    if (nullResult !== null) return nullResult;

    const blankResult = this.checkBlankOp(fieldValue, op, (val) => String(val).trim() === '');
    if (blankResult !== null) return blankResult;

    switch (op) {
      case NocoSDK.WorkflowNodeComparisonOp.EQ:
        return str1 === str2;
      case NocoSDK.WorkflowNodeComparisonOp.NEQ:
        return str1 !== str2;
      case NocoSDK.WorkflowNodeComparisonOp.LIKE:
        return str1.toLowerCase().includes(str2.toLowerCase());
      case NocoSDK.WorkflowNodeComparisonOp.NLIKE:
        return !str1.toLowerCase().includes(str2.toLowerCase());
      case NocoSDK.WorkflowNodeComparisonOp.EMPTY:
        return str1.trim() === '';
      case NocoSDK.WorkflowNodeComparisonOp.NOT_EMPTY:
        return str1.trim() !== '';
      default:
        throw new Error(`Unsupported text operation: ${op}`);
    }
  }

  private evaluateNumberCondition(fieldValue: any, op: NocoSDK.WorkflowNodeComparisonOp, value?: any): boolean {
    const num1 = parseFloat(fieldValue);
    const num2 = parseFloat(value);

    if (isNaN(num1)) {
      return op === NocoSDK.WorkflowNodeComparisonOp.NULL || op === NocoSDK.WorkflowNodeComparisonOp.BLANK;
    }

    // Check common operations
    const nullResult = this.checkNullOp(fieldValue, op);
    if (nullResult !== null) return nullResult;

    const blankResult = this.checkBlankOp(fieldValue, op, (val) => isNaN(parseFloat(val)));
    if (blankResult !== null) return blankResult;

    switch (op) {
      case NocoSDK.WorkflowNodeComparisonOp.EQ:
        return num1 === num2;
      case NocoSDK.WorkflowNodeComparisonOp.NEQ:
        return num1 !== num2;
      case NocoSDK.WorkflowNodeComparisonOp.GT:
        return num1 > num2;
      case NocoSDK.WorkflowNodeComparisonOp.LT:
        return num1 < num2;
      case NocoSDK.WorkflowNodeComparisonOp.GTE:
        return num1 >= num2;
      case NocoSDK.WorkflowNodeComparisonOp.LTE:
        return num1 <= num2;
      default:
        throw new Error(`Unsupported number operation: ${op}`);
    }
  }

  private evaluateDateCondition(
    fieldValue: any,
    op: NocoSDK.WorkflowNodeComparisonOp,
    subOp?: NocoSDK.WorkflowNodeComparisonSubOp,
    value?: any,
  ): boolean {
    const date1 = new Date(fieldValue);
    if (isNaN(date1.getTime())) {
      return op === NocoSDK.WorkflowNodeComparisonOp.NULL || op === NocoSDK.WorkflowNodeComparisonOp.BLANK;
    }

    // Check common operations
    const nullResult = this.checkNullOp(fieldValue, op);
    if (nullResult !== null) return nullResult;

    const blankResult = this.checkBlankOp(fieldValue, op, (val) => isNaN(new Date(val).getTime()));
    if (blankResult !== null) return blankResult;

    // Handle IS_WITHIN special case
    if (op === NocoSDK.WorkflowNodeComparisonOp.IS_WITHIN && subOp) {
      return this.isWithinDateRange(date1, subOp, value);
    }

    // Get comparison date
    const date2 = subOp ? this.getDateFromSubOp(subOp, value) : new Date(value);

    switch (op) {
      case NocoSDK.WorkflowNodeComparisonOp.EQ:
        return this.isSameDay(date1, date2);
      case NocoSDK.WorkflowNodeComparisonOp.NEQ:
        return !this.isSameDay(date1, date2);
      case NocoSDK.WorkflowNodeComparisonOp.GT:
        return date1 > date2;
      case NocoSDK.WorkflowNodeComparisonOp.LT:
        return date1 < date2;
      case NocoSDK.WorkflowNodeComparisonOp.GTE:
        return date1 >= date2;
      case NocoSDK.WorkflowNodeComparisonOp.LTE:
        return date1 <= date2;
      default:
        throw new Error(`Unsupported date operation: ${op}`);
    }
  }

  private evaluateBooleanCondition(fieldValue: any, op: NocoSDK.WorkflowNodeComparisonOp): boolean {
    const boolValue = Boolean(fieldValue);

    switch (op) {
      case NocoSDK.WorkflowNodeComparisonOp.CHECKED:
      case NocoSDK.WorkflowNodeComparisonOp.EQ:
        return boolValue;
      case NocoSDK.WorkflowNodeComparisonOp.NOT_CHECKED:
      case NocoSDK.WorkflowNodeComparisonOp.NEQ:
        return !boolValue;
      default:
        throw new Error(`Unsupported boolean operation: ${op}`);
    }
  }

  private evaluateSelectCondition(fieldValue: any, op: NocoSDK.WorkflowNodeComparisonOp, value?: any): boolean {
    const values = Array.isArray(fieldValue) ? fieldValue : [fieldValue];
    const compareValues = Array.isArray(value)
      ? value
      : value ? String(value).split(',').map((v: string) => v.trim()) : [];

    // Check common operations
    const blankResult = this.checkBlankOp(fieldValue, op, (val) => {
      const arr = Array.isArray(val) ? val : [val];
      return arr.length === 0 || !arr[0];
    });
    if (blankResult !== null) return blankResult;

    switch (op) {
      case NocoSDK.WorkflowNodeComparisonOp.EQ:
        return values.length === 1 && values[0] === compareValues[0];
      case NocoSDK.WorkflowNodeComparisonOp.NEQ:
        return values.length !== 1 || values[0] !== compareValues[0];
      case NocoSDK.WorkflowNodeComparisonOp.ALL_OF:
        return compareValues.every((v: any) => values.includes(v));
      case NocoSDK.WorkflowNodeComparisonOp.ANY_OF:
        return compareValues.some((v: any) => values.includes(v));
      case NocoSDK.WorkflowNodeComparisonOp.NOT_ALL_OF:
        return !compareValues.every((v: any) => values.includes(v));
      case NocoSDK.WorkflowNodeComparisonOp.NOT_ANY_OF:
        return !compareValues.some((v: any) => values.includes(v));
      default:
        throw new Error(`Unsupported select operation: ${op}`);
    }
  }

  private evaluateJsonCondition(fieldValue: any, op: NocoSDK.WorkflowNodeComparisonOp, value?: any): boolean {
    try {
      const json1 = typeof fieldValue === 'string' ? JSON.parse(fieldValue) : fieldValue;
      const json2 = typeof value === 'string' ? JSON.parse(value) : value;

      // Check common operations
      const nullResult = this.checkNullOp(fieldValue, op);
      if (nullResult !== null) return nullResult;

      const blankResult = this.checkBlankOp(fieldValue, op, (val) =>
        typeof val === 'object' && Object.keys(val).length === 0
      );
      if (blankResult !== null) return blankResult;

      switch (op) {
        case NocoSDK.WorkflowNodeComparisonOp.EQ:
          return JSON.stringify(json1) === JSON.stringify(json2);
        case NocoSDK.WorkflowNodeComparisonOp.NEQ:
          return JSON.stringify(json1) !== JSON.stringify(json2);
        default:
          throw new Error(`Unsupported JSON operation: ${op}`);
      }
    } catch {
      return false;
    }
  }

  // Date helper methods
  private getToday(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  private addDays(date: Date, days: number): Date {
    return new Date(date.getTime() + days * IfNode.MS_PER_DAY);
  }

  private addMonths(date: Date, months: number): Date {
    return new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
  }

  private getDateFromSubOp(subOp: NocoSDK.WorkflowNodeComparisonSubOp, value?: any): Date {
    const today = this.getToday();

    switch (subOp) {
      case NocoSDK.WorkflowNodeComparisonSubOp.TODAY:
        return today;
      case NocoSDK.WorkflowNodeComparisonSubOp.TOMORROW:
        return this.addDays(today, 1);
      case NocoSDK.WorkflowNodeComparisonSubOp.YESTERDAY:
        return this.addDays(today, -1);
      case NocoSDK.WorkflowNodeComparisonSubOp.ONE_WEEK_AGO:
        return this.addDays(today, -7);
      case NocoSDK.WorkflowNodeComparisonSubOp.ONE_WEEK_FROM_NOW:
        return this.addDays(today, 7);
      case NocoSDK.WorkflowNodeComparisonSubOp.ONE_MONTH_AGO:
        return this.addMonths(today, -1);
      case NocoSDK.WorkflowNodeComparisonSubOp.ONE_MONTH_FROM_NOW:
        return this.addMonths(today, 1);
      case NocoSDK.WorkflowNodeComparisonSubOp.DAYS_AGO:
        return this.addDays(today, -parseInt(value || '0'));
      case NocoSDK.WorkflowNodeComparisonSubOp.DAYS_FROM_NOW:
        return this.addDays(today, parseInt(value || '0'));
      case NocoSDK.WorkflowNodeComparisonSubOp.EXACT_DATE:
        return new Date(value);
      default:
        return today;
    }
  }

  private isWithinDateRange(date: Date, subOp: NocoSDK.WorkflowNodeComparisonSubOp, value?: any): boolean {
    const now = new Date();
    const time = date.getTime();

    switch (subOp) {
      case NocoSDK.WorkflowNodeComparisonSubOp.PAST_WEEK: {
        const weekAgo = this.addDays(now, -7);
        return time >= weekAgo.getTime() && time <= now.getTime();
      }
      case NocoSDK.WorkflowNodeComparisonSubOp.PAST_MONTH: {
        const monthAgo = this.addMonths(now, -1);
        return time >= monthAgo.getTime() && time <= now.getTime();
      }
      case NocoSDK.WorkflowNodeComparisonSubOp.PAST_YEAR: {
        const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        return time >= yearAgo.getTime() && time <= now.getTime();
      }
      case NocoSDK.WorkflowNodeComparisonSubOp.NEXT_WEEK: {
        const weekFromNow = this.addDays(now, 7);
        return time >= now.getTime() && time <= weekFromNow.getTime();
      }
      case NocoSDK.WorkflowNodeComparisonSubOp.NEXT_MONTH: {
        const monthFromNow = this.addMonths(now, 1);
        return time >= now.getTime() && time <= monthFromNow.getTime();
      }
      case NocoSDK.WorkflowNodeComparisonSubOp.NEXT_YEAR: {
        const yearFromNow = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
        return time >= now.getTime() && time <= yearFromNow.getTime();
      }
      case NocoSDK.WorkflowNodeComparisonSubOp.PAST_NUMBER_OF_DAYS: {
        const daysAgo = this.addDays(now, -parseInt(value || '0'));
        return time >= daysAgo.getTime() && time <= now.getTime();
      }
      case NocoSDK.WorkflowNodeComparisonSubOp.NEXT_NUMBER_OF_DAYS: {
        const daysFromNow = this.addDays(now, parseInt(value || '0'));
        return time >= now.getTime() && time <= daysFromNow.getTime();
      }
      default:
        return false;
    }
  }

  private isSameDay(date1: Date, date2: Date): boolean {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  }
}
