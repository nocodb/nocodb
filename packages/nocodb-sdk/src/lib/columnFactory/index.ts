import { ColumnType } from '../Api';
import UITypes from '../UITypes';
import { DurationColumn } from './columns/Duration';
import { NumberColumn } from './columns/Number';
import { SingleLineTextColumn } from './columns/SingleLineText';

export abstract class AbstractColumn {
  static columnDefaultMeta?: Record<string, any> = {};
  abstract serializeValue(value: unknown, column: ColumnType): any;
  abstract parseValue(value: unknown, column: ColumnType): any;
  abstract parsePlainCellValue(value: unknown, column: ColumnType): string;
}

export class ColumnFactory {
  private registry: Record<string, new () => AbstractColumn> = {
    [UITypes.SingleLineText]: SingleLineTextColumn,
    [UITypes.Number]: NumberColumn,
    [UITypes.Duration]: DurationColumn,
  };

  // Method to retrieve the specific column class and instantiate it
  getColumn(column: ColumnType): AbstractColumn | undefined {
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
