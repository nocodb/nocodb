<script setup lang="ts">
import type { TableType, ViewType } from 'nocodb-sdk'
import { ExpandedFormMode } from 'nocodb-sdk'
import type { Ref } from 'vue'

const panelStore = useExpandedFormPanelOrThrow()

const {
  isOpen,
  activeRow,
  activeRowId,
  activeRowState,
  panelWidth,
  isLoading,
  isFullscreen,
  activityExpanded,
  activeActivityTab,
  hasPrev,
  hasNext,
} = panelStore

const { closePanel, setFullscreen, navigatePrev, navigateNext, toggleActivity } = panelStore

const meta = inject(MetaInj, ref())

const view = inject(ActiveViewInj, ref())

const isPublic = inject(IsPublicInj, ref(false))

const reloadViewDataTrigger = inject(ReloadViewDataHookInj, createEventHook())

const { isUIAllowed } = useRoles()

const { t } = useI18n()

const { $e } = useNuxtApp()

const { isMobileMode } = useGlobal()

const panelRef = ref<HTMLElement>()

const activeViewMode = ref(ExpandedFormMode.FIELD)

const isResizing = ref(false)
const resizeStartX = ref(0)
const resizeStartWidth = ref(0)

const MIN_WIDTH = 320

const getMaxWidth = () => {
  const containerWidth = panelRef.value?.parentElement?.clientWidth ?? 0
  return Math.max(MIN_WIDTH, Math.floor(containerWidth * 0.6))
}

const onResizeStart = (e: MouseEvent) => {
  isResizing.value = true
  resizeStartX.value = e.clientX
  resizeStartWidth.value = panelWidth.value
  document.body.style.cursor = 'col-resize'

  window.addEventListener('mousemove', onResizeMove)
  window.addEventListener('mouseup', onResizeEnd)
}

const onResizeMove = (e: MouseEvent) => {
  if (!isResizing.value) return
  const delta = resizeStartX.value - e.clientX
  panelWidth.value = Math.max(MIN_WIDTH, Math.min(getMaxWidth(), resizeStartWidth.value + delta))
}

const onResizeEnd = () => {
  isResizing.value = false
  document.body.style.cursor = ''
  window.removeEventListener('mousemove', onResizeMove)
  window.removeEventListener('mouseup', onResizeEnd)
  $e('c:row-expand-panel:resize', { width: panelWidth.value })
}

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onResizeMove)
  window.removeEventListener('mouseup', onResizeEnd)
  document.body.style.cursor = ''
})

const rowRef = computed(() => activeRow.value ?? ({ row: {}, oldRow: {}, rowMeta: {} } as Row))

const maintainDefaultViewOrder = ref(false)

const expandedFormStore = useProvideExpandedFormStore(meta as Ref<TableType>, rowRef as Ref<Row>, maintainDefaultViewOrder, false)

const {
  commentsDrawer,
  changedColumns,
  displayValue,
  state: rowState,
  isNew,
  loadRow: _loadRow,
  primaryKey,
  row: _row,
  save: _save,
  loadComments,
  loadAudits,
  clearColumns,
  baseRoles,
  fields,
  hiddenFields,
} = expandedFormStore

const { isSqlView } = useProvideSmartsheetStore(view as Ref<ViewType>, meta)

useProvideSmartsheetLtarHelpers(meta)

provide(CellClickHookInj, undefined)
provide(CanvasSelectCellInj, undefined)

const isExpanded = computed(() => isOpen.value)

provide(IsExpandedFormOpenInj, isExpanded)

const reloadHook = createEventHook()

reloadHook.on(() => {
  if (isNew.value) return
  _loadRow(activeRowId.value ?? undefined, true)
})

provide(ReloadRowDataHookInj, reloadHook)

commentsDrawer.value = true

watch([() => activityExpanded.value, () => activeActivityTab.value], async ([expanded, tab]) => {
  if (!isOpen.value || !expanded || !primaryKey.value) return

  if (tab === 'comments') {
    await loadComments(primaryKey.value)
  } else if (tab === 'audits') {
    await loadAudits(primaryKey.value, false)
  }
})

const isSaving = ref(false)

const isSaveDisabled = computed(() => {
  return changedColumns.value.size === 0
})

const isInitialLoad = ref(true)

const triggerRowLoad = async (rowId?: string) => {
  if (isInitialLoad.value) {
    isLoading.value = true
  }
  await Promise.allSettled([loadComments(rowId, false), _loadRow(rowId)])
  isLoading.value = false
  isInitialLoad.value = false
}

