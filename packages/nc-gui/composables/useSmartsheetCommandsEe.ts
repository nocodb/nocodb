import type { TableType, ViewType } from 'nocodb-sdk'
import type { CmdCommand } from '~/lib/types'

/** The smartsheet's EE-only Cmd+K commands (table sync, view folders). CE has none. */
export function useSmartsheetCommandsEe(_meta: Ref<TableType | undefined>, _view: Ref<ViewType | undefined>) {
  return {
    tableCommands: (_section: string): CmdCommand[] => [],
    viewCommands: (_section: string): CmdCommand[] => [],
  }
}
