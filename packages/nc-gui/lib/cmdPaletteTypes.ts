import type { BaseType, ColumnType, TableType, ViewType, ViewTypes } from 'nocodb-sdk'
import type { ComputedRef, Ref } from 'vue'
import type { CellRange } from '../composables/useMultiSelect/cellRange'
import type { InviteLinkTarget } from '../composables/useInviteLinks'
import type { useCanvasTable } from '../components/smartsheet/grid/canvas/composables/useCanvasTable'
import type { InterfacePageDataApi } from './interfaceData'
import type { CmdCommand, Row } from './types'

/** One scope's "Invite to X" and "Copy invite link" rows. */
export interface CmdInviteScope {
  id: 'base' | 'interface' | 'workspace'
  name: string
  kind: string
  priority: number
  searchOnly?: boolean
  roles: readonly string[]
  send?: (emails: string[], role: string) => Promise<void>
  link?: InviteLinkTarget
  linkRoles?: readonly string[]
  roleLabels?: Partial<Record<string, string>>
}

/** What `useGlobalCommands` hands an edition's additions. */
export interface CmdGlobalCommandsContext {
  base: Ref<BaseType | undefined>
  sections: Ref<Record<string, string>>
  createView: (type: ViewTypes) => void
  inviteScopeCommands: (scope: CmdInviteScope) => CmdCommand[]
}

/** An edition's additions to the global and base commands; every entry is optional. */
export interface CmdGlobalCommandsExt {
  createCommands?: Ref<CmdCommand[]>
  baseCommands?: Ref<CmdCommand[]>
  globalCommands?: Ref<CmdCommand[]>
  goToCommands?: Ref<CmdCommand[]>
  settingsCommands?: Ref<CmdCommand[]>
  workspaceCommands?: Ref<CmdCommand[]>
  helpCommands?: Ref<CmdCommand[]>
  navigationCommands?: Ref<CmdCommand[]>
  /** The interface's invites (they lead) and the workspace's. */
  inviteCommands?: Ref<{ interface: CmdCommand[]; workspace: CmdCommand[] }>
  viewCreateOptions?: (option: (type: ViewTypes, extra?: Partial<CmdCommand>) => CmdCommand, sourceType?: string) => CmdCommand[]
  /** Typed answers (e.g. the calculator) that replace the name and docs fallbacks. */
  queryFallbacks?: (query: string) => CmdCommand[]
  namedCreateCommands?: (name: string, kind?: string) => CmdCommand[]
  adminPanelPath?: Ref<string | undefined>
  isAiAvailable?: Ref<boolean>
  askAi?: (query: string) => unknown
  aiFallback?: (query: string) => CmdCommand | undefined
}

type CanvasTable = ReturnType<typeof useCanvasTable>

export interface CmdGridDataCache {
  cachedRows: Ref<Map<number, Row>>
  totalRows: Ref<number>
  selectedRows: ComputedRef<Array<Row>>
}

/** What the grid canvas hands its Cmd+K commands (`useGridCommands`). */
export interface CmdGridDeps
  extends Pick<
    CanvasTable,
    | 'columns'
    | 'activeCell'
    | 'selection'
    | 'isGroupBy'
    | 'readOnly'
    | 'isSelectionReadOnly'
    | 'isSelectedOnlyAI'
    | 'isSelectedOnlyScript'
    | 'actionManager'
    | 'copyValue'
    | 'clearCell'
    | 'clearSelectedRangeOfCells'
    | 'triggerRefreshCanvas'
    | 'isViewOperationsAllowed'
    | 'isDataEditAllowed'
    | 'isPrimaryKeyAvailable'
    | 'isOrderColumnExists'
    | 'isInsertBelowDisabled'
    | 'isAddingEmptyRowAllowed'
    | 'removeInlineAddRecord'
    | 'getSelectionScope'
    | 'computeSelectionAggregation'
    | 'formatAggregationValue'
  > {
  view: Ref<ViewType | undefined>
  meta: Ref<TableType | undefined>
  isPublicView: Ref<boolean>
  isLocked: Ref<boolean>
  interfacePageDataApi?: InterfacePageDataApi
  selectedHeaderColumnIds: Ref<Set<string>>
  selectedAllRecords: Ref<boolean | undefined>
  fieldColumn: Ref<ColumnType | undefined>
  groupDataCache: Ref<Map<string, CmdGridDataCache>>
  getDataCache: (path?: Array<number>) => CmdGridDataCache
  getRows: (start: number, end: number, path?: Array<number>) => Promise<Row[]>
  bulkUpdateRows: (
    rows: Row[],
    props: string[],
    metas?: { metaValue?: TableType; viewMetaValue?: ViewType },
    path?: Array<number>,
  ) => Promise<void>
  updateOrSaveRow: (
    row: Row,
    property?: string,
    ltarState?: Record<string, unknown>,
    args?: { metaValue?: TableType; viewMetaValue?: ViewType },
    beforeRow?: string,
    path?: Array<number>,
  ) => Promise<unknown>
  deleteRow?: (rowIndex: number, path?: Array<number>, options?: { notify?: boolean }) => Promise<void>
  deleteRangeOfRows: (cellRange: CellRange, path?: Array<number>) => Promise<void>
  expandForm: (row: Row, state?: Record<string, unknown>, fromToolbar?: boolean, path?: Array<number>) => void
  addRow: (context: { row: number; col: number; path: Array<number> }, direction: 'above' | 'below') => void
  duplicateRow: (context: { row: number; col: number; path: Array<number> }, options?: { notify?: boolean }) => Promise<unknown>
  scrollToCell: (row: number, col: number, path?: Array<number>) => void
  sendRecord: (rowId: string) => void
}

