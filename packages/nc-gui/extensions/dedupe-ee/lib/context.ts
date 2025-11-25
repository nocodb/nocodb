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

export interface MergeState {
  primaryRecordId: string | null
  excludedRecordIds: Set<string>
  selectedFields: Record<string, string> // fieldId -> recordId mapping
}
