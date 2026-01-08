/**
 * Type definitions for dedupe extension
 */

export interface DedupeConfig {
  selectedTableId?: string
  selectedViewId?: string
  selectedFieldId?: string
  // Todo: support multiple fields
  selectedFieldIds: string[]
}

export interface DuplicateSet {
  key: string
  fieldValues: Record<string, any> // fieldId -> value mapping for this duplicate group
  recordCount: number // number of duplicate records in this group
  records?: Record<string, any>[] // loaded records (only when viewing this set)
}

export interface SelectedField {
  sourceRecordId: string
  value: any
}
export interface MergeState {
  primaryRecordIndex: number | null
  excludedRecordIndexes: Set<number>
  selectedFields: Record<string, number> // fieldId -> record index mapping
  activeRecordIndex: number | null
}
