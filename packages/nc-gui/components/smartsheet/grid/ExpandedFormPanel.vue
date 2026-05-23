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

const { requestSwitch } = panelStore

const meta = inject(MetaInj, ref())

const view = inject(ActiveViewInj, ref())

const isPublic = inject(IsPublicInj, ref(false))

const reloadViewDataTrigger = inject(ReloadViewDataHookInj, createEventHook())

const { isUIAllowed } = useRoles()

const { $e } = useNuxtApp()

const { appInfo, isMobileMode } = useGlobal()

const panelRef = ref<HTMLElement>()

const activeViewMode = ref(ExpandedFormMode.FIELD)

const isResizing = ref(false)
const resizeStartX = ref(0)
const resizeStartWidth = ref(0)

const MIN_WIDTH = 320

const getMaxWidth = () => {
  // The panel sits inside a `display: contents` wrapper in Smartsheet.vue
  // (kept so toggling SmartText visibility doesn't remount the panel). Such
  // a wrapper has clientWidth 0, which would clamp the panel to MIN_WIDTH
  // on the first drag. Walk past contents-display ancestors to the real
  // flex container.
  let el = panelRef.value?.parentElement as HTMLElement | null
  while (el && getComputedStyle(el).display === 'contents') {
    el = el.parentElement
  }
  const containerWidth = el?.clientWidth ?? 0
  return Math.max(MIN_WIDTH, Math.floor(containerWidth * 0.6))
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

const onResizeStart = (e: MouseEvent) => {
  isResizing.value = true
  resizeStartX.value = e.clientX
  resizeStartWidth.value = panelWidth.value
  document.body.style.cursor = 'col-resize'

  window.addEventListener('mousemove', onResizeMove)
  window.addEventListener('mouseup', onResizeEnd)
}

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onResizeMove)
  window.removeEventListener('mouseup', onResizeEnd)
  document.removeEventListener('keydown', onDocumentKeydownCapture, true)
  document.removeEventListener('keydown', onDocumentKeydown)
  document.removeEventListener('focusin', trackPanelFocus, true)
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
  isSaving,
  loadRow: _loadRow,
  primaryKey,
  row: _row,
  save: _save,
  formatSaveError,
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

const route = useRoute()

// Deep-links like ?rowId=2&commentId=… should surface the Comments tab so the
// linked comment is visible. SidebarComments handles the scroll/highlight +
// URL cleanup itself, but only once it's actually mounted — which happens
// only when activityExpanded is true and the tab is 'comments'.
// Watch commentId too so clicking another notification while the panel is
// already open also flips to Comments.
watch(
  [isOpen, () => route.query.commentId],
  ([open, commentId]) => {
    if (open && commentId) {
      activeActivityTab.value = 'comments'
      activityExpanded.value = true
    }
  },
  { immediate: true },
)

watch([() => activityExpanded.value, () => activeActivityTab.value], async ([expanded, tab]) => {
  if (!isOpen.value || !expanded || !primaryKey.value) return

  if (tab === 'comments') {
    await loadComments(primaryKey.value, false)
  } else if (tab === 'audits') {
    await loadAudits(primaryKey.value, false)
  }
})

