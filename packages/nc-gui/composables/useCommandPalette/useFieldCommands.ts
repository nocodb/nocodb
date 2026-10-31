import { type ColumnType, type LinkToAnotherRecordType, RelationTypes, UITypes, isLinksOrLTAR, isSystemColumn } from 'nocodb-sdk'
import type { CmdCommand, CmdProviderState } from '~/lib/types'

/**
 * Cmd+K for a selected field header: the header menu's actions (edit, rename, description, sort, filter, group,
 * hide, duplicate, insert left / right, copy ID, delete), with the menu's own gates.
 */
export function useFieldCommands(deps: {
  column: Ref<ColumnType>
  isHiddenCol: () => boolean
  isColumnEditAllowed: Ref<boolean>
  isColumnUpdateAllowed: Ref<boolean>
  isSyncedReadonlyField: Ref<boolean>
  fieldAlterReason: Ref<string | null | undefined>
  fieldDeleteReason: Ref<string | null | undefined>
  linksAssociated: Ref<unknown[] | undefined>
  isSortSupported: Ref<boolean>
  isFilterSupported: Ref<boolean>
  isFilterLimitExceeded: Ref<boolean>
  isGroupBySupported: Ref<boolean>
  isGroupByLimitExceeded: Ref<boolean>
  isGroupedByThisField: Ref<boolean>
  isDuplicateAllowed: Ref<boolean>
  isDeleteAllowed: Ref<boolean>
  edit: (description?: boolean) => unknown
  sort: (direction: 'asc' | 'desc') => unknown
  filterOrGroup: (event: SmartsheetStoreEvents) => unknown
  toggleHidden: () => unknown
  duplicate: () => unknown
  insertAfter: () => unknown
  insertBefore: () => unknown
  remove: () => unknown
}) {
  const { t } = useI18n()

  const { $api } = useNuxtApp()

  const { isUIAllowed } = useRoles()

  const { isMobileMode } = useGlobal()

  const { copy } = useCopy()

  const { getMeta } = useMetas()

  const meta = inject(MetaInj, ref())

  const isPublic = inject(IsPublicInj, ref(false))

  const isLocked = inject(IsLockedInj, ref(false))

  const { eventBus, isSqlView } = useSmartsheetStoreOrThrow()

  const { column } = deps

  const isEditFieldAllowed = computed(
    () =>
      !isMobileMode.value &&
      isUIAllowed('fieldAlter') &&
      !deps.fieldAlterReason.value &&
      !column.value?.pk &&
      !(isSystemColumn(column.value) && !isCreatedOrLastModifiedTimeCol(column.value)) &&
      deps.isColumnEditAllowed.value &&
      !deps.linksAssociated.value?.length,
  )

  function validateFieldTitle(title: string) {
    if (!title) return t('msg.error.columnNameRequired')
    if (title.length > 255) return t('msg.error.columnNameExceedsCharacters', { value: 255 })
    const lower = title.toLowerCase()
    const isDuplicate = (meta.value?.columns ?? []).some(
      (c) =>
        c.id !== column.value.id &&
        (lower === (c.title ?? '').trim().toLowerCase() || lower === (c.column_name ?? '').trim().toLowerCase()),
    )
    return isDuplicate ? t('msg.error.duplicateColumnName') : undefined
  }

  // The column editor's save (useColumnCreateStore) with only the title changed.
  async function renameField(title: string) {
    await $api.internal.postOperation(
      meta.value!.fk_workspace_id!,
      meta.value!.base_id!,
      { operation: 'columnUpdate', columnId: column.value.id! },
      { ...(column.value.colOptions ?? {}), ...column.value, title },
    )
    await getMeta(meta.value!.base_id!, meta.value!.id!, true)
    eventBus.emit(SmartsheetStoreEvents.FIELD_RELOAD)
    eventBus.emit(SmartsheetStoreEvents.FIELD_UPDATE)
  }

  useCommandProvider(
    () => `field:${column.value.id}`,
    'field',
    (): CmdProviderState => {
      const col = column.value
      if (!col?.id || isPublic.value) return { commands: [] }

      const section = t('labels.commandPalette.sections.field')
      const isLink = isLinksOrLTAR(col)
      // The menu hides sort/filter/group for belongs-to links.
      const isBelongsTo = isLink && (col.colOptions as LinkToAnotherRecordType | undefined)?.type === RelationTypes.BELONGS_TO
      const commands: CmdCommand[] = []

      if (isEditFieldAllowed.value) {
        commands.push({
          id: 'field:edit',
          priority: CMD_PRIORITY.primary,
          title: t('labels.commandPalette.field.edit'),
          section,
          icon: { type: 'icon', name: 'ncEdit' },
          keywords: ['type', 'options', 'settings'],
          run: () => deps.edit(),
        })

        if (!isSystemColumn(col) && !isLink && col.uidt !== UITypes.ForeignKey && !deps.isSyncedReadonlyField.value) {
          commands.push({
            id: 'field:rename',
            priority: CMD_PRIORITY.high,
            title: t('labels.commandPalette.field.rename'),
            section,
            icon: { type: 'icon', name: 'rename' },
            edit: {
              value: col.title ?? '',
              placeholder: col.title,
              validate: validateFieldTitle,
              submit: renameField,
            },
          })
        }
      }

      if (isUIAllowed('fieldAlter') && !deps.fieldAlterReason.value && !isSqlView.value && col.uidt !== UITypes.ForeignKey) {
        commands.push({
          id: 'field:edit-description',
          priority: CMD_PRIORITY.low,
          title: t('labels.commandPalette.field.editDescription'),
          section,
          icon: { type: 'icon', name: 'ncAlignLeft' },
          run: () => deps.edit(true),
        })
      }

      if (!isLocked.value && deps.isSortSupported.value && !isBelongsTo) {
        commands.push(
          {
            id: 'field:sort-asc',
            priority: CMD_PRIORITY.high,
            title: t('labels.commandPalette.field.sortAsc'),
            section,
            icon: { type: 'icon', name: 'sortDesc', class: 'transform !rotate-180' },
            run: () => deps.sort('asc'),
          },
          {
            id: 'field:sort-desc',
            priority: CMD_PRIORITY.high,
            title: t('labels.commandPalette.field.sortDesc'),
            section,
            icon: { type: 'icon', name: 'sortDesc' },
            run: () => deps.sort('desc'),
          },
        )
      }

      if (
        !isMobileMode.value &&
        !isLocked.value &&
        deps.isFilterSupported.value &&
        !deps.isFilterLimitExceeded.value &&
        !isBelongsTo
      ) {
        commands.push({
          id: 'field:filter',
          priority: CMD_PRIORITY.high,
          title: t('labels.commandPalette.field.filter'),
          section,
          icon: { type: 'icon', name: 'filter' },
          run: () => deps.filterOrGroup(SmartsheetStoreEvents.FILTER_ADD),
        })
      }

      const isGroupByBlocked = isEeUI && !isPublic.value && (!deps.isGroupBySupported.value || deps.isGroupByLimitExceeded.value)
      if (!isLocked.value && !isBelongsTo && (deps.isGroupedByThisField.value || !isGroupByBlocked)) {
        commands.push({
          id: 'field:group-by',
          priority: CMD_PRIORITY.high,
          title: deps.isGroupedByThisField.value ? t('activity.dontGroupByThisField') : t('labels.commandPalette.field.groupBy'),
          section,
          icon: { type: 'icon', name: 'group' },
          run: () =>
            deps.filterOrGroup(
              deps.isGroupedByThisField.value ? SmartsheetStoreEvents.GROUP_BY_REMOVE : SmartsheetStoreEvents.GROUP_BY_ADD,
            ),
        })
      }

      if (!col.pv && !isLocked.value) {
        commands.push({
          id: 'field:hide',
          priority: CMD_PRIORITY.high,
          title: deps.isHiddenCol() ? t('labels.commandPalette.field.show') : t('labels.commandPalette.field.hide'),
          section,
          icon: { type: 'icon', name: deps.isHiddenCol() ? 'eye' : 'ncEyeOff' },
          run: () => deps.toggleHidden(),
        })
      }

      if (!col.pk && deps.isDuplicateAllowed.value && !isSqlView.value) {
        commands.push({
          id: 'field:duplicate',
          priority: CMD_PRIORITY.normal,
          title: t('labels.commandPalette.field.duplicate'),
          section,
          icon: { type: 'icon', name: 'duplicate' },
          run: () => deps.duplicate(),
        })
      }

      if (!isSqlView.value && !isMobileMode.value && isUIAllowed('fieldAdd')) {
        commands.push({
          id: 'field:insert-right',
          priority: CMD_PRIORITY.normal,
          title: t('labels.commandPalette.field.insertRight'),
          section,
          icon: { type: 'icon', name: 'colInsertAfter' },
          run: () => deps.insertAfter(),
        })
        if (!col.pv) {
          commands.push({
            id: 'field:insert-left',
            priority: CMD_PRIORITY.normal,
            title: t('labels.commandPalette.field.insertLeft'),
            section,
            icon: { type: 'icon', name: 'colInsertBefore' },
            run: () => deps.insertBefore(),
          })
        }
      }

      commands.push({
        id: 'field:copy-id',
        priority: CMD_PRIORITY.low,
        title: t('labels.commandPalette.field.copyId'),
        section,
        icon: { type: 'icon', name: 'ncCopy' },
        feedback: t('labels.commandPalette.copied'),
        run: () => copy(col.id!),
      })

      if (
        !col.pv &&
        isUIAllowed('fieldDelete') &&
        !deps.fieldDeleteReason.value &&
        deps.isDeleteAllowed.value &&
        deps.isColumnUpdateAllowed.value &&
        !deps.linksAssociated.value?.length
      ) {
        commands.push({
          id: 'field:delete',
          danger: true,
          title: t('labels.commandPalette.field.delete'),
          section,
          icon: { type: 'icon', name: 'ncTrash' },
          run: () => deps.remove(),
        })
      }

      return {
        context: { prefix: meta.value?.title, label: col.title ?? '', icon: { type: 'field', column: col } },
        commands,
      }
    },
  )
}
