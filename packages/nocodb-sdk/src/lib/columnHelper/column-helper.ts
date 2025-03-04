import { ncIsString } from '../is';
import UITypes from '../UITypes';
import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from './column.interface';
import {
  AttachmentHelper,
  BarcodeHelper,
  ButtonHelper,
  CheckboxHelper,
  CreatedTimeHelper,
  CurrencyHelper,
  DateHelper,
  DateTimeHelper,
  DecimalHelper,
  DefaultColumnHelper,
  DurationHelper,
  EmailHelper,
  FormulaHelper,
  GeoDataHelper,
  JsonHelper,
  LastModifiedTimeHelper,
  LinksHelper,
  LongTextHelper,
  LookupHelper,
  LTARHelper,
  MultiSelectHelper,
  NumberHelper,
  PercentHelper,
  PhoneNumberHelper,
  QrCodeHelper,
  RatingHelper,
  RollupHelper,
  SingleLineTextHelper,
  TimeHelper,
  UrlHelper,
  UserHelper,
  YearHelper,
} from './columns';
import { SingleSelectHelper } from './columns/SingleSelect';

export class ColumnHelperClass {
  defautlHelper = 'defautlHelper';

  private registry: Record<string, new () => AbstractColumnHelper> = {
    [this.defautlHelper]: DefaultColumnHelper,
    [UITypes.SingleLineText]: SingleLineTextHelper,
    [UITypes.LongText]: LongTextHelper,
    [UITypes.Number]: NumberHelper,
    [UITypes.Decimal]: DecimalHelper,
    [UITypes.Currency]: CurrencyHelper,
    [UITypes.Duration]: DurationHelper,
    [UITypes.Percent]: PercentHelper,
    [UITypes.Checkbox]: CheckboxHelper,
    [UITypes.Rating]: RatingHelper,
    [UITypes.PhoneNumber]: PhoneNumberHelper,
    [UITypes.Email]: EmailHelper,
    [UITypes.URL]: UrlHelper,
    [UITypes.JSON]: JsonHelper,
    [UITypes.GeoData]: GeoDataHelper,
    [UITypes.Barcode]: BarcodeHelper,
    [UITypes.QrCode]: QrCodeHelper,
    [UITypes.Formula]: FormulaHelper,
    [UITypes.Date]: DateHelper,
    [UITypes.DateTime]: DateTimeHelper,
    [UITypes.Time]: TimeHelper,
    [UITypes.Year]: YearHelper,
    [UITypes.CreatedTime]: CreatedTimeHelper,
    [UITypes.LastModifiedTime]: LastModifiedTimeHelper,
    [UITypes.SingleSelect]: SingleSelectHelper,
    [UITypes.MultiSelect]: MultiSelectHelper,
    [UITypes.User]: UserHelper,
    [UITypes.Attachment]: AttachmentHelper,
    [UITypes.CreatedBy]: UserHelper,
    [UITypes.LastModifiedBy]: UserHelper,
    [UITypes.Lookup]: LookupHelper,
    [UITypes.Rollup]: RollupHelper,
    [UITypes.Links]: LinksHelper,
    [UITypes.LinkToAnotherRecord]: LTARHelper,
    [UITypes.Button]: ButtonHelper,
  };

  // Method to retrieve the specific column class and instantiate it
  getColumn(
    params: SerializerOrParserFnProps['params'] | UITypes
  ): AbstractColumnHelper | undefined {
    let ColumnClass: new () => AbstractColumnHelper;

    if (ncIsString(params)) {
      ColumnClass = this.registry[params] || this.registry[this.defautlHelper];
    } else {
      if (!params.col || !this.registry[params.col.uidt]) {
        ColumnClass = this.registry[this.defautlHelper];
      } else {
        ColumnClass = this.registry[params.col.uidt];
      }
    }

    // Instantiate the class with the column data
    return new ColumnClass();
  }

  getColumnDefaultMeta(uidt: UITypes): Record<string, any> {
    const columnInstance = this.getColumn(uidt);
    if (columnInstance) {
      return columnInstance.columnDefaultMeta || {};
    }

    return {};
  }

  /**
   * Parses a stored value back into its original form.
   * Converts a database-stored value into a display-friendly format.
   *
   * @example
   * // Example: Formatting percentage values
   * dbValue = 59; // Stored in DB
   * displayValue = "59%"; // Displayed to users
   *
   * @param value - The value to be parsed from storage format.
   * @param params - Additional parameters related to column parsing.
   * @returns The parsed value in a display-friendly format.
   */
  parseValue(value: any, params: SerializerOrParserFnProps['params']) {
    const columnInstance = this.getColumn(params);
    if (columnInstance) {
      return columnInstance.parseValue(value, params);
    }
  }

  /**
   * Serializes the given value based on column parameters.
   *
   * **WARNING:** This method **can throw errors**. Use a `try-catch` block when calling it.
   *
   * @param value - The value to be serialized.
   * @param params - Additional parameters related to column serialization.
   * @returns The serialized value.
   * @throws {Error} If serialization fails.
   */
  serializeValue(value: any, params: SerializerOrParserFnProps['params']) {
    const columnInstance = this.getColumn(params);
    if (columnInstance) {
      return columnInstance.serializeValue(value, params);
    }
  }
}

export const ColumnHelper = new ColumnHelperClass();
