<script setup lang="ts">
import type { TableType, ViewType } from 'nocodb-sdk'
import type { Ref } from 'vue'

const panelStore = useExpandedFormPanelOrThrow()

const {
  isOpen,
  activeRow,
  activeRowId,
  activeRowState,
  panelWidth,
  panelWidthCollapsed,
  panelWidthExpanded,
  isLoading,
  isFullscreen,
  activityExpanded,
  activeActivityTab,
  hasPrev,
  hasNext,
} = panelStore

const { closePanel, setFullscreen, navigatePrev, navigateNext, toggleActivity } = panelStore

const meta = inject(MetaInj, ref())

const isPublic = inject(IsPublicInj, ref(false))

const reloadViewDataTrigger = inject(ReloadViewDataHookInj, createEventHook())

const { isUIAllowed } = useRoles()

const { t } = useI18n()

const { isMobileMode } = useGlobal()

const panelRef = ref<HTMLElement>()

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
  const newWidth = Math.max(MIN_WIDTH, Math.min(getMaxWidth(), resizeStartWidth.value + delta))

  if (activityExpanded.value) {
    panelWidthExpanded.value = newWidth
  } else {
    panelWidthCollapsed.value = newWidth
  }
}

const onResizeEnd = () => {
  isResizing.value = false
  document.body.style.cursor = ''
  window.removeEventListener('mousemove', onResizeMove)
  window.removeEventListener('mouseup', onResizeEnd)
}

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onResizeMove)
  window.removeEventListener('mouseup', onResizeEnd)
})

const rowRef = computed(() => activeRow.value ?? { row: {}, oldRow: {}, rowMeta: {} } as Row)

const maintainDefaultViewOrder = ref(false)

const expandedFormStore = useProvideExpandedFormStore(
  meta as Ref<TableType>,
  rowRef as Ref<Row>,
  maintainDefaultViewOrder,
  false,
)

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

const { isSqlView } = useProvideSmartsheetStore(ref({}) as Ref<ViewType>, meta)

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
  activeRowId,
  async (newRowId) => {
    if (!newRowId || !isOpen.value) return

    if (activeRowState.value) {
      rowState.value = activeRowState.value
    } else {
      rowState.value = {}
    }

    await triggerRowLoad(newRowId)

    if (activityExpanded.value && activeActivityTab.value === 'audits') {
      await loadAudits(newRowId, false)
    }
  },
  { immediate: true },
)

const save = async () => {
  isSaving.value = true

  try {
    if (isNew.value) {
      await _save(rowState.value)
    } else {
      await _save()
      await _loadRow()
    }

    await reloadViewDataTrigger?.trigger()
  } catch (e: any) {
    if (isNew.value) {
      message.error(`Add row failed: ${await extractSdkResponseErrorMsg(e)}`)
    } else {
      message.error(`${t('msg.error.rowUpdateFailed')}: ${await extractSdkResponseErrorMsg(e)}`)
    }
  }

  isSaving.value = false
}

const showDiscardModal = ref(false)

const onClose = () => {
  if (changedColumns.value.size > 0) {
    showDiscardModal.value = true
  } else {
    closePanel()
  }
}

const discardAndClose = () => {
  clearColumns()
  showDiscardModal.value = false
  closePanel()
}

const saveAndClose = async () => {
  try {
    await save()
    showDiscardModal.value = false
    closePanel()
  } catch {
    // Save failed — keep panel open so user can retry
  }
}

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    if (isFullscreen.value) {
      setFullscreen(false)
    } else {
      onClose()
    }
  }

  if (!e.altKey) return

  if (e.key === 'ArrowUp') {
    e.preventDefault()
    navigatePrev()
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    navigateNext()
  } else if (e.code === 'KeyS') {
    e.preventDefault()
    if (!isSaveDisabled.value) save()
  }
}

const panelStyle = computed(() => {
  if (isFullscreen.value) {
    return {
      left: 'var(--mini-sidebar-width)',
      right: '0',
      top: '0',
      bottom: '0',
    }
  }
  return { width: `${panelWidth.value}px` }
})

