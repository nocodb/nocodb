import { Injectable } from '@nestjs/common';

// Define essential types locally since SDK has import issues
export enum UITypes {
  SingleLineText = 'SingleLineText',
  LongText = 'LongText',
  Number = 'Number',
  Decimal = 'Decimal',
  Currency = 'Currency',
  Percent = 'Percent',
  Date = 'Date',
  DateTime = 'DateTime',
  SingleSelect = 'SingleSelect',
  MultiSelect = 'MultiSelect',
  User = 'User',
  CreatedBy = 'CreatedBy',
  LastModifiedBy = 'LastModifiedBy',
  Collaborator = 'Collaborator',
  Email = 'Email',
  PhoneNumber = 'PhoneNumber',
  URL = 'URL',
  GeoData = 'GeoData',
  JSON = 'JSON',
  Rating = 'Rating',
  Duration = 'Duration',
  Year = 'Year',
  Time = 'Time',
  CreatedTime = 'CreatedTime',
  LastModifiedTime = 'LastModifiedTime',
  Checkbox = 'Checkbox',
  Attachment = 'Attachment',
  LinkToAnotherRecord = 'LinkToAnotherRecord',
  Links = 'Links',
  Lookup = 'Lookup',
  Rollup = 'Rollup',
  QrCode = 'QrCode',
  Barcode = 'Barcode',
  Button = 'Button',
  Formula = 'Formula',
  Geometry = 'Geometry',
}

// Define FilterType interface locally
export interface FilterType {
  id?: string;
  fk_column_id?: string;
  comparison_op?: string;
  comparison_sub_op?: string;
  value?: any;
  logical_op?: string;
  is_group?: boolean;
  children?: FilterType[];
}

export interface FilterTransformationResult {
  shouldRemove: boolean;
  transformedFilter?: FilterType;
  reason?: string;
}

