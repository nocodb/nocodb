import UITypes from '../UITypes';
import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from './column.interface';
import {
  AttachmentHelper,
  BarcodeHelper,
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
  };

  // Method to retrieve the specific column class and instantiate it
  getColumn(
    params: SerializerOrParserFnProps['params']
  ): AbstractColumnHelper | undefined {
    let ColumnClass: new () => AbstractColumnHelper;

    if (!params.col || !this.registry[params.col.uidt]) {
      ColumnClass = this.registry[this.defautlHelper];
    } else {
      ColumnClass = this.registry[params.col.uidt];
    }

    // Instantiate the class with the column data
    return new ColumnClass();
  }

  // Method to parse a value using the correct column
  parseValue(value: any, params: SerializerOrParserFnProps['params']) {
    const columnInstance = this.getColumn(params);
    if (columnInstance) {
      return columnInstance.parseValue(value, params);
    }
    return undefined;
  }

  // Method to serialize a value using the correct column
  serializeValue(value: any, params: SerializerOrParserFnProps['params']) {
    const columnInstance = this.getColumn(params);
    if (columnInstance) {
      return columnInstance.serializeValue(value, params);
    }
    return undefined;
  }
}

export const ColumnHelper = new ColumnHelperClass();