const panelClasses = computed(() => {
  const base = [
    'nc-expanded-form-panel',
    'flex',
    'flex-col',
    'bg-nc-bg-default',
    'border-l',
    'border-nc-border-gray-medium',
  ]
  if (isResizing.value) base.push('is-resizing')
  if (isFullscreen.value) {
    base.push('fixed', 'top-0', 'z-50')
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
        class="flex items-center h-[var(--toolbar-height)] gap-2 px-3 py-2 border-b border-nc-border-gray-medium flex-shrink-0"
      >
        <!-- Display value -->
        <NcTooltip v-if="displayValue && !isNew" show-on-truncate-only class="truncate min-w-0 flex-1">
          <template #title>{{ displayValue }}</template>
          <span class="nc-expanded-form-panel-display-value truncate font-bold text-body text-nc-content-gray">
            {{ displayValue }}
          </span>
        </NcTooltip>
        <span v-else-if="isNew" class="truncate font-bold text-body text-nc-content-gray">
          {{ $t('activity.newRecord') }}
        </span>
        <div v-else class="flex-1" />

        <div class="flex-1" />

        <!-- Save -->
        <NcTooltip v-if="isUIAllowed('dataEdit', baseRoles) && !isSqlView" :title="isNew ? $t('general.create') : $t('general.save')">
          <NcButton
            v-e="['c:row-expand:save']"
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

        <!-- Row navigation -->
        <div v-if="!isNew" class="flex items-center gap-0.5">
          <NcTooltip :title="$t('labels.prevRow')">
            <NcButton
              size="xs"
              type="text"
              :disabled="!hasPrev"
              data-testid="nc-expanded-form-panel-prev"
              @click="navigatePrev"
            >
              <GeneralIcon icon="arrowUp" class="w-4 h-4" />
            </NcButton>
          </NcTooltip>
          <NcTooltip :title="$t('labels.nextRow')">
            <NcButton
              size="xs"
              type="text"
              :disabled="!hasNext"
              data-testid="nc-expanded-form-panel-next"
              @click="navigateNext"
            >
              <GeneralIcon icon="arrowDown" class="w-4 h-4" />
            </NcButton>
          </NcTooltip>
        </div>

        <!-- Fullscreen toggle -->
        <NcTooltip :title="isFullscreen ? $t('labels.exitFullscreen') : $t('labels.enterFullscreen')">
          <NcButton
            size="xs"
            type="text"
            data-testid="nc-expanded-form-panel-fullscreen"
            @click="setFullscreen(!isFullscreen)"
          >
            <GeneralIcon
              :icon="isFullscreen ? 'ncMinimize' : 'ncMaximize'"
              class="w-4 h-4"
              :class="{ 'text-nc-content-brand': isFullscreen }"
            />
          </NcButton>
        </NcTooltip>

        <!-- Close -->
        <NcTooltip :title="$t('general.close')">
          <NcButton
            size="xs"
            type="text"
            data-testid="nc-expanded-form-panel-close"
            @click="onClose"
          >
            <GeneralIcon icon="close" class="w-4 h-4" />
          </NcButton>
        </NcTooltip>
      </div>

      <!-- Fields (scrollable) -->
      <div class="flex-1 min-h-0 overflow-y-auto nc-scrollbar-thin">
        <div v-if="isLoading" class="flex items-center justify-center h-full">
          <GeneralLoader />
        </div>
        <SmartsheetExpandedFormPresentorsFieldsColumns
          v-else
          :fields="fields ?? []"
          :hidden-fields="hiddenFields"
          :is-loading="isLoading"
          force-vertical-mode
        />
      </div>

      <!-- Activity section (collapsible, pinned to bottom) -->
      <SmartsheetGridExpandedFormPanelActivity
        v-if="showActivity"
      />
    </div>
  </Transition>

  <!-- Fullscreen backdrop -->
  <Transition name="nc-fade">
    <div
      v-if="isOpen && isFullscreen && !isMobileMode"
      class="fixed top-0 bottom-0 right-0 bg-black/20 z-49 cursor-pointer"
      :style="{ left: 'var(--mini-sidebar-width)' }"
      @click="setFullscreen(false)"
    />
  </Transition>

  <!-- Discard changes modal -->
  <NcModal v-model:visible="showDiscardModal" size="xs">
    <div>
      <div class="flex flex-row items-center gap-x-2 text-base font-bold">
        {{ $t('tooltip.saveChanges') }}
      </div>
      <div class="flex font-medium mt-2">
        {{ $t('activity.doYouWantToSaveTheChanges') }}
      </div>
      <div class="flex flex-row justify-end gap-x-2 mt-5">
        <NcButton type="secondary" size="small" @click="discardAndClose">{{ $t('labels.discard') }}</NcButton>
        <NcButton type="primary" size="small" :loading="isSaving" @click="saveAndClose">
          {{ $t('tooltip.saveChanges') }}
        </NcButton>
      </div>
    </div>
  </NcModal>
</template>

<style lang="scss" scoped>
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

/* Field label overrides for panel's stacked layout */

/* Backdrop fade */
.nc-fade-enter-active,
.nc-fade-leave-active {
  transition: opacity 0.25s ease;
}

.nc-fade-enter-from,
.nc-fade-leave-to {
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

/* Field label overrides — unscoped to beat the global !important styles in expanded-form/index.vue */
.nc-expanded-form-panel .nc-expanded-cell-header {
  @apply !text-xs !text-nc-content-gray-subtle2 !font-weight-500;

  svg.nc-cell-icon,
  svg.nc-virtual-cell-icon {
    @apply !w-3 !h-3;
  }
}

.nc-expanded-form-panel .nc-expanded-cell-header > :nth-child(2) {
  @apply !text-xs;
}

.nc-expanded-form-panel .nc-expanded-cell-header > :first-child {
  @apply !text-xs !pl-1;
}

/* Reduce gap between field label and value */
.nc-expanded-form-panel .nc-expanded-cell .flex-none {
  @apply !mb-0.5;
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

/* No shadow at rest, subtle shadow on hover */
.nc-expanded-form-panel .nc-data-cell {
  box-shadow: none !important;

  &:not(.nc-readonly-div-data-cell):not(.nc-system-field):not(.nc-virtual-cell-button):hover {
    box-shadow: 0px 0px 4px 0px rgba(var(--rgb-base), 0.12) !important;
  }
}
</style>
