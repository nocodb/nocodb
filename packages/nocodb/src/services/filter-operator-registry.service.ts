import { Injectable } from '@nestjs/common';
import { UITypes } from 'nocodb-sdk';
import type { FilterType } from 'nocodb-sdk';

export interface FilterTransformationResult {
  shouldRemove: boolean;
  transformedFilter?: FilterType;
  reason?: string;
}

@Injectable()
export class FilterOperatorRegistryService {
  /**
   * Check if an operator is compatible with a column type
   * This uses the exact same logic as filterUtils.ts from the SDK
   */
  isOperatorCompatible(operator: string, columnType: string): boolean {
    const { comparisonOpList } = require('nocodb-sdk');
    const operators = comparisonOpList(columnType);
    return operators.some((op) => op.value === operator);
  }

  /**
   * Get operator compatibility between two column types
   */
  getOperatorCompatibilityBetweenTypes(fromType: string, toType: string) {
    const { comparisonOpList } = require('nocodb-sdk');

    const fromOperators = comparisonOpList(fromType);
    const toOperators = comparisonOpList(toType);

    // Return operators that are compatible with both types
    return fromOperators.filter((fromOp) =>
      toOperators.some((toOp) => toOp.value === fromOp.value),
    );
  }

  /**
   * Get all operators that are compatible with a specific column type
   */
  getCompatibleOperators(columnType: string): string[] {
    const { comparisonOpList } = require('nocodb-sdk');

    const operators = comparisonOpList(columnType);
    return operators.map((op) => op.value);
  }

  /**
   * Get operator compatibility information for a specific operator
   */
  getOperatorCompatibility(operator: string) {
    const { comparisonOpList } = require('nocodb-sdk');

    const allOperators = comparisonOpList(UITypes.SingleLineText);
    const foundOp = allOperators.find((op) => op.value === operator);

    if (foundOp) {
      return {
        value: foundOp.value,
        text: foundOp.text,
        ignoreVal: foundOp.ignoreVal,
        includedTypes: foundOp.includedTypes,
        excludedTypes: foundOp.excludedTypes,
      };
    }

    return { value: operator, text: operator };
  }

  /**
   * Validate if a filter is compatible with a column type change
   */
  validateFilterCompatibility(
    filter: FilterType,
    fromType: string,
    toType: string,
  ): FilterTransformationResult {
    const operator = filter.comparison_op;
    if (!operator) {
      return {
        shouldRemove: true,
        reason: 'Filter has no comparison operator',
      };
    }

    // Check if operator is compatible with target type
    if (this.isOperatorCompatible(operator, toType)) {
      return { shouldRemove: false, reason: 'Filter is compatible' };
    }

    // Operator is not compatible, filter must be removed
    return {
      shouldRemove: true,
      reason: `Operator ${operator} is not compatible with column type ${toType}`,
    };
  }

  /**
   * Get all available operators
   */
  getAllOperators(): string[] {
    const { comparisonOpList } = require('nocodb-sdk');

    const allOperators = comparisonOpList(UITypes.SingleLineText);
    return allOperators.map((op) => op.value);
  }

  /**
   * Get operator descriptions
   */
  getOperatorDescriptions(): Record<string, string> {
    const { comparisonOpList } = require('nocodb-sdk');

    const allOperators = comparisonOpList(UITypes.SingleLineText);
    const descriptions: Record<string, string> = {};

    for (const op of allOperators) {
      descriptions[op.value] = op.text;
    }

    return descriptions;
  }
}
