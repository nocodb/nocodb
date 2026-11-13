import { UITypes, isKanbanJunctionLink, isKanbanStackableColumn } from 'nocodb-sdk'
import type { ColumnType, KanbanStackTypeOptions, TableType } from 'nocodb-sdk'

/** Table meta carries its workspace id at runtime; the generated `TableType` omits it. */
export type TableWithWorkspace = TableType & { fk_workspace_id?: string }

/** Stacking-field picker values that create a field instead of picking one. */
export const KANBAN_NEW_SINGLE_SELECT_FIELD = '__nc_kanban_new_single_select__'

export const KANBAN_NEW_USER_FIELD = '__nc_kanban_new_user__'

export type KanbanNewStackFieldValue = typeof KANBAN_NEW_SINGLE_SELECT_FIELD | typeof KANBAN_NEW_USER_FIELD

export function isKanbanNewStackFieldValue(value: unknown): value is KanbanNewStackFieldValue {
  return value === KANBAN_NEW_SINGLE_SELECT_FIELD || value === KANBAN_NEW_USER_FIELD
}

/** Columns a kanban can stack by, in table order, system columns left out. */
export function getKanbanStackableColumns(columns?: ColumnType[], options?: KanbanStackTypeOptions) {
  return (columns ?? []).filter((c) => !c.system && isKanbanStackableColumn(c, options))
}

/** Many-to-one links that can't stack this board (not on Postgres): listed disabled so they aren't silently missing. */
export function getKanbanUnsupportedLinkColumns(columns?: ColumnType[], { junctionLinks = false }: KanbanStackTypeOptions = {}) {
  if (junctionLinks) return []
  return (columns ?? []).filter((c) => !c.system && isKanbanJunctionLink(c))
}

export function useKanbanStackField() {
  const { $api, $e } = useNuxtApp()

  const { getMeta } = useMetas()

  const { internalGet, internalPost } = useInternalBatch()

  const { isUIAllowed } = useRoles()

  const { t } = useI18n()

  const isCreatingStackField = ref(false)

  const canCreateStackField = computed(() => isUIAllowed('fieldAdd'))

  const newStackFieldOptions = computed(() =>
    canCreateStackField.value
      ? [
          {
            value: KANBAN_NEW_SINGLE_SELECT_FIELD,
            label: t('activity.kanban.createSingleSelectField'),
            uidt: UITypes.SingleSelect,
          },
          { value: KANBAN_NEW_USER_FIELD, label: t('activity.kanban.createUserField'), uidt: UITypes.User },
        ]
      : [],
  )

  /** Default name for a new stacking field: Status / Assignee, numbered when taken. */
  function suggestStackFieldTitle(table: TableType | undefined, kind: KanbanNewStackFieldValue) {
    const baseTitle = kind === KANBAN_NEW_SINGLE_SELECT_FIELD ? t('general.status') : t('labels.assigneeField')

    const taken = new Set((table?.columns ?? []).map((c) => c.title?.toLowerCase()))
    let title = baseTitle
    for (let n = 2; taken.has(title.toLowerCase()); n++) title = `${baseTitle} ${n}`
    return title
  }

  /** Adds a single select (with starter options) or single-user field; returns it. */
  async function createStackField(
    table: TableWithWorkspace | undefined,
    kind: KanbanNewStackFieldValue,
    options: { title?: string; notify?: boolean } = {},
  ) {
    if (!table?.id || !table.base_id || !table.fk_workspace_id || isCreatingStackField.value) return

    const isSelect = kind === KANBAN_NEW_SINGLE_SELECT_FIELD
    const title = options.title?.trim() || suggestStackFieldTitle(table, kind)

    const payload = isSelect
      ? {
          title,
          column_name: title,
          uidt: UITypes.SingleSelect,
          colOptions: {
            options: [
              t('activity.kanban.defaultStackToDo'),
              t('activity.kanban.defaultStackInProgress'),
              t('activity.kanban.defaultStackDone'),
            ].map((option, index) => ({ title: option, color: enumColor.light[index], order: index + 1 })),
          },
        }
      : { title, column_name: title, uidt: UITypes.User, meta: { is_multi: false, notify: !!options.notify } }

    isCreatingStackField.value = true
    try {
      const res = await $api.internal.postOperation(
        table.fk_workspace_id,
        table.base_id,
        { operation: 'columnAdd', tableId: table.id },
        payload,
      )
      await getMeta({ baseId: table.base_id, tableIdOrTitle: table.id, force: true })

      $e('a:kanban:stack-field:create', { type: isSelect ? UITypes.SingleSelect : UITypes.User })

      return ((res?.columns ?? []) as ColumnType[]).find((c) => c.title === title)
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    } finally {
      isCreatingStackField.value = false
    }
  }

  /** Shows a just-created stacking field on the view's cards; new fields start hidden in existing views. */
  async function showStackFieldInView(table: TableWithWorkspace | undefined, viewId: string | undefined, columnId: string) {
    if (!table?.base_id || !table.fk_workspace_id || !viewId) return

    try {
      const { list } = await internalGet<{ list: { id: string; fk_column_id: string; show?: boolean }[] }>(
        table.fk_workspace_id,
        table.base_id,
        { operation: 'viewColumnList', viewId },
      )
      const viewColumn = list?.find((c) => c.fk_column_id === columnId)
      if (!viewColumn?.id || viewColumn.show) return

      await internalPost(
        table.fk_workspace_id,
        table.base_id,
        { operation: 'viewColumnUpdate', viewId, columnId: viewColumn.id },
        { show: true },
      )
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }

  return {
    canCreateStackField,
    newStackFieldOptions,
    isCreatingStackField,
    suggestStackFieldTitle,
    createStackField,
    showStackFieldInView,
  }
}
