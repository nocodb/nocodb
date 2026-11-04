import type { ColumnType } from 'nocodb-sdk'
import type { CmdCommand, Row } from '~/lib/types'
import type { CmdKanbanDeps } from '~/lib/cmdPaletteTypes'

/**
 * Cmd+K's kanban commands (stacks, moving cards, adding to a stack) are EE; CE registers none.
 * The card's own commands come from `useCardCommands`.
 */
export function useKanbanCommands(_deps: CmdKanbanDeps) {
  return {
    cardCommands: (_record: Row, _section: string): CmdCommand[] => [],
    saveField: async (_record: Row, _column: ColumnType, _value: unknown) => {},
    onStackEnter: (_stackId: string) => {},
    onStackLeave: (_stackId: string) => {},
  }
}