const isSaveDisabled = computed(() => {
  // Enable save whenever there's anything to commit: explicit cell edits OR
  // a freshly duplicated row (`rowMeta.new` is set by MoreOptionsMenu's
  // duplicate handler — it replaces the row wholesale, so `changedColumns`
  // stays empty even though the form holds unsaved data).
  return changedColumns.value.size === 0 && !isNew.value
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

    const wasUserNavigating = panelStore.isUserNavigating.value
    if (wasUserNavigating) {
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

    // Some cells emit update:model-value when their props re-bind to the
    // freshly-loaded row (value normalization on rebind), which spuriously
    // populates changedColumns and makes Save look enabled — also triggers
    // the discard modal on the next nav. Re-clear after the load settles so
    // a navigated-to row stays clean until the user actually edits.
    if (wasUserNavigating) {
      await nextTick()
      clearColumns()
    }

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
    message.error(await formatSaveError(e))
    return false
  } finally {
    isSaving.value = false
  }
}

// After duplicating a row, surface the fields view so the user can immediately
// edit the new record. Without this the panel can stay parked on Comments /
// Audits (side-panel) or Discussion / Attachments (fullscreen), where only the
// Save button is visible — the user has to manually find the Fields tab before
// they can change anything.
const onAfterDuplicate = () => {
  activityExpanded.value = false
  activeViewMode.value = ExpandedFormMode.FIELD
}

const showDiscardModal = ref(false)

// Pending action when the discard modal is showing. `null` = close panel.
// Each entry is a thunk so callers (canvas-driven row switch, keyboard prev/
// next) own their own navigation logic — the panel only decides when to fire
// it. Closures capture the target row/path at request time, which survives
// save()'s cache wipe.
const pendingAction = ref<(() => void) | null>(null)

const runPending = () => {
  const fn = pendingAction.value
  pendingAction.value = null
  if (fn) fn()
  else closePanel()
}

const onClose = () => {
  $e('c:row-expand-panel:close')
  if (changedColumns.value.size > 0) {
    pendingAction.value = null
    showDiscardModal.value = true
  } else {
    closePanel()
  }
}

const guardedNavigate = (direction: 'prev' | 'next') => {
  $e(`c:row-expand-panel:nav:${direction}`)
  if (changedColumns.value.size > 0) {
    pendingAction.value = direction === 'prev' ? navigatePrev : navigateNext
    showDiscardModal.value = true
    return
  }
  if (direction === 'prev') navigatePrev()
  else navigateNext()
}

const guardedSwitch = (perform: () => void) => {
  if (changedColumns.value.size > 0) {
    pendingAction.value = perform
    showDiscardModal.value = true
    return
  }
  perform()
}

// Register guarded variant so grid-driven row clicks surface the discard modal
// instead of silently overwriting unsaved edits. Reset on unmount so a stale
// closure isn't held by the store.
requestSwitch.value = guardedSwitch

onBeforeUnmount(() => {
  requestSwitch.value = (perform) => perform()
})

// Dismissing the modal (X / Escape / overlay click) without choosing Discard
// or Save & Continue clears the pending action — otherwise a later prompt
// would reuse stale state.
watch(showDiscardModal, (v) => {
  if (!v) pendingAction.value = null
})

const discardAndNavigate = () => {
  $e('c:row-expand-panel:discard')
  clearColumns()
  showDiscardModal.value = false
  runPending()
}

const saveAndContinue = async () => {
  $e('c:row-expand-panel:save-and-continue')
  const ok = await save()
  if (!ok) return // save failed — stay on current row so user can fix/retry
  showDiscardModal.value = false
  runPending()
}

const onKeydown = (e: KeyboardEvent) => {
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

// Document-level keydown handler — handles Escape (close panel) and Cmd/Ctrl+S
// (save) regardless of which descendant has focus. The per-element `@keydown`
// only fires when the EFP root has focus; ant-design inputs swallow Escape
// (blurs the input but stops propagation) and the browser's save-page dialog
// would steal Cmd+S without preventDefault — so a document-level listener is
// required to make these work from any field.
//
// Open dropdowns/pickers get a chance to close Escape first via bubble-phase
// ordering: by the time this handler fires, the picker has already closed and
// is no longer in the DOM, so the next Escape closes the panel.
function isPickerOrDropdownOpen() {
  // ant-design dropdowns / pickers / modals stay in the DOM after their first
  // open (Vue toggles them via display:none rather than unmount), so a class
  // selector alone catches stale "closed" instances. Read computed style to
  // determine if any are actually visible right now.
  const candidates = document.querySelectorAll(
    '.ant-picker-dropdown, .ant-select-dropdown, .ant-dropdown, .ant-modal-mask, .ant-popover',
  )
  for (const el of candidates) {
    const cs = window.getComputedStyle(el as Element)
    if (cs.display !== 'none' && cs.visibility !== 'hidden') return true
  }
  return false
}

// Visible, non-disabled focusables inside the panel — used by the Tab-trap fix
// to recover from the two known broken transitions (rate UL traps forward Tab;
// MultiSelect blur sends focus to BODY).
function getPanelFocusables(): HTMLElement[] {
  const panel = document.querySelector('.nc-expanded-form-panel') as HTMLElement | null
  if (!panel) return []
  const candidates = panel.querySelectorAll<HTMLElement>(
    'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled]), [contenteditable="true"]',
  )
  return Array.from(candidates).filter((el) => {
    if (el.offsetParent === null) return false
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return false
    return true
  })
}

// Last focusable that held focus inside the panel — needed because some widgets
// (ant-select, ant-rate) blur to document.body on Tab, losing the position
// info the trap needs to advance correctly. We restore it from this snapshot.
const lastFocusedInPanel = ref<HTMLElement | null>(null)
function trackPanelFocus(e: FocusEvent) {
  const panel = panelRef.value
  const target = e.target as HTMLElement | null
  if (!panel || !target) return
  if (target === panel) return
  if (!panel.contains(target)) return
  lastFocusedInPanel.value = target
}

// Capture-phase shortcuts — these need to run BEFORE focused widgets get a
// chance to stopPropagation(). Number inputs and ant-design widgets eat Alt
// modifier events on bubble phase.
function onDocumentKeydownCapture(e: KeyboardEvent) {
  // Cmd+S / Ctrl+S — save the panel. Always preventDefault so the browser's
  // save-page dialog never appears while the panel is open.
  const cmdOrCtrl = isMac() ? e.metaKey : e.ctrlKey
  if (cmdOrCtrl && e.code === 'KeyS') {
    e.preventDefault()
    if (!isSaveDisabled.value) save()
    return
  }

  // Cmd+Enter / Ctrl+Enter — also save, regardless of focused field.
  if (cmdOrCtrl && e.key === 'Enter') {
    e.preventDefault()
    if (!isSaveDisabled.value) save()
    return
  }

  // Alt+ArrowUp / Alt+ArrowDown — navigate to prev/next row from any focused
  // field. Caught in capture phase because number inputs and select widgets
  // call stopPropagation on Alt-arrows during bubble.
  //
  // Only intervene when the user's interaction intent is on the panel — if
  // they clicked a grid cell, Alt+Arrow may be a grid shortcut (e.g. Alt+R for
  // add row) or just stray, but it's not EFP navigation.
  if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    if (!isExpandedFormPanelOpen()) return
    e.preventDefault()
    guardedNavigate(e.key === 'ArrowUp' ? 'prev' : 'next')
  }
}

// Bubble-phase handler — runs AFTER widgets have had a chance to handle the
// event. Used for Escape (so open pickers/modals close first) and Tab-trap
// recovery (so widgets do their own Tab handling before we intervene).
function onDocumentKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (isPickerOrDropdownOpen()) return
    // Only close the panel via Escape when the user's intent is on the panel.
    // If they were interacting with the grid (clicked a cell), Escape belongs
    // to grid — exits cell edit / clears selection.
    if (!isExpandedFormPanelOpen()) return
    if (isFullscreen.value) {
      setFullscreen(false)
      activeViewMode.value = ExpandedFormMode.FIELD
      // Refocus panel root and reaffirm panel intent so the NEXT Escape
      // closes the panel — without this, fullscreen exit can leave focus on
      // a transient wrapper element with intent flag unclear, and the user
      // has to click into the panel before the second Escape works.
      panelRef.value?.focus()
      markExpandedFormPanelFocus()
    } else {
      onClose()
    }
    return
  }

  // Tab-trap recovery — three distinct broken-transition cases:
  // 1. Focus already on BODY (e.g. ant-select blur after MultiSelect already
  //    fired) — pull focus back into the panel.
  // 2. Focus on the rate UL (ant-rate consumes Tab without releasing) —
  //    advance past it.
  // 3. Forward Tab from the LAST focusable / backward Tab from the FIRST —
  //    natural browser behavior would escape to BODY (or to elements outside
  //    the panel) since there's no next/previous tab-stop in document order.
  //    Preempt this and wrap within the panel.
  //
  // Only intervene when the user's interaction intent is on the panel. If they
  // most recently clicked a grid cell (intent = grid), Tab belongs to grid
  // navigation and we must not hijack it.
  if (e.key !== 'Tab') return
  if (!isExpandedFormPanelOpen()) return
  const panel = panelRef.value
  if (!panel) return
  const active = document.activeElement as HTMLElement | null

  const onBody = active === document.body
  const onRateTrap = !!active && active.tagName === 'UL' && active.classList.contains('ant-rate')
  const inPanel = !!active && panel.contains(active)

  if (!onBody && !onRateTrap && !inPanel) return

  const focusables = getPanelFocusables()
  if (focusables.length === 0) return

  if (onBody) {
    e.preventDefault()
    // Resume from the last focused element inside the panel, if we have one —
    // forward Tab → next, Shift+Tab → previous. Falls back to first/last when
    // we have no anchor (e.g. focus came from outside the page).
    const last = lastFocusedInPanel.value
    const lastIdx = last ? focusables.indexOf(last) : -1
    if (lastIdx === -1) {
      const fallback = e.shiftKey ? focusables[focusables.length - 1]! : focusables[0]!
      fallback.focus()
      return
    }
    const nextIdx = e.shiftKey
      ? lastIdx > 0
        ? lastIdx - 1
        : focusables.length - 1
      : lastIdx < focusables.length - 1
      ? lastIdx + 1
      : 0
    focusables[nextIdx]!.focus()
    return
  }

  // Find current focusable's index. For rate UL, it IS in the focusables list.
  // For other in-panel elements, also find their index — needed to detect
  // whether the next browser-tab-stop would escape the panel.
  const currentIdx = focusables.indexOf(active!)
  if (currentIdx === -1) return

  const isLast = currentIdx === focusables.length - 1
  const isFirst = currentIdx === 0

  // Natural browser Tab from in-panel element only escapes when we're at the
  // boundary (last for forward, first for backward). Otherwise let the browser
  // handle it — except for the rate trap which always needs intervention.
  const wouldEscape = (!e.shiftKey && isLast) || (e.shiftKey && isFirst)
  if (!onRateTrap && !wouldEscape) return

  e.preventDefault()
  const nextIdx = e.shiftKey
    ? currentIdx > 0
      ? currentIdx - 1
      : focusables.length - 1
    : currentIdx < focusables.length - 1
    ? currentIdx + 1
    : 0
  focusables[nextIdx]!.focus()
}