watch(
  [activeRowId, () => panelStore.activeRowIndex.value],
  async ([newRowId]) => {
    if (!isOpen.value) return

    if (panelStore.isUserNavigating.value) {
      clearColumns()
      panelStore.isUserNavigating.value = false
    }

    if (activeRowState.value) {
      rowState.value = activeRowState.value
    } else {
      rowState.value = {}
    }

    // Use rowId if available, otherwise let _loadRow extract PK from the row data
    await triggerRowLoad(newRowId ?? undefined)

    if (activityExpanded.value && activeActivityTab.value === 'audits') {
      await loadAudits(primaryKey.value ?? undefined, false)
    }
  },
  { immediate: true },
)

// Returns true on success, false on failure (error is surfaced via message.error).
// saveAndContinue relies on the return value to decide whether to navigate.
const save = async (): Promise<boolean> => {
  isSaving.value = true

  try {
    if (isNew.value) {
      await _save(rowState.value)
    } else {
      await _save()
      await _loadRow()
    }

    await reloadViewDataTrigger?.trigger()
    return true
  } catch (e: any) {
    if (isNew.value) {
      message.error(`Add row failed: ${await extractSdkResponseErrorMsg(e)}`)
    } else {
      message.error(`${t('msg.error.rowUpdateFailed')}: ${await extractSdkResponseErrorMsg(e)}`)
    }
    return false
  } finally {
    isSaving.value = false
  }
}

const showDiscardModal = ref(false)

const onClose = () => {
  $e('c:row-expand-panel:close')
  if (changedColumns.value.size > 0) {
    pendingNavDirection.value = null
    showDiscardModal.value = true
  } else {
    closePanel()
  }
}

const pendingNavDirection = ref<'prev' | 'next' | null>(null)

const guardedNavigate = (direction: 'prev' | 'next') => {
  $e(`c:row-expand-panel:nav:${direction}`)
  if (changedColumns.value.size > 0) {
    pendingNavDirection.value = direction
    showDiscardModal.value = true
    return
  }
  if (direction === 'prev') navigatePrev()
  else navigateNext()
}

const discardAndNavigate = () => {
  $e('c:row-expand-panel:discard')
  clearColumns()
  showDiscardModal.value = false
  const dir = pendingNavDirection.value
  pendingNavDirection.value = null
  if (dir === 'prev') navigatePrev()
  else if (dir === 'next') navigateNext()
  else closePanel()
}

const saveAndContinue = async () => {
  $e('c:row-expand-panel:save-and-continue')
  const ok = await save()
  if (!ok) return // save failed — stay on current row so user can fix/retry
  showDiscardModal.value = false
  const dir = pendingNavDirection.value
  pendingNavDirection.value = null
  if (dir === 'prev') navigatePrev()
  else if (dir === 'next') navigateNext()
  else closePanel()
}

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    if (isFullscreen.value) {
      setFullscreen(false)
      activeViewMode.value = ExpandedFormMode.FIELD
    } else {
      onClose()
    }
  }

  if (!e.altKey) return

  if (e.key === 'ArrowUp') {
    e.preventDefault()
    guardedNavigate('prev')
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    guardedNavigate('next')
  } else if (e.code === 'KeyS') {
    e.preventDefault()
    if (!isSaveDisabled.value) save()
  }
}

const panelStyle = computed(() => {
  if (isFullscreen.value) return {}
  return { width: `${panelWidth.value}px` }
})

const panelClasses = computed(() => {
  const base = ['nc-expanded-form-panel', 'flex', 'flex-col', 'bg-nc-bg-default', 'border-l', 'border-nc-border-gray-medium']
  if (isResizing.value) base.push('is-resizing')
  if (isFullscreen.value) {
    base.push('flex-1', 'h-full', 'z-50')
  } else {
    base.push('flex-shrink-0', 'h-full')
  }
  return base
})

const showActivity = computed(() => {
  return !isNew.value && isUIAllowed('commentList', baseRoles.value) && !isPublic.value && !isSqlView.value
})
</script>

