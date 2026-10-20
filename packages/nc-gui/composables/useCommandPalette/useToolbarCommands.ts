import type { ColumnType, TableType, ViewType } from 'nocodb-sdk'
import type { Field } from '~/lib/types'

/** Cmd+K: "Search in view" (Cmd+F), and "Search records in <table>" for whatever was typed. */
export function useSearchCommands(deps: {
  view: Ref<ViewType | undefined>
  isPublic: Ref<boolean>
  tableTitle: Ref<string | undefined>
  showSearch: () => void
  setQuery: (query: string) => void
}) {
  const { t } = useI18n()

  useCommandProvider(
    () => `view-toolbar:search:${deps.view.value?.id}`,
    'view',
    () => {
      if (deps.isPublic.value) return { commands: [] }

      return {
        commands: [
          {
            id: 'view:search',
            priority: CMD_PRIORITY.primary,
            title: t('labels.commandPalette.searchInView'),
            section: t('labels.commandPalette.sections.view'),
            icon: { type: 'icon', name: 'search' },
            keywords: ['find'],
            shortcut: [isMac() ? 'Meta' : 'Ctrl', 'F'],
            run: deps.showSearch,
          },
        ],
        fallbacks: (query) => [
          {
            id: 'view:search-for',
            title: t('labels.commandPalette.searchRecordsIn', { table: deps.tableTitle.value ?? '' }),
            section: t('labels.commandPalette.sections.search'),
            icon: { type: 'icon', name: 'search' },
            run: () => {
              deps.setQuery(query)
              deps.showSearch()
            },
          },
        ],
      }
    },
  )
}

// The toolbar menus' own commands (sort, group by, fields, row height) are EE; CE registers none.

export function useSortCommands(_deps: {
  view: Ref<ViewType | undefined>
  isPublic: Ref<boolean>
  isRestrictedEditor: Ref<boolean>
  availableColumns: Ref<ColumnType[]>
  addSort: (column: ColumnType, direction?: 'asc' | 'desc') => void
  open: Ref<boolean>
}) {}

export function useGroupByCommands(_deps: {
  view: Ref<ViewType | undefined>
  meta: Ref<TableType | undefined>
  isPublic: Ref<boolean>
  isRestrictedEditor: Ref<boolean>
  fieldsToGroupBy: Ref<ColumnType[]>
  groupedByColumnIds: Ref<string[]>
  groupByLimit: number
  metaColumnById: Ref<Record<string, ColumnType>>
  showSystemFields: Ref<boolean>
  open: Ref<boolean>
  groupBy: Ref<unknown[]>
  seedGroupByFromState: () => void
  saveGroupBy: () => Promise<void>
  addOrRemove: (event: SmartsheetStoreEvents, payload: { column: ColumnType }) => unknown
}) {}

export function useFieldsMenuCommands(_deps: {
  view: Ref<ViewType | undefined>
  isPublic: Ref<boolean>
  canAddField: Ref<boolean>
  isReadOnly: Ref<boolean>
  visibleFields: Ref<Field[]>
  metaColumnById: Ref<Record<string, ColumnType>>
  openAddField: () => Promise<void>
  toggleField: (field: Field) => void
  showAll: () => Promise<void>
  hideAll: () => Promise<void>
}) {}

export function useRowHeightCommands(_deps: {
  view: Ref<ViewType | undefined>
  isDisabled: Ref<boolean>
  options: { icon: string; heightClass: string }[]
  current: Ref<number | undefined>
  update: (index: number) => unknown
}) {}
