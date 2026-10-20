<script setup lang="ts">
import type { ButtonType, ColumnType, ViewType } from 'nocodb-sdk'
import { PermissionEntity, PermissionKey, UITypes, isAIPromptCol, isSystemColumn } from 'nocodb-sdk'
import type { CmdCommand } from '~/lib/types'
import { useRelativeEditCommands } from '~/composables/useSetFieldCommands'

interface Props {
  isLoading?: boolean
  templateMode?: boolean
  blueprintMode?: boolean
  view?: ViewType
  // Side-panel header is space-constrained — drop the standalone copy-URL
  // button and surface "Copy URL" inside the dropdown instead.
  compact?: boolean
  // Parent passes this only when the record is addressable via the current
  // route (URL has `?rowId=…`). Used as the gate for Copy URL / Send Record —
  // without it those actions point at a record that can't be reached by URL
  // (public shared views, add-new flow, linked-record modal-over-modal).
  rowId?: string
  // Enables a "Compact view" toggle menu item. Used by the EE docked side
  // panel; hidden by default so the modal usage stays unchanged.
  showCompactToggle?: boolean
  // Current state of the compact-view toggle. v-modeled via 'update:compactMode'.
  compactMode?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isLoading: false,
  templateMode: false,
  blueprintMode: false,
  compact: false,
  rowId: undefined,
  showCompactToggle: false,
  compactMode: false,
})

const emits = defineEmits<{
  'duplicateStart': []
  'duplicateApplied': []
  'afterDelete': []
  'requestClose': []
  'update:compactMode': [boolean]
}>()

const { isUIAllowed } = useRoles()

const { dashboardUrl } = useDashboard()

const { copy } = useCopy()

const { appInfo, isMobileMode } = useGlobal()

const { showRecordPlanLimitExceededModal } = useEeConfig()

const { t } = useI18n()

const route = useRoute()

const { isAiRecordContextEnabled, setAiRecordContext } = useAiRecordContext()

const isPublic = inject(IsPublicInj, ref(false))

const injectedView = inject(ActiveViewInj, ref())

const view = computed(() => props.view ?? injectedView.value)

const { isSqlView } = useSmartsheetStoreOrThrow()

const reloadViewDataTrigger = inject(ReloadViewDataHookInj, createEventHook())

const expandedFormStore = useExpandedFormStoreOrThrow()

const { isNew, primaryKey, displayValue, baseRoles, meta, row: _row, loadRow: _loadRow, deleteRowById } = expandedFormStore

const isRecordLinkCopied = ref(false)

const showSendRecordModal = ref(false)

const showDeleteRowModal = ref(false)

const duplicatingRowInProgress = ref(false)

const visibleMoreOptions = computed(() => {
  if (props.templateMode || props.blueprintMode) {
    return {
      reloadRecord: false,
      copyRecordUrl: false,
      sendRecord: false,
      duplicateRecord: false,
      deleteRecord: false,
      showDeleteDivider: false,
      showMoreOptionsMenu: false,
      allHiddenExceptCopyRecordUrl: true,
    }
  }

  const result = {
    reloadRecord: !isEeUI && !!props.rowId,
    copyRecordUrl: !isNew.value && !!props.rowId,
    sendRecord: appInfo.value.ee && !isNew.value && !!props.rowId && !isPublic.value,
    duplicateRecord: isUIAllowed('dataEdit', baseRoles.value) && !isSqlView.value && !isMobileMode.value,
    deleteRecord: !isNew.value && isUIAllowed('dataEdit', baseRoles.value) && !isSqlView.value,
  }

  const hasItemsAboveDelete =
    Object.entries(result).some(([key, value]) => key !== 'deleteRecord' && value) || props.showCompactToggle

  return {
    ...result,
    showDeleteDivider: result.deleteRecord && hasItemsAboveDelete,
    showMoreOptionsMenu: hasItemsAboveDelete || result.deleteRecord,
    // Only meaningful when there's a standalone copy-URL button — in compact mode
    // the dropdown is the ONLY surface for copy-URL, so it must always render.
    allHiddenExceptCopyRecordUrl:
      !props.compact && !result.reloadRecord && !result.sendRecord && !result.duplicateRecord && !result.deleteRecord,
  }
})