@Injectable()
export class FilterOperatorRegistryService {
  /**
   * Check if an operator is compatible with a column type
   * This method uses a simplified compatibility matrix focused on filter transformation needs
   */
  isOperatorCompatible(operator: string, columnType: UITypes): boolean {
    // Define a focused compatibility matrix for filter transformation
    const compatibilityMatrix: Record<string, UITypes[]> = {
      // Equality operators - work with most types
      eq: [UITypes.SingleLineText, UITypes.LongText, UITypes.Number, UITypes.Decimal, UITypes.Currency, UITypes.Percent, UITypes.Date, UITypes.DateTime, UITypes.SingleSelect, UITypes.MultiSelect, UITypes.User, UITypes.CreatedBy, UITypes.LastModifiedBy, UITypes.Collaborator, UITypes.Email, UITypes.PhoneNumber, UITypes.URL, UITypes.GeoData, UITypes.JSON, UITypes.Rating, UITypes.Duration, UITypes.Year, UITypes.Time, UITypes.CreatedTime, UITypes.LastModifiedTime, UITypes.Checkbox, UITypes.Attachment, UITypes.LinkToAnotherRecord, UITypes.Links, UITypes.Lookup, UITypes.Rollup],
      neq: [UITypes.SingleLineText, UITypes.LongText, UITypes.Number, UITypes.Decimal, UITypes.Currency, UITypes.Percent, UITypes.Date, UITypes.DateTime, UITypes.SingleSelect, UITypes.MultiSelect, UITypes.User, UITypes.CreatedBy, UITypes.LastModifiedBy, UITypes.Collaborator, UITypes.Email, UITypes.PhoneNumber, UITypes.URL, UITypes.GeoData, UITypes.JSON, UITypes.Rating, UITypes.Duration, UITypes.Year, UITypes.Time, UITypes.CreatedTime, UITypes.LastModifiedTime, UITypes.Checkbox, UITypes.Attachment, UITypes.LinkToAnotherRecord, UITypes.Links, UITypes.Lookup, UITypes.Rollup],
      
      // Text search operators - only for text-like types
      like: [UITypes.SingleLineText, UITypes.LongText, UITypes.Email, UITypes.PhoneNumber, UITypes.URL, UITypes.GeoData, UITypes.JSON],
      nlike: [UITypes.SingleLineText, UITypes.LongText, UITypes.Email, UITypes.PhoneNumber, UITypes.URL, UITypes.GeoData, UITypes.JSON],
      
      // Numeric comparison operators - only for numeric and date types
      gt: [UITypes.Number, UITypes.Decimal, UITypes.Currency, UITypes.Percent, UITypes.Date, UITypes.DateTime, UITypes.Time, UITypes.Year, UITypes.Duration, UITypes.Rating, UITypes.CreatedTime, UITypes.LastModifiedTime],
      gte: [UITypes.Number, UITypes.Decimal, UITypes.Currency, UITypes.Percent, UITypes.Date, UITypes.DateTime, UITypes.Time, UITypes.Year, UITypes.Duration, UITypes.Rating, UITypes.CreatedTime, UITypes.LastModifiedTime],
      lt: [UITypes.Number, UITypes.Decimal, UITypes.Currency, UITypes.Percent, UITypes.Date, UITypes.DateTime, UITypes.Time, UITypes.Year, UITypes.Duration, UITypes.Rating, UITypes.CreatedTime, UITypes.LastModifiedTime],
      lte: [UITypes.Number, UITypes.Decimal, UITypes.Currency, UITypes.Percent, UITypes.Date, UITypes.DateTime, UITypes.Time, UITypes.Year, UITypes.Duration, UITypes.Rating, UITypes.CreatedTime, UITypes.LastModifiedTime],
      
      // Multi-select operators
      anyof: [UITypes.SingleSelect, UITypes.MultiSelect, UITypes.User, UITypes.CreatedBy, UITypes.LastModifiedBy],
      nanyof: [UITypes.SingleSelect, UITypes.MultiSelect, UITypes.User, UITypes.CreatedBy, UITypes.LastModifiedBy],
      allof: [UITypes.MultiSelect, UITypes.User, UITypes.CreatedBy, UITypes.LastModifiedBy],
      nallof: [UITypes.MultiSelect, UITypes.User, UITypes.CreatedBy, UITypes.LastModifiedBy],
      
      // Checkbox operators
      checked: [UITypes.Checkbox],
      notchecked: [UITypes.Checkbox],
      
      // Null/empty operators - work with most types
      empty: [UITypes.SingleLineText, UITypes.LongText, UITypes.Email, UITypes.PhoneNumber, UITypes.URL, UITypes.GeoData, UITypes.JSON],
      notempty: [UITypes.SingleLineText, UITypes.LongText, UITypes.Email, UITypes.PhoneNumber, UITypes.URL, UITypes.GeoData, UITypes.JSON],
      null: [UITypes.SingleLineText, UITypes.LongText, UITypes.Email, UITypes.PhoneNumber, UITypes.URL, UITypes.GeoData, UITypes.JSON, UITypes.Attachment, UITypes.LinkToAnotherRecord, UITypes.Links, UITypes.Lookup, UITypes.Rollup, UITypes.Date, UITypes.DateTime, UITypes.Time, UITypes.Collaborator],
      notnull: [UITypes.SingleLineText, UITypes.LongText, UITypes.Email, UITypes.PhoneNumber, UITypes.URL, UITypes.GeoData, UITypes.JSON, UITypes.Attachment, UITypes.LinkToAnotherRecord, UITypes.Links, UITypes.Lookup, UITypes.Rollup, UITypes.Date, UITypes.DateTime, UITypes.Time, UITypes.Collaborator],
      
      // Blank operators - work with most types
      blank: [UITypes.SingleLineText, UITypes.LongText, UITypes.Number, UITypes.Decimal, UITypes.Currency, UITypes.Percent, UITypes.Date, UITypes.DateTime, UITypes.Time, UITypes.Year, UITypes.PhoneNumber, UITypes.Email, UITypes.URL, UITypes.GeoData, UITypes.JSON, UITypes.Rating, UITypes.Duration, UITypes.SingleSelect, UITypes.MultiSelect, UITypes.User, UITypes.CreatedBy, UITypes.LastModifiedBy, UITypes.Collaborator, UITypes.Attachment, UITypes.LinkToAnotherRecord, UITypes.Links, UITypes.Lookup, UITypes.Rollup, UITypes.QrCode, UITypes.Barcode, UITypes.Button, UITypes.Formula, UITypes.Geometry],
      notblank: [UITypes.SingleLineText, UITypes.LongText, UITypes.Number, UITypes.Decimal, UITypes.Currency, UITypes.Percent, UITypes.Date, UITypes.DateTime, UITypes.Time, UITypes.Year, UITypes.PhoneNumber, UITypes.Email, UITypes.URL, UITypes.GeoData, UITypes.JSON, UITypes.Rating, UITypes.Duration, UITypes.SingleSelect, UITypes.MultiSelect, UITypes.User, UITypes.CreatedBy, UITypes.LastModifiedBy, UITypes.Collaborator, UITypes.Attachment, UITypes.LinkToAnotherRecord, UITypes.Links, UITypes.Lookup, UITypes.Rollup, UITypes.QrCode, UITypes.Barcode, UITypes.Button, UITypes.Formula, UITypes.Geometry],
      
      // Date-specific operators
      isWithin: [UITypes.Date, UITypes.DateTime, UITypes.CreatedTime, UITypes.LastModifiedTime]
    };

    const allowedTypes = compatibilityMatrix[operator];
    return allowedTypes ? allowedTypes.includes(columnType) : false;
  }