watch(
  isOpen,
  (open) => {
    if (open) {
      document.addEventListener('keydown', onDocumentKeydownCapture, true)
      document.addEventListener('keydown', onDocumentKeydown)
      document.addEventListener('focusin', trackPanelFocus, true)
    } else {
      document.removeEventListener('keydown', onDocumentKeydownCapture, true)
      document.removeEventListener('keydown', onDocumentKeydown)
      document.removeEventListener('focusin', trackPanelFocus, true)
      lastFocusedInPanel.value = null
    }
  },
  { immediate: true },
)

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

const useEeFullscreenSelector = computed(() => isFullscreen.value && appInfo.value.ee)
</script>

<template>
  <Transition
    name="nc-slide-right"
    @after-enter="
      () => {
        panelRef?.focus()
        markExpandedFormPanelFocus()
      }
    "
  >
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
        class="flex items-center h-[var(--toolbar-height)] gap-1 px-3 py-2 border-b border-nc-border-gray-medium flex-shrink-0"
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
            class="!px-1"
            data-testid="nc-expanded-form-save"
            type="primary"
            size="xs"
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
              class="!border-0 !px-1"
              data-testid="nc-expanded-form-prev"
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
              class="!border-0 !px-1"
              data-testid="nc-expanded-form-next"
              @click="guardedNavigate('next')"
            >
              <GeneralIcon icon="arrowDown" class="w-3.5 h-3.5" />
            </NcButton>
          </NcTooltip>
        </div>

        <!-- EE fullscreen: Fields / Attachments / Discussion. CE fullscreen
             uses the activity pill below instead. -->
        <SmartsheetExpandedFormViewModeSelector
          v-if="useEeFullscreenSelector"
          v-model="activeViewMode"
          :view="view"
          class="nc-expanded-form-mode-switch"
        />

        <!-- Activity pill — side-panel mode in any edition, plus CE fullscreen. -->
        <div
          v-if="showActivity && !useEeFullscreenSelector"
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

        <div class="flex items-center gap-1">
          <SmartsheetExpandedFormMoreOptionsMenu
            :is-loading="isLoading"
            :view="view"
            :row-id="activeRowId ?? undefined"
            compact
            @after-delete="closePanel"
            @duplicate-applied="onAfterDuplicate"
          />
          <NcTooltip :title="isFullscreen ? $t('labels.exitFullscreen') : $t('labels.enterFullscreen')">
            <NcButton
              v-e="[`c:row-expand-panel:${isFullscreen ? 'exit' : 'enter'}-fullscreen`]"
              size="xs"
              :type="isFullscreen ? 'primary' : 'text'"
              data-testid="nc-expanded-form-panel-fullscreen"
              class="!px-1"
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
              data-testid="nc-expanded-form-close"
              class="!px-1"
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

        <!-- EE fullscreen: presentor-driven (Fields / Attachments / Discussion) -->
        <template v-else-if="useEeFullscreenSelector">
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

        <!-- Side-panel (any edition) or CE fullscreen — activity-pill driven.
             Same content components in both layouts; only width differs. -->
        <template v-else>
          <div class="h-full overflow-y-auto nc-scrollbar-thin">
            <template v-if="activityExpanded && activeActivityTab === 'comments'">
              <SmartsheetExpandedFormSidebarComments />
            </template>
            <template v-else-if="activityExpanded && activeActivityTab === 'audits'">
              <SmartsheetExpandedFormSidebarAudits />
            </template>
            <!-- CE fullscreen uses the wide PresentorsFields layout for the
                 Fields tab; side-panel mode uses the compact FieldsColumns. -->
            <SmartsheetExpandedFormPresentorsFields
              v-else-if="isFullscreen"
              :row-id="primaryKey"
              :fields="fields ?? []"
              :hidden-fields="hiddenFields"
              :is-unsaved-duplicated-record-exist="false"
              :is-unsaved-form-exist="false"
              :is-loading="isLoading"
              :is-saving="isSaving"
            />
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

  <SmartsheetExpandedFormDiscardChangesModal
    v-model="showDiscardModal"
    :loading="isSaving"
    @discard="discardAndNavigate"
    @save-and-continue="saveAndContinue"
  />