const displayField = computed(() => (meta.value?.columns ?? []).find((c: ColumnType) => c.pv) ?? null)

const recordTitle = computed(() => {
  const value = displayValue.value
  return ncIsString(value) || ncIsNumber(value) ? String(value) : ''
})

// Cmd+K record commands only for a saved record in a real (non-template) form.
const hasRecordCommands = computed(
  () => !props.templateMode && !props.blueprintMode && !isNew.value && !!primaryKey.value && !!meta.value?.id,
)

const copyRecordUrl = async () => {
  let baseId = route.params.baseId as string
  let viewId = view.value?.id
  let pathQuery = route.query?.path ? `&path=${route.query?.path}` : ''

  // When the record is opened from a linked-record pill it belongs to a
  // different table than the one the current route/view points at (and possibly
  // a different base). The active view id, base and group `path` all describe
  // the parent table, so reusing them yields a URL whose view doesn't exist and
  // redirects to home. Point at the record's own base and omit the view + path —
  // a view-less URL falls back to the table's default view (see
  // `activeViewTitleOrId` in store/views.ts), which also works across bases.
  if (view.value && meta.value?.id && view.value.fk_model_id !== meta.value.id) {
    baseId = meta.value.base_id || baseId
    viewId = undefined
    pathQuery = ''
  }

  const url = `${dashboardUrl?.value}/${route.params.typeOrId}/${baseId}/${meta.value?.id}${viewId ? `/${viewId}` : ''}?rowId=${
    props.rowId
  }${pathQuery}`

  await copy(encodeURI(url))

  isRecordLinkCopied.value = true

  await ncDelay(5000)

  isRecordLinkCopied.value = false
}

const onDuplicateRow = async ({ notify = true }: { notify?: boolean } = {}) => {
  if (showRecordPlanLimitExceededModal()) return

  // Resolve the payload before flagging the duplicate as in progress — this may
  // prompt about links the copy can't share, and the user can still back out
  // (null), which must not leave the form stuck in the duplicating state.
  const duplicatedRow = await prepareDuplicateRowData(_row.value.row, meta.value?.columns as ColumnType[])
  if (!duplicatedRow) return

  duplicatingRowInProgress.value = true
  emits('duplicateStart')

  const newRow = Object.assign(
    {},
    {
      row: duplicatedRow,
      oldRow: {},
      rowMeta: { new: true },
    },
  ) as Row

  setTimeout(async () => {
    _row.value = newRow
    duplicatingRowInProgress.value = false
    emits('duplicateApplied')
    if (notify) message.toast(t('msg.success.rowDuplicatedWithoutSavedYet'))
  }, 500)
}

const onDeleteRowClick = () => {
  showDeleteRowModal.value = true
}

const onConfirmDeleteRowClick = async () => {
  await deleteRowById(primaryKey.value || undefined)

  emits('afterDelete')
  showDeleteRowModal.value = false

  await reloadViewDataTrigger.trigger({
    shouldShowLoading: false,
    inPlace: true,
    skipLoadingRowId: primaryKey.value || undefined,
  })
}

function formRowEl(columnId: string) {
  return document.querySelector<HTMLElement>(`.nc-expanded-form-row[col-id="${columnId}"]`)
}

// Deferred so the closing palette doesn't take focus back. Cells without a text input
// (select, checkbox, rating…) are activated by a click, as a pointer would; read-only ones only flash.
function focusField(columnId: string) {
  setTimeout(() => {
    const rowEl = formRowEl(columnId)
    if (!rowEl) return
    rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
    rowEl.animate([{ backgroundColor: 'var(--nc-bg-brand)' }, { backgroundColor: 'transparent' }], {
      duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1200,
      easing: 'cubic-bezier(0.2, 0, 0, 1)',
    })

    const input = rowEl.querySelector<HTMLElement>('input:not([type="checkbox"]), textarea, [contenteditable="true"]')
    if (input) return input.focus()

    const cell = rowEl.querySelector<HTMLElement>('.nc-data-cell')
    if (cell && !rowEl.querySelector('.nc-readonly-div-data-cell, .nc-system-field')) cell.click()
  }, 150)
}

