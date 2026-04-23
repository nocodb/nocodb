import UITypes from './UITypes';

export interface Validation {
  type:
    | GenericValidationType
    | StringValidationType
    | NumberValidationType
    | DateValidationType
    | TimeValidationType
    | YearValidationType
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
  Regex = 'regex',
  Email = 'email',
  BusinessEmail = 'businessEmail',
  PhoneNumber = 'phoneNumber',
  Url = 'url',
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

export enum YearValidationType {
  MinYear = 'minYear',
  MaxYear = 'maxYear',
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

export const oppositeValidationTypeMap = {
  [StringValidationType.MaxLength]: StringValidationType.MinLength,
  [StringValidationType.NotIncludes]: StringValidationType.Includes,
  [NumberValidationType.Max]: NumberValidationType.Min,
  [YearValidationType.MaxYear]: YearValidationType.MinYear,
  [DateValidationType.MaxDate]: DateValidationType.MinDate,
  [TimeValidationType.MaxTime]: TimeValidationType.MinTime,
  [SelectValidationType.MaxSelected]: SelectValidationType.MinSelected,
};

export const hideExtraFieldsMetaKey = 'hideExtraFields';

/**
 * Maximum number of form fields that can share a single horizontal row in a
 * form view grid layout. Used by both the backend validator and the frontend
 * drag-drop editor to enforce the cap.
 */
export const FORM_ROW_MAX_FIELDS = 5;

/**
 * UI types that always occupy their own full-width row in the form view —
 * multi-line / large inputs are too wide to share a row with other fields.
 */
export const FORM_ROW_FULL_WIDTH_UI_TYPES: readonly UITypes[] = [
  UITypes.LongText,
  UITypes.Attachment,
  UITypes.JSON,
];

/**
 * Group an ordered list of form columns into horizontal rows based on `row_id`.
 *
 * Rules:
 * - Columns with the same non-null `row_id` are grouped into one row.
 * - Columns with a null/undefined `row_id` occupy their own single-field row.
 * - Columns whose uidt is in {@link FORM_ROW_FULL_WIDTH_UI_TYPES} are always
 *   promoted to their own row, regardless of `row_id`.
 * - Row order is determined by the position of the row's first column in the
 *   input list (which the caller is expected to sort by `order` first).
 *
 * The input must already be sorted by `order` — grouping preserves that order
 * both across rows and within each row.
 */
export function groupFormColumnsByRow<
  T extends {
    id?: string;
    row_id?: string | null;
    uidt?: UITypes | string;
  },
>(columns: T[]): T[][] {
  // Walk the list in order and maintain the "currently open" row — a new
  // row opens whenever row_id changes or we hit a full-width field (which
  // must be alone). Contiguous same-row_id runs group into one row;
  // non-contiguous runs create separate rows so visual order is preserved.
  const rows: T[][] = [];
  let currentRow: T[] | null = null;
  let currentRowId: string | null = null;

  for (const col of columns) {
    const rowId = col.row_id ?? null;
    const isFullWidth =
      col.uidt != null &&
      (FORM_ROW_FULL_WIDTH_UI_TYPES as readonly string[]).includes(
        col.uidt as string,
      );

    if (isFullWidth || rowId == null) {
      rows.push([col]);
      currentRow = null;
      currentRowId = null;
      continue;
    }

    if (currentRow && currentRowId === rowId) {
      currentRow.push(col);
    } else {
      currentRow = [col];
      currentRowId = rowId;
      rows.push(currentRow);
    }
  }

  return rows;
}