  /**
   * Get operator compatibility between two column types
   */
  getOperatorCompatibilityBetweenTypes(fromType: UITypes, toType: UITypes) {
    // Get all operators that are compatible with both types
    const allOperators = ['eq', 'neq', 'like', 'nlike', 'gt', 'gte', 'lt', 'lte', 'anyof', 'nanyof', 'allof', 'nallof', 'checked', 'notchecked', 'empty', 'notempty', 'null', 'notnull', 'blank', 'notblank', 'isWithin'];
    
    return allOperators.filter(operator => 
      this.isOperatorCompatible(operator, fromType) && this.isOperatorCompatible(operator, toType)
    ).map(operator => ({
      value: operator,
      text: this.getOperatorDescription(operator)
    }));
  }

  /**
   * Get all operators that are compatible with a specific column type
   */
  getCompatibleOperators(columnType: UITypes): string[] {
    const allOperators = ['eq', 'neq', 'like', 'nlike', 'gt', 'gte', 'lt', 'lte', 'anyof', 'nanyof', 'allof', 'nallof', 'checked', 'notchecked', 'empty', 'notempty', 'null', 'notnull', 'blank', 'notblank', 'isWithin'];
    
    return allOperators.filter(operator => this.isOperatorCompatible(operator, columnType));
  }

  /**
   * Get operator compatibility information for a specific operator
   */
  getOperatorCompatibility(operator: string) {
    const description = this.getOperatorDescription(operator);
    return { value: operator, text: description };
  }

  /**
   * Validate if a filter is compatible with a column type change
   */
  validateFilterCompatibility(
    filter: FilterType,
    fromType: UITypes,
    toType: UITypes,
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
    return ['eq', 'neq', 'like', 'nlike', 'gt', 'gte', 'lt', 'lte', 'anyof', 'nanyof', 'allof', 'nallof', 'checked', 'notchecked', 'empty', 'notempty', 'null', 'notnull', 'blank', 'notblank', 'isWithin'];
  }

  /**
   * Get operator descriptions
   */
  getOperatorDescriptions(): Record<string, string> {
    const descriptions: Record<string, string> = {};
    const allOperators = this.getAllOperators();
    
    for (const operator of allOperators) {
      descriptions[operator] = this.getOperatorDescription(operator);
    }
    
    return descriptions;
  }

  /**
   * Get operator description
   */
  private getOperatorDescription(operator: string): string {
    const descriptions: Record<string, string> = {
      eq: 'Equals',
      neq: 'Not equals',
      like: 'Contains',
      nlike: 'Does not contain',
      gt: 'Greater than',
      gte: 'Greater than or equal',
      lt: 'Less than',
      lte: 'Less than or equal',
      anyof: 'Contains any of',
      nanyof: 'Does not contain any of',
      allof: 'Contains all of',
      nallof: 'Does not contain all of',
      checked: 'Is checked',
      notchecked: 'Is not checked',
      empty: 'Is empty',
      notempty: 'Is not empty',
      null: 'Is null',
      notnull: 'Is not null',
      blank: 'Is blank',
      notblank: 'Is not blank',
      isWithin: 'Is within time period',
    };
    return descriptions[operator] || operator;
  }
}