/** What the grid wrapper hands its checked-rows Cmd+K commands (`useGridSelectionCommands`). */
export interface CmdGridSelectionDeps {
  view: Ref<ViewType | undefined>
  meta: Ref<TableType | undefined>
  isPublic: Ref<boolean>
  isGroupBy: Ref<boolean>
  isInfiniteScrollingEnabled: Ref<boolean>
  isCanvasGroupByTableEnabled: Ref<boolean>
  isCanvasRendering: Ref<boolean>
  totalRows: Ref<number>
  selectedAllRecords: Ref<boolean>
  selectedAllRecordsSkipPks: Ref<Record<string, string>>
  groupDataCache: Ref<Map<string, CmdGridDataCache>>
  getDataCache: (path?: Array<number>) => CmdGridDataCache
  bulkUpdateRows: (
    rows: Row[],
    props: string[],
    metas?: { metaValue?: TableType; viewMetaValue?: ViewType },
    path?: Array<number>,
  ) => Promise<void>
  deleteSelectedRows: (path?: Array<number>) => Promise<unknown>
  bulkDeleteAll: (path?: Array<number>) => Promise<unknown>
  openBulkUpdate: (path: Array<number>) => void
  /** The paginated grid (no infinite scrolling): its rows and actions. */
  pData: Ref<Row[]>
  pSelectedAllRecords: Ref<boolean>
  pBulkUpdateRows: (rows: Row[], props: string[]) => Promise<unknown>
  pDeleteSelectedRows: () => Promise<unknown>
  canvas: Ref<
    | {
        recheckRows?: (pks: Set<string>) => { found: number; checked: number }
        clearRowSelection?: () => void
        copyRows?: (rows: Row[]) => unknown
      }
    | undefined
  >
}

/** What a gallery or kanban hands its hovered card's Cmd+K commands (`useCardCommands`). */
export interface CmdCardDeps {
  key: string
  /** The card can't take commands now (unsaved, SQL view, a record form already open). */
  isBlocked: Ref<boolean>
  canExpand: Ref<boolean>
  canDelete: (record: Row) => boolean
  displayField: Ref<ColumnType | null | undefined>
  expandForm: (record: Row) => void
  deleteRow: (record: Row) => unknown
  /** Set field and typed edits on the card (EE). */
  canEdit: Ref<boolean>
  saveField: (record: Row, column: ColumnType, value: unknown) => Promise<unknown>
  sendRecord: (record: Row) => void
  extraCommands?: (record: Row, section: string) => CmdCommand[]
}

/** What the kanban board hands its stack and board Cmd+K commands (`useKanbanCommands`). */
export interface CmdKanbanDeps {
  hasEditPermission: Ref<boolean>
  canAddDeleteRows: Ref<boolean>
  loadVisibleStacks: () => Promise<unknown>
  reconcileCardMove: (move: { row: Row; fromKey: string | null; toKey: string | null }) => unknown
  collapseStack: (stackIdx: number) => Promise<unknown>
  deleteStack: (stackTitle: string, stackIdx: number) => unknown
  collapseAllStacks: () => Promise<unknown>
  expandAllStacks: () => Promise<unknown>
  openNewRecordForm: (stackTitle?: string) => unknown
  /** Opens the stack editor on a stack, or on a new one. */
  openStackEditor: (stackId: string | null) => void
}

/** Record-level rows and typed edits an edition adds to a surface's record context. */
export interface CmdRecordExtras {
  commands: CmdCommand[]
  fallbacks: (query: string) => CmdCommand[]
}
