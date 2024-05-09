import {
  Validation,
  StringValidationType,
  NumberValidationType,
  SelectValidationType,
  DateValidationType,
  TimeValidationType,
  YearValidationType,
  AttachmentValidationType,
} from '~/lib/form';

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

export interface RegexValidation extends Validation {
  type: StringValidationType.Regex;
  regex: string;
  message: string;
}

export interface EmailValidation extends Validation {
  type: StringValidationType.Email;
}
export interface PhoneNumberValidation extends Validation {
  type: StringValidationType.PhoneNumber;
}
export interface UrlValidation extends Validation {
  type: StringValidationType.Url;
}

export interface IncludesValidation extends Validation {
  type: StringValidationType.Includes;
  value: string;
}

export interface NotIncludesValidation extends Validation {
  type: StringValidationType.NotIncludes;
  value: string;
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
  type: DateValidationType.MinDate;
  value: string;
}

export interface MaxDateValidation extends Validation {
  type: DateValidationType.MaxDate;
  value: string;
}

export interface MinTimeValidation extends Validation {
  type: TimeValidationType.MinTime;
  value: string;
}

export interface MaxTimeValidation extends Validation {
  type: TimeValidationType.MaxTime;
  value: string;
}
export interface MinYearValidation extends Validation {
  type: YearValidationType.MinYear;
  value: number;
}

export interface MaxYearValidation extends Validation {
  type: YearValidationType.MaxYear;
  value: number;
}

export interface FileTypesValidation extends Validation {
  type: AttachmentValidationType.FileTypes;
  fileTypes: string[]; // MIME types
}

export interface FileSizeValidation extends Validation {
  type: AttachmentValidationType.FileSize;
  value: number; // Store in KB (we can allow KB/MB input in UI)
  unit: 'KB' | 'MB';
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
  [StringValidationType.NotIncludes]: "Doesn't contain string",
  [StringValidationType.Regex]: 'Regular expression',
  [StringValidationType.Email]: 'Email',
};

export const InputType = {
  [SelectValidationType.MinSelected]: 'number',
  [SelectValidationType.MaxSelected]: 'number',
  [AttachmentValidationType.FileSize]: 'number',
  [AttachmentValidationType.FileCount]: 'number',
  [StringValidationType.MinLength]: 'number',
  [StringValidationType.MaxLength]: 'number',
  [StringValidationType.StartsWith]: 'text',
  [StringValidationType.EndsWith]: 'text',
  [StringValidationType.Includes]: 'text',
  [StringValidationType.NotIncludes]: 'text',
  [StringValidationType.Regex]: 'text',
  [AttachmentValidationType.FileTypes]: 'text',
  [StringValidationType.Email]: 'email',
  [NumberValidationType.Min]: 'number',
  [NumberValidationType.Max]: 'number',
  [DateValidationType.MinDate]: 'date',
  [DateValidationType.MaxDate]: 'date',
  [TimeValidationType.MinTime]: 'time',
  [TimeValidationType.MaxTime]: 'time',
  [YearValidationType.MinYear]: 'year',
  [YearValidationType.MaxYear]: 'year',
};