<template>
  <Transition name="nc-slide-right" @after-enter="panelRef?.focus()">
    <div
      v-if="isOpen && !isMobileMode"
      ref="panelRef"
      tabindex="-1"
      :class="panelClasses"
      :style="panelStyle"
      data-testid="nc-expanded-form-panel"
      @keydown="onKeydown"
    >
      <!-- Resize handle (left edge) -->
      <div
        v-if="!isFullscreen"
        class="nc-expanded-form-panel-resize-handle"
        data-testid="nc-expanded-form-panel-resize"
        @mousedown.prevent="onResizeStart"
      />

      <!-- Header -->
      <div
        class="flex items-center h-[var(--toolbar-height)] gap-0 px-3 py-2 border-b border-nc-border-gray-medium flex-shrink-0"
      >
        <!-- Display value (flex-1 pushes header controls to the right) -->
        <NcTooltip v-if="displayValue && !isNew" show-on-truncate-only class="truncate min-w-0 flex-1">
          <template #title>{{ displayValue }}</template>
          <span class="nc-expanded-form-panel-display-value truncate font-bold text-body text-nc-content-gray">
            {{ displayValue }}
          </span>
        </NcTooltip>
        <span v-else-if="isNew" class="truncate font-bold text-body text-nc-content-gray flex-1">
          {{ $t('activity.newRecord') }}
        </span>
        <div v-else class="flex-1" />

        <!-- Save -->
        <NcTooltip
          v-if="isUIAllowed('dataEdit', baseRoles) && !isSqlView"
          :title="isNew ? $t('general.create') : $t('general.save')"
        >
          <NcButton
            v-e="['c:row-expand-panel:save']"
            :disabled="isSaveDisabled"
            :loading="isSaving"
            class="!w-7 !h-7"
            data-testid="nc-expanded-form-panel-save"
            type="primary"
            size="xsmall"
            @click="save"
          >
            <GeneralIcon icon="save" class="w-4 h-4" />
          </NcButton>
        </NcTooltip>

        <div v-if="!isNew" class="flex items-center">
          <NcTooltip :title="$t('labels.prevRow')">
            <NcButton
              size="xs"
              type="text"
              :disabled="!hasPrev"
              class="!border-0"
              data-testid="nc-expanded-form-panel-prev"
              @click="guardedNavigate('prev')"
            >
              <GeneralIcon icon="arrowUp" class="w-3.5 h-3.5" />
            </NcButton>
          </NcTooltip>
          <NcTooltip :title="$t('labels.nextRow')">
            <NcButton
              size="xs"
              type="text"
              :disabled="!hasNext"
              class="!border-0"
              data-testid="nc-expanded-form-panel-next"
              @click="guardedNavigate('next')"
            >
              <GeneralIcon icon="arrowDown" class="w-3.5 h-3.5" />
            </NcButton>
          </NcTooltip>
        </div>

        <SmartsheetExpandedFormViewModeSelector v-if="isFullscreen" v-model="activeViewMode" :view="view" class="mr-2" />

        <div
          v-if="showActivity && !isFullscreen"
          class="nc-panel-mode-selector flex flex-row rounded-lg border-1 border-nc-border-gray-medium bg-nc-bg-default h-7 overflow-hidden"
        >
          <NcTooltip :title="$t('objects.fields')">
            <div
              v-e="['c:row-expand-panel:mode:fields']"
              class="nc-panel-mode-tab"
              :class="{ active: !activityExpanded }"
              @click="activityExpanded = false"
            >
              <GeneralIcon icon="menu" class="nc-panel-mode-tab-icon" />
            </div>
          </NcTooltip>
          <NcTooltip :title="$t('general.comments')">
            <div
              v-e="['c:row-expand-panel:mode:comments']"
              class="nc-panel-mode-tab"
              :class="{ active: activityExpanded && activeActivityTab === 'comments' }"
              data-testid="nc-expanded-form-panel-comments-toggle"
              @click="toggleActivity('comments')"
            >
              <GeneralIcon icon="messageCircle" class="nc-panel-mode-tab-icon" />
            </div>
          </NcTooltip>
          <NcTooltip :title="$t('labels.revisionHistory')">
            <div
              v-e="['c:row-expand-panel:mode:audits']"
              class="nc-panel-mode-tab"
              :class="{ active: activityExpanded && activeActivityTab === 'audits' }"
              data-testid="nc-expanded-form-panel-audits-toggle"
              @click="toggleActivity('audits')"
            >
              <GeneralIcon icon="audit" class="nc-panel-mode-tab-icon" />
            </div>
          </NcTooltip>
        </div>

        <div class="flex items-center">
          <NcTooltip :title="isFullscreen ? $t('labels.exitFullscreen') : $t('labels.enterFullscreen')">
            <NcButton
              v-e="[`c:row-expand-panel:${isFullscreen ? 'exit' : 'enter'}-fullscreen`]"
              size="xs"
              :type="isFullscreen ? 'primary' : 'text'"
              data-testid="nc-expanded-form-panel-fullscreen"
              @click="setFullscreen(!isFullscreen)"
            >
              <GeneralIcon :icon="isFullscreen ? 'ncMinimize' : 'ncMaximize'" class="w-3.5 h-3.5" />
            </NcButton>
          </NcTooltip>
          <NcTooltip :title="$t('general.close')">
            <NcButton
              v-e="['c:row-expand-panel:close']"
              size="xs"
              type="text"
              data-testid="nc-expanded-form-panel-close"
              @click="onClose"
            >
              <GeneralIcon icon="close" class="w-4 h-4" />
            </NcButton>
          </NcTooltip>
        </div>
      </div>

      <div class="flex-1 min-h-0 overflow-hidden">
        <div v-if="isLoading" class="flex items-center justify-center h-full">
          <GeneralLoader />
        </div>

        <!-- Fullscreen: use expanded form presentors (Fields/Attachments/Discussion) -->
        <template v-else-if="isFullscreen">
          <SmartsheetExpandedFormPresentorsFields
            v-if="activeViewMode === ExpandedFormMode.FIELD"
            :row-id="primaryKey"
            :fields="fields ?? []"
            :hidden-fields="hiddenFields"
            :is-unsaved-duplicated-record-exist="false"
            :is-unsaved-form-exist="false"
            :is-loading="isLoading"
            :is-saving="isSaving"
          />
          <SmartsheetExpandedFormPresentorsAttachments
            v-else-if="activeViewMode === ExpandedFormMode.ATTACHMENT"
            :row-id="primaryKey"
            :view="view"
            :fields="fields ?? []"
            :hidden-fields="hiddenFields"
            :is-unsaved-duplicated-record-exist="false"
            :is-unsaved-form-exist="false"
            :is-loading="isLoading"
            :is-saving="isSaving"
          />
          <SmartsheetExpandedFormPresentorsDiscussion
            v-else-if="activeViewMode === ExpandedFormMode.DISCUSSION"
            :is-unsaved-duplicated-record-exist="false"
          />
        </template>

        <!-- Panel mode: fields / comments / audits -->
        <template v-else>
          <div class="h-full overflow-y-auto nc-scrollbar-thin">
            <template v-if="activityExpanded && activeActivityTab === 'comments'">
              <SmartsheetExpandedFormSidebarComments />
            </template>
            <template v-else-if="activityExpanded && activeActivityTab === 'audits'">
              <SmartsheetExpandedFormSidebarAudits />
            </template>
            <SmartsheetExpandedFormPresentorsFieldsColumns
              v-else
              :fields="fields ?? []"
              :hidden-fields="hiddenFields"
              :is-loading="isLoading"
              force-vertical-mode
              class="nc-panel-fields-compact"
            />
          </div>
        </template>
      </div>
    </div>
  </Transition>

  <!-- Discard changes modal (height=auto so the frame fits the short confirm copy) -->
  <NcModal v-model:visible="showDiscardModal" size="xs" height="auto">
    <div>
      <div class="flex flex-row items-center gap-x-2 text-base font-bold">
        {{ $t('labels.saveChanges') }}
      </div>
      <div class="flex font-medium mt-2">
        {{ $t('activity.doYouWantToSaveTheChanges') }}
      </div>
      <div class="flex flex-row justify-end gap-x-2 mt-5">
        <NcButton type="secondary" size="small" @click="discardAndNavigate">{{ $t('labels.discard') }}</NcButton>
        <NcButton type="primary" size="small" :loading="isSaving" @click="saveAndContinue">
          {{ $t('labels.saveChanges') }}
        </NcButton>
      </div>
    </div>
  </NcModal>
