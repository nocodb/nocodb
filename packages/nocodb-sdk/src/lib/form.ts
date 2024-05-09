export interface Validation {
  type:
    | GenericValidationType
    | StringValidationType
    | NumberValidationType
    | DateValidationType
    | SelectValidationType
    | AttachmentValidationType
    | null;
  // Additional properties depending on the type of validation
  [key: string]: any;
}

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
  Min = 'min',
  Max = 'max',
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

export interface MinLengthValidation extends Validation {
  type: StringValidationType.MinLength;
  value: number;
}

export interface MaxLengthValidation extends Validation {
  type: StringValidationType.MaxLength;
  value: number;
}

export interface StartsWithValidation extends Validation {
  type: StringValidationType.StartsWith;
  value: string;
}

export interface EndsWithValidation extends Validation {
  type: StringValidationType.EndsWith;
  value: string;
}

export interface regexValidation extends Validation {
  type: StringValidationType.Regex;
  regex: string;
  message: string;
}

export interface EmailValidation extends Validation {
  type: StringValidationType.Email;
}

export interface IncludesValidation extends Validation {
  type: StringValidationType.Includes;
  value: string;
}

export interface NotIncludesValidation extends Validation {
  type: StringValidationType.NotIncludes;
  value: string;
}

export interface RequiredValidation extends Validation {
  type: GenericValidationType.Required;
}

export interface MinValidation extends Validation {
  type: NumberValidationType.Min;
  value: number;
}

export interface MaxValidation extends Validation {
  type: NumberValidationType.Max;
  value: number;
}

export interface MinSelectedValidation extends Validation {
  type: SelectValidationType.MinSelected;
  value: number;
}

export interface MaxSelectedValidation extends Validation {
  type: SelectValidationType.MaxSelected;
  value: number;
}

export interface LimitOptionsValidation extends Validation {
  type: SelectValidationType.LimitOptions;
  options: string[];
}

export interface MinDateValidation extends Validation {
  type: DateValidationType.Min;
  value: string;
}

export interface MaxDateValidation extends Validation {
  type: DateValidationType.Max;
  value: string;
}

export interface FileTypesValidation extends Validation {
  type: AttachmentValidationType.FileTypes;
  fileTypes: string[]; // MIME types
}

export interface FileSizeValidation extends Validation {
  type: AttachmentValidationType.FileSize;
  value: number; // Store in KB (we can allow KB/MB input in UI)
}

export interface FileCountValidation extends Validation {
  type: AttachmentValidationType.FileCount;
  min?: number;
  max: number;
}

export const ValidationTypeLabel = {
  [StringValidationType.MinLength]: 'Minimum characters',
  [StringValidationType.MaxLength]: 'Maximum characters',
  [StringValidationType.StartsWith]: 'Starts with',
  [StringValidationType.EndsWith]: 'Ends with',
  [StringValidationType.Includes]: 'Contains string',
  [StringValidationType.NotIncludes]: "Doesn't Contains string",
  [StringValidationType.Regex]: 'Regular expression',
  [StringValidationType.Email]: 'Email',
};

export const inputType = {
  [StringValidationType.MinLength]: 'number',
  [StringValidationType.MaxLength]: 'number',
  [StringValidationType.StartsWith]: 'text',
  [StringValidationType.EndsWith]: 'text',
  [StringValidationType.Includes]: 'text',
  [StringValidationType.NotIncludes]: 'text',
  [StringValidationType.Regex]: 'text',
  [StringValidationType.Email]: 'email',
};