const setFieldCommands = useSetFieldCommands()

const relativeEditCommands = useRelativeEditCommands()

useCommandProvider(
  () => `record:${meta.value?.id}:${primaryKey.value}`,
  'record',
  () => {
    if (!hasRecordCommands.value) return { commands: [] }

    const section = t('labels.commandPalette.sections.record')
    const commands: CmdCommand[] = []
    // Shared by "Set <Field>…" and query-built edits ("add 10").
    let editTarget: Parameters<typeof relativeEditCommands>[0] | undefined

    if (visibleMoreOptions.value.copyRecordUrl) {
      commands.push({
        id: 'record:copy-url',
        priority: CMD_PRIORITY.high,
        title: t('labels.commandPalette.copyRecordUrl'),
        section,
        icon: { type: 'icon', name: 'copy' },
        keywords: ['link'],
        feedback: t('labels.commandPalette.copied'),
        run: () => {
          copyRecordUrl()
        },
      })
    }

    if (isUIAllowed('dataEdit', baseRoles.value) && !isSqlView.value) {
      commands.push({
        id: 'record:edit-field',
        priority: CMD_PRIORITY.primary,
        title: `${t('labels.editField')}…`,
        section,
        icon: { type: 'icon', name: 'ncEdit' },
        searchChildren: true,
        children: () =>
          (meta.value?.columns ?? [])
            .filter((col) => !isSystemColumn(col) && col.id && formRowEl(col.id))
            .map((col) => ({
              id: `record:edit-field:${col.id}`,
              title: col.title!,
              icon: { type: 'field', column: col },
              run: () => focusField(col.id!),
            })),
      })

      // With other edits pending the value joins them unsaved, as typing in the form would.
      const hasPendingEdits = expandedFormStore.changedColumns.value.size > 0 || expandedFormStore.hasLtarChanges.value
      commands.push(
        ...setFieldCommands(
          (editTarget = {
            meta: meta.value,
            // Shared views open the form read-only.
            columns: isPublic.value
              ? []
              : [
                  ...expandedFormStore.fields.value.map((column) => ({ column })),
                  ...expandedFormStore.hiddenFields.value.map((column) => ({ column, hidden: true })),
                ],
            values: (column) => [_row.value.row[column.title!]],
            section,
            // Links save immediately; with edits pending they'd bypass the form's queued link changes.
            row: hasPendingEdits ? undefined : _row.value.row,
            feedback: hasPendingEdits ? t('labels.commandPalette.setUnsaved') : undefined,
            save: async (column, next) => {
              _row.value.row[column.title!] = next(_row.value.row[column.title!])
              expandedFormStore.changedColumns.value = new Set([...expandedFormStore.changedColumns.value, column.title!])
              if (hasPendingEdits) return

              await expandedFormStore.save()
              await _loadRow()
              await reloadViewDataTrigger.trigger()
            },
          }),
        ),
      )
    }

    // Same gates as the sidebar's comment box and feeds (none on SQL views or shared views).
    if (!isNew.value && props.rowId && !isSqlView.value && !isPublic.value) {
      if (isUIAllowed('commentEdit')) {
        commands.push({
          id: 'record:add-comment',
          priority: CMD_PRIORITY.normal,
          title: t('labels.commandPalette.addComment'),
          section,
          icon: { type: 'icon', name: 'ncMessageCircle' },
          keywords: ['comment', 'note', 'discuss'],
          feedback: t('labels.commandPalette.commentAdded'),
          edit: {
            value: '',
            multiline: true,
            placeholder: t('labels.commandPalette.commentPlaceholder'),
            validate: (value) => (value.trim() ? undefined : t('labels.commandPalette.commentRequired')),
            submit: async (value) => {
              await expandedFormStore.saveComment(value.trim().replace(/\n/g, '<br />'), undefined, undefined, undefined, {
                notify: false,
              })
              expandedFormStore.requestedSidebarFeed.value = 'comments'
            },
          },
        })
      }

      if (isUIAllowed('commentList')) {
        commands.push({
          id: 'record:open-comments',
          priority: CMD_PRIORITY.normal,
          title: t('labels.commandPalette.openComments'),
          section,
          icon: { type: 'icon', name: 'ncMessageCircle' },
          run: () => {
            expandedFormStore.requestedSidebarFeed.value = 'comments'
          },
        })
      }

      if (expandedFormStore.isAuditEnabled.value) {
        commands.push({
          id: 'record:open-history',
          priority: CMD_PRIORITY.low,
          title: t('labels.commandPalette.openRevisionHistory'),
          section,
          icon: { type: 'icon', name: 'ncClock' },
          keywords: ['audit', 'history', 'changes', 'log'],
          run: () => {
            expandedFormStore.requestedSidebarFeed.value = 'audits'
          },
        })
      }
    }

    if (visibleMoreOptions.value.sendRecord) {
      commands.push({
        id: 'record:send',
        priority: CMD_PRIORITY.normal,
        title: t('activity.sendRecord'),
        section,
        icon: { type: 'icon', name: 'mail' },
        keywords: ['email'],
        run: () => {
          showSendRecordModal.value = true
        },
      })
    }

    if (visibleMoreOptions.value.duplicateRecord && !meta.value?.synced) {
      commands.push({
        id: 'record:duplicate',
        priority: CMD_PRIORITY.normal,
        title: t('labels.commandPalette.duplicateRecord'),
        section,
        icon: { type: 'icon', name: 'duplicate' },
        feedback: t('msg.success.rowDuplicatedWithoutSavedYet'),
        run: () => onDuplicateRow({ notify: false }),
      })
    }

    if (visibleMoreOptions.value.reloadRecord) {
      commands.push({
        id: 'record:reload',
        priority: CMD_PRIORITY.low,
        title: `${t('general.reload')} ${t('objects.record')}`,
        section,
        icon: { type: 'icon', name: 'reload' },
        keywords: ['refresh'],
        run: () => _loadRow(),
      })
    }

    if (props.showCompactToggle) {
      commands.push({
        id: 'record:compact-view',
        priority: CMD_PRIORITY.low,
        title: t('labels.compactView'),
        section,
        icon: { type: 'icon', name: 'list' },
        checked: props.compactMode,
        keywords: ['dense', 'plain'],
        run: () => emits('update:compactMode', !props.compactMode),
      })
    }

    // Button and AI fields: click the form's own control, so its gates, confirmations and status apply.
    for (const col of meta.value?.columns ?? []) {
      if (!col.id || isSystemColumn(col)) continue
      const isButton = col.uidt === UITypes.Button
      if (!isButton && !isAIPromptCol(col)) continue
      const selector = isButton ? '[data-testid="nc-button-cell"], .nc-cell-ai-button' : 'button.theme-ai'
      const control = formRowEl(col.id)?.querySelector<HTMLElement>(selector)
      if (!control || control.matches('[disabled], .disabled')) continue
      commands.push({
        id: `record:run:${col.id}`,
        priority: CMD_PRIORITY.normal,
        title: t(isButton ? 'labels.commandPalette.runButton' : 'labels.commandPalette.generateField', { field: col.title }),
        section,
        icon: { type: 'field', column: col },
        keywords: ['run', 'click', 'button', 'generate', (col.colOptions as ButtonType | undefined)?.label ?? ''],
        // After the palette closes, so focus and any dialog the action opens land in the form.
        run: () => setTimeout(() => formRowEl(col.id!)?.querySelector<HTMLElement>(selector)?.click(), 0),
      })
    }

    if (isAiRecordContextEnabled.value) {
      commands.push({
        id: 'record:ask-ai',
        priority: CMD_PRIORITY.high,
        title: t('labels.commandPalette.askAiAboutRecord'),
        section,
        icon: { type: 'icon', name: 'ncAutoAwesome' },
        run: () => setAiRecordContext({ tableId: meta.value!.id!, recordId: String(primaryKey.value), title: recordTitle.value }),
      })
    }

    if (visibleMoreOptions.value.deleteRecord && !meta.value?.synced) {
      commands.push({
        id: 'record:delete',
        title: t('labels.commandPalette.deleteRecord'),
        section,
        icon: { type: 'icon', name: 'delete' },
        danger: true,
        run: onDeleteRowClick,
      })
    }

    return {
      context: {
        prefix: meta.value?.title,
        label: recordTitle.value || String(primaryKey.value),
        icon: { type: 'table', icon: parseProp(meta.value?.meta).icon },
      },
      commands,
      fallbacks: (query) => (editTarget ? relativeEditCommands(editTarget, query) : []),
    }
  },
)
</script>