</template>

<style lang="scss" scoped>
.nc-panel-mode-tab {
  @apply flex flex-row items-center h-full justify-center px-2 border-1 border-t-0 border-b-0 border-nc-border-gray-medium text-nc-content-gray-subtle2 cursor-pointer transition-all duration-300 select-none;

  &:first-child,
  &:last-child {
    @apply border-0;
  }

  &.active {
    @apply bg-nc-bg-brand-inverted text-nc-content-brand-disabled;
    box-shadow: 0px 3px 1px -2px rgba(0, 0, 0, 0.06), 0px 5px 3px -2px rgba(0, 0, 0, 0.02);
  }

  &:not(.active) {
    @apply hover:text-nc-content-gray-extreme;
  }
}

.nc-panel-mode-tab-icon {
  font-size: 0.875rem !important;
  @apply w-3.5;
}

.nc-expanded-form-panel {
  outline: none;
  transition: width 0.2s ease;

  &:not(.fixed) {
    position: relative;
  }

  &.is-resizing {
    user-select: none;
    transition: none;
  }
}

.nc-expanded-form-panel-resize-handle {
  @apply absolute left-0 top-0 h-full transition-colors cursor-col-resize;
  width: 4px;
  z-index: 50;

  &:hover {
    @apply bg-nc-border-gray-medium;
  }
}

