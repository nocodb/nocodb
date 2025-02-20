import { ColumnType } from '../Api';
import UITypes from '../UITypes';
import AbstractColumnHelper from './column.interface';
import {
  CheckboxHelper,
  DecimalHelper,
  DurationHelper,
  EmailHelper,
  JsonHelper,
  LongTextHelper,
  NumberHelper,
  PercentHelper,
  PhoneNumberHelper,
  RatingHelper,
  SingleLineTextHelper,
  UrlHelper,
} from './columns';

export class ColumnHelper {
  private registry: Record<string, new () => AbstractColumnHelper> = {
    [UITypes.SingleLineText]: SingleLineTextHelper,
    [UITypes.LongText]: LongTextHelper,
    [UITypes.Number]: NumberHelper,
    [UITypes.Decimal]: DecimalHelper,
    [UITypes.Duration]: DurationHelper,
    [UITypes.Percent]: PercentHelper,
    [UITypes.Checkbox]: CheckboxHelper,
    [UITypes.Rating]: RatingHelper,
    [UITypes.PhoneNumber]: PhoneNumberHelper,
    [UITypes.Email]: EmailHelper,
    [UITypes.URL]: UrlHelper,
    [UITypes.JSON]: JsonHelper,
  };

  // Method to retrieve the specific column class and instantiate it
  getColumn(column: ColumnType): AbstractColumnHelper | undefined {
    let ColumnClass: new () => AbstractColumnHelper;

    if (!column || !this.registry[UITypes.SingleLineText]) {
      ColumnClass = this.registry[UITypes.SingleLineText];
    }

    ColumnClass = this.registry[column.uidt];

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
      return columnInstance.serializeValue(value, column);
    }
    return undefined;
  }
}
