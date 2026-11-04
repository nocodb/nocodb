import type { ColumnType } from 'nocodb-sdk'

export interface CmdFormField {
  required?: boolean | number | null
  label?: string | null
  title?: string
}

// Cmd+K's form-builder commands (required, hide, show / hide all, sidebar) are EE; CE registers none.

export function useFormCommands<F extends CmdFormField>(_deps: {
  activeField: Ref<F | null | undefined>
  activeColumn: Ref<ColumnType | null | undefined>
  isEditable: boolean
  isLocked: Ref<boolean>
  isSidebarVisible: Ref<boolean>
  canHide: (field: F) => boolean
  saveField: (field: F) => unknown
  hideField: (field: F) => unknown
  setAllFields: (show: boolean) => unknown
}) {}
