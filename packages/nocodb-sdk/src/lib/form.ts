export interface Validation {
  type:
    | GenericValidationType
    | StringValidationType
    | NumberValidationType
    | DateValidationType
    | TimeValidationType
    | SelectValidationType
    | AttachmentValidationType
    | null;
  // Additional properties depending on the type of validation
  [key: string]: any;
}

export type ValidationType = Exclude<
  Validation['type'],
  null | GenericValidationType
>;

export enum GenericValidationType {
  Required = 'required',
}

export enum StringValidationType {
  MinLength = 'minLength',
  MaxLength = 'maxLength',
  StartsWith = 'startsWith',
  EndsWith = 'endsWith',
  Includes = 'includes',
  NotIncludes = 'notIncludes',
  Email = 'email',
  Regex = 'regex',
}

export enum NumberValidationType {
  Min = 'min',
  Max = 'max',
}

export enum DateValidationType {
  MinDate = 'minDate',
  MaxDate = 'maxDate',
}

export enum TimeValidationType {
  MinTime = 'minTime',
  MaxTime = 'maxTime',
}

export enum MonthValidationType {
  MinMonth = 'minMonth',
  MaxMonth = 'maxTime',
}

export enum SelectValidationType {
  MinSelected = 'minSelected',
  MaxSelected = 'maxSelected',
  LimitOptions = 'limitOptions',
}

export enum AttachmentValidationType {
  FileTypes = 'fileTypes',
  FileSize = 'fileSize',
  FileCount = 'fileCount',
}

export interface RequiredValidation extends Validation {
  type: GenericValidationType.Required;
}
