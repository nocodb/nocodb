import { ColumnType } from '../Api';
import UITypes from '../UITypes';
import { DurationHelper } from './columns/Duration';
import { NumberHelper } from './columns/Number';
import { PercentHelper } from './columns/Percent';
import { SingleLineTextHelper } from './columns/SingleLineText';

export abstract class AbstractColumnHelper {
  static columnDefaultMeta?: Record<string, any> = {};
  abstract serializeValue(value: unknown, column: ColumnType): any;
  abstract parseValue(value: unknown, column: ColumnType): any;
  abstract parsePlainCellValue(value: unknown, column: ColumnType): string;
}

export class ColumnHelper {
  private registry: Record<string, new () => AbstractColumnHelper> = {
    [UITypes.SingleLineText]: SingleLineTextHelper,
    [UITypes.Number]: NumberHelper,
    [UITypes.Duration]: DurationHelper,
    [UITypes.Percent]: PercentHelper,
  };

  // Method to retrieve the specific column class and instantiate it
  getColumn(column: ColumnType): AbstractColumnHelper | undefined {
    if (!column) return undefined;

    const ColumnClass = this.registry[column.uidt];
    if (!ColumnClass) return undefined;

    // Instantiate the class with the column data
    return new ColumnClass();
  }

  // Method to parse a value using the correct column
  parseValue(value: unknown, column: ColumnType) {
    const columnInstance = this.getColumn(column);
    if (columnInstance) {
      return columnInstance.parseValue(value, column);
    }
    return undefined;
  }

  // Method to serialize a value using the correct column
  serializeValue(value: unknown, column: ColumnType) {
    const columnInstance = this.getColumn(column);
    if (columnInstance) {
      return columnInstance.serializeValue(column, value);
    }
    return undefined;
  }
}