</template>

<style lang="scss" scoped>
.nc-panel-mode-tab {
  @apply flex flex-row items-center h-full justify-center px-2 border-1 border-t-0 border-b-0 border-nc-border-gray-medium text-nc-content-gray-subtle2 cursor-pointer transition-all duration-300 select-none;

  &.active {
    @apply bg-nc-bg-brand-inverted text-nc-content-brand-disabled;
    box-shadow: 0px 3px 1px -2px rgba(0, 0, 0, 0.06), 0px 5px 3px -2px rgba(0, 0, 0, 0.02);
  }

  &:not(.active) {
    @apply hover:text-nc-content-gray-extreme;
  }
}

/* Edge tabs need no side border. :first-child / :last-child on the tab itself
   doesn't work — each tab is wrapped in an NcTooltip, so every tab is the
   first-and-only child of its own wrapper. Target via the pill parent. */
.nc-panel-mode-selector > :first-child .nc-panel-mode-tab,
.nc-panel-mode-selector > :last-child .nc-panel-mode-tab {
  @apply border-0;
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

/* Match nc-panel-mode-selector pill height (28px) so the header tabs look
   identical between fullscreen (ViewModeSelector) and side-panel (activity
   selector) modes. ViewModeSelector defaults to h-7, but keep the rule for
   defensiveness against upstream changes. */
.nc-expanded-form-panel .tab-wrapper {
  @apply !h-7;
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