.nc-expanded-form-panel.is-resizing .nc-expanded-form-panel-resize-handle {
  @apply bg-nc-border-gray-medium;
}

.nc-expanded-form-panel-display-value {
  @apply text-body font-bold text-nc-content-gray;
}

/* Slide-in from right */
.nc-slide-right-enter-active {
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease;
}

.nc-slide-right-leave-active {
  transition: transform 0.2s cubic-bezier(0.4, 0, 1, 1), opacity 0.15s ease;
}

.nc-slide-right-enter-from {
  transform: translateX(100%);
  opacity: 0;
}

.nc-slide-right-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
</style>

<style lang="scss">
/* Thinner, subtler grid scrollbar when panel is open (panel is sibling of grid's parent) */
:has(> .nc-expanded-form-panel) .custom-scrollbar-track.vertical {
  width: 4px;
  background: transparent;
}

:has(> .nc-expanded-form-panel) .custom-scrollbar-thumb.vertical {
  background: rgba(var(--rgb-base), 0.2);

  &:hover {
    background: rgba(var(--rgb-base), 0.4);
  }
}

:has(> .nc-expanded-form-panel) .custom-scrollbar-track.horizontal {
  height: 4px;
  background: transparent;
}

:has(> .nc-expanded-form-panel) .custom-scrollbar-thumb.horizontal {
  background: rgba(var(--rgb-base), 0.2);

  &:hover {
    background: rgba(var(--rgb-base), 0.4);
  }
}

/* Compact field labels — matching MiniColumnsWrapper pattern */
.nc-panel-fields-compact {
  .nc-expanded-cell-header {
    @apply !bg-transparent;

    .nc-cell-name-wrapper,
    .nc-virtual-cell-name-wrapper {
      @apply !px-0;

      .name.truncate {
        @apply flex items-center pl-1;

        span {
          @apply !text-xs font-weight-500 !leading-[14px];
        }
      }

      svg.nc-icon:not(.invisible):not(.nc-column-context-menu):not(.nc-column-lock-icon) {
        @apply !w-3.5 !h-3.5 !mx-0;
      }
    }
  }

  .nc-expanded-cell .flex-none {
    @apply !mb-0;
  }
}

/* Match grid canvas font (500 13px Inter) — needs high specificity to
 * override scoped Cell.vue styles that use [data-v-*] + !important */
.nc-expanded-form-panel .nc-expanded-form-row .nc-expanded-cell .nc-data-cell {
  font-size: 13px !important;
  font-weight: 500 !important;

  .nc-cell .nc-cell-field,
  .nc-cell .nc-cell-field-link,
  .nc-cell input,
  .nc-cell textarea,
  .nc-cell select,
  .nc-cell .ant-tag,
  .nc-cell .ant-select-selection-item,
  .nc-virtual-cell .nc-cell-field,
  .nc-virtual-cell .ant-tag,
  .nc-virtual-cell .ant-select-selection-item,
  .nc-virtual-cell input {
    font-size: 13px !important;
    font-weight: 500 !important;
  }
}

/* ViewModeSelector — match header icon size (14px) and reduce weight */
.nc-expanded-form-panel .tab-wrapper .tab .tab-icon {
  font-size: 0.875rem !important;
  width: 0.875rem !important;
  height: 0.875rem !important;
}

.nc-expanded-form-panel .tab-wrapper {
  @apply !h-6;
}

/* Disable grey hover on audit items in panel */
.nc-expanded-form-panel .group.hover\:bg-nc-bg-gray-light:hover {
  background-color: transparent !important;
}

/* Sidebar tabs — smaller font for Comments / Revision History */
.nc-expanded-form-panel .nc-comments-drawer .ant-tabs-tab {
  .flex.items-center {
    @apply !text-xs;

    svg {
      @apply !w-3.5 !h-3.5;
    }
  }
}

/* No shadow at rest, subtle shadow on hover */
.nc-expanded-form-panel .nc-data-cell {
  box-shadow: none !important;

  &:not(.nc-readonly-div-data-cell):not(.nc-system-field):not(.nc-virtual-cell-button):hover {
    box-shadow: 0px 0px 4px 0px rgba(var(--rgb-base), 0.12) !important;
  }
}
</style>