<template>
  <NcTooltip v-if="visibleMoreOptions.copyRecordUrl && !isMobileMode && !compact" class="lt-lg:!hidden">
    <template #title>
      {{ isRecordLinkCopied ? $t('labels.copiedRecordURL') : $t('labels.copyRecordURL') }}
    </template>
    <NcButton
      :disabled="isLoading"
      class="text-nc-content-inverted-secondary !h-7 !w-7"
      type="text"
      size="xsmall"
      @click="copyRecordUrl()"
    >
      <div v-e="['c:row-expand:copy-url']" data-testid="nc-expanded-form-copy-url" class="flex items-center relative h-4 w-4">
        <Transition name="icon-fade" :duration="200">
          <component :is="iconMap.check" v-if="isRecordLinkCopied" class="cursor-pointer nc-duplicate-row h-4 w-4" />
          <component :is="iconMap.copy" v-else class="cursor-pointer nc-duplicate-row h-4 w-4" />
        </Transition>
      </div>
    </NcButton>
  </NcTooltip>

  <NcDropdown
    v-if="visibleMoreOptions.showMoreOptionsMenu"
    placement="bottomRight"
    :class="{
      '!lg:hidden': visibleMoreOptions.allHiddenExceptCopyRecordUrl,
    }"
  >
    <NcButton
      :type="isMobileMode ? 'secondary' : 'text'"
      size="xsmall"
      class="nc-expand-form-more-actions !w-7 !h-7"
      :class="{
        '!lg:hidden': visibleMoreOptions.allHiddenExceptCopyRecordUrl,
      }"
      :disabled="isLoading"
    >
      <GeneralIcon
        icon="threeDotVertical"
        class="text-md"
        :class="isLoading ? 'text-nc-content-brand-hover' : 'text-nc-content-inverted-secondary'"
      />
    </NcButton>
    <template #overlay>
      <NcMenu variant="small">
        <NcMenuItem v-if="visibleMoreOptions.reloadRecord" @click="_loadRow()">
          <div v-e="['c:row-expand:reload']" class="flex gap-2 items-center" data-testid="nc-expanded-form-reload">
            <component :is="iconMap.reload" class="cursor-pointer" />
            {{ $t('general.reload') }} {{ $t('objects.record') }}
          </div>
        </NcMenuItem>
        <NcMenuItem
          v-if="visibleMoreOptions.copyRecordUrl"
          type="secondary"
          :class="{ '!lg:hidden': !compact }"
          :disabled="isLoading"
          @click="copyRecordUrl()"
        >
          <div v-e="['c:row-expand:copy-url']" data-testid="nc-expanded-form-copy-url" class="flex gap-2 items-center">
            <component :is="iconMap.copy" class="cursor-pointer" />
            {{ $t('labels.copyRecordURL') }}
          </div>
        </NcMenuItem>
        <NcMenuItem v-if="visibleMoreOptions.sendRecord" :disabled="isLoading" @click="showSendRecordModal = true">
          <div v-e="['c:row-expand:send-record']" data-testid="nc-expanded-form-send-record" class="flex gap-2 items-center">
            <GeneralIcon icon="mail" class="cursor-pointer" />
            {{ $t('activity.sendRecord') }}
          </div>
        </NcMenuItem>
        <NcTooltip v-if="visibleMoreOptions.duplicateRecord && meta?.synced" placement="left">
          <template #title>
            {{ $t('msg.info.duplicateNotAvailableForSyncedTable') }}
          </template>
          <NcMenuItem disabled>
            <div class="flex gap-2 items-center" data-testid="nc-expanded-form-duplicate">
              <component :is="iconMap.duplicate" class="cursor-pointer nc-duplicate-row" />
              <span class="-ml-0.25">
                {{ $t('labels.duplicateRecord') }}
              </span>
            </div>
          </NcMenuItem>
        </NcTooltip>
        <PermissionsTooltip
          v-else-if="visibleMoreOptions.duplicateRecord"
          :entity="PermissionEntity.TABLE"
          :entity-id="meta?.id"
          :permission="PermissionKey.TABLE_RECORD_ADD"
          placement="right"
        >
          <template #default="{ isAllowed }">
            <NcMenuItem :disabled="!isAllowed" @click="!isNew ? onDuplicateRow() : () => {}">
              <div v-e="['c:row-expand:duplicate']" class="flex gap-2 items-center" data-testid="nc-expanded-form-duplicate">
                <component :is="iconMap.duplicate" class="cursor-pointer nc-duplicate-row" />
                <span class="-ml-0.25">
                  {{ $t('labels.duplicateRecord') }}
                </span>
              </div>
            </NcMenuItem>
          </template>
        </PermissionsTooltip>
        <NcMenuItem
          v-if="showCompactToggle"
          v-e="[compactMode ? 'c:row-expand-panel:compact:off' : 'c:row-expand-panel:compact:on']"
          data-testid="nc-expanded-form-compact-toggle"
          @click="emits('update:compactMode', !compactMode)"
        >
          <div class="flex gap-2 items-center justify-between w-full">
            <div class="flex gap-2 items-center">
              <component :is="iconMap.list" class="cursor-pointer" />
              <span>{{ $t('labels.compactView') }}</span>
            </div>
            <component :is="iconMap.check" v-if="compactMode" class="!w-3.5 !h-3.5 text-nc-content-brand" />
          </div>
        </NcMenuItem>
        <NcDivider v-if="visibleMoreOptions.showDeleteDivider" />
        <NcTooltip v-if="visibleMoreOptions.deleteRecord && meta?.synced" placement="left">
          <template #title>
            {{ $t('msg.info.deleteNotAvailableForSyncedTable') }}
          </template>
          <NcMenuItem danger disabled>
            <div class="flex gap-2 items-center" data-testid="nc-expanded-form-delete">
              <GeneralIcon icon="delete" class="cursor-pointer nc-delete-row" />
              <span class="-ml-0.25">
                {{
                  $t('general.deleteEntity', {
                    entity: $t('objects.record').toLowerCase(),
                  })
                }}
              </span>
            </div>
          </NcMenuItem>
        </NcTooltip>
        <PermissionsTooltip
          v-else-if="visibleMoreOptions.deleteRecord"
          :entity="PermissionEntity.TABLE"
          :entity-id="meta?.id"
          :permission="PermissionKey.TABLE_RECORD_DELETE"
          placement="right"
        >
          <template #default="{ isAllowed }">
            <NcMenuItem danger :disabled="!isAllowed" @click="!isNew && onDeleteRowClick()">
              <div v-e="['c:row-expand:delete']" class="flex gap-2 items-center" data-testid="nc-expanded-form-delete">
                <GeneralIcon icon="delete" class="cursor-pointer nc-delete-row" />
                <span class="-ml-0.25">
                  {{
                    $t('general.deleteEntity', {
                      entity: $t('objects.record').toLowerCase(),
                    })
                  }}
                </span>
              </div>
            </NcMenuItem>
          </template>
        </PermissionsTooltip>
      </NcMenu>
    </template>
  </NcDropdown>

  <GeneralDeleteModal
    v-model:visible="showDeleteRowModal"
    :entity-name="$t('general.record')"
    :on-delete="onConfirmDeleteRowClick"
  >
    <template #entity-preview>
      <span>
        <div
          class="flex flex-row items-center py-2.25 px-2.5 bg-nc-bg-gray-extralight rounded-lg text-nc-content-inverted-secondary"
        >
          <div class="text-ellipsis overflow-hidden select-none w-full pl-1.75 break-keep whitespace-nowrap">
            <LazySmartsheetPlainCell v-if="displayField" v-model="displayValue" :column="displayField" />
          </div>
        </div>
      </span>
    </template>
  </GeneralDeleteModal>

  <DlgSendRecordEmail
    v-if="visibleMoreOptions.sendRecord"
    v-model="showSendRecordModal"
    :meta="meta"
    :view="view"
    :row-id="props.rowId"
  />
</template>
