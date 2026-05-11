<script setup lang="ts">
const smartTextStore = useSmartTextOrThrow()

const {
  isOpen,
  isLoading,
  isSaving,
  isDirty,
  isFullscreen,
  panelWidth,
  pmContent,
  activeColumn,
  activeColumnId,
  activeRowId,
  smartTextColumns,
  activeDisplayValue,
  hasPrev,
  hasNext,
} = smartTextStore

const { closeEditor, flushSave, switchField, setFullscreen, setPmContent, navigatePrev, navigateNext } = smartTextStore

// When the expanded-record panel is also open it's hidden via v-show while
// SmartText is active. On close we want SmartText to vanish instantly so the
// EFP can fill the slot without an overlap window — the slide-out animation
// would keep SmartText slot-occupying for ~200ms, briefly squeezing the grid.
const expandedFormPanelStore = useExpandedFormPanel()
const isExpandedFormPanelOpen = computed(() => !!expandedFormPanelStore?.isOpen?.value)

const { t } = useI18n()
const view = inject(ActiveViewInj, ref())
const meta = inject(MetaInj, ref())
const isPublic = inject(IsPublicInj, ref(false))

const { base, isSharedBase } = storeToRefs(useBase())

// Provide cell context so the embedded doc editor's attachment proxy resolves
// image / file URLs via the cell-keyed endpoint instead of the doc-keyed one.
const cellAttachmentContext = computed(() => {
  if (!meta.value?.id || !activeColumnId.value || !activeRowId.value) return null
  return {
    tableId: meta.value.id,
    columnId: activeColumnId.value,
    rowId: activeRowId.value,
  }
})
provide(SmartTextCellAttachmentInj, cellAttachmentContext)

// Fullscreen mode covers everything to the right of the project sidebar.
// We measure the sidebar's actual right edge from the DOM rather than using
// the store width — Splitpanes sizes the pane by percentage, which doesn't
// always match the inner wrapper's pixel width.
const sidebarRightEdge = ref(0)
let sidebarObserver: ResizeObserver | null = null

const updateSidebarRightEdge = () => {
  const el = document.querySelector('.nc-sidebar-splitpane') as HTMLElement | null
  if (!el) {
    sidebarRightEdge.value = 0
    return
  }
  const rect = el.getBoundingClientRect()
  sidebarRightEdge.value = rect.right
}

// Shared view (`isPublic`) and shared base both render without the mini
// sidebar, so when the project sidebar is hidden the panel must hug the
// viewport edge instead of leaving a gap the width of the (absent) rail.
const hasMiniSidebar = computed(() => !isPublic.value && !isSharedBase.value)

const fullscreenLeft = computed(() => {
  if (sidebarRightEdge.value > 0) return `${sidebarRightEdge.value}px`
  return hasMiniSidebar.value ? 'var(--mini-sidebar-width)' : '0'
})

const panelRef = ref<HTMLElement>()

// ---- Resize handle (mirrors Doc field panel) -------------------------------
const isResizing = ref(false)
const resizeStartX = ref(0)
const resizeStartWidth = ref(0)
const MIN_WIDTH = 320

const getMaxWidth = () => {
  const containerWidth = panelRef.value?.parentElement?.clientWidth ?? 0
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
}

const onResizeStart = (e: MouseEvent) => {
  isResizing.value = true
  resizeStartX.value = e.clientX
  resizeStartWidth.value = panelWidth.value
  document.body.style.cursor = 'col-resize'
  window.addEventListener('mousemove', onResizeMove)
  window.addEventListener('mouseup', onResizeEnd)
}

// ---- Session-end save triggers ---------------------------------------------
// The doc Editor (mounted in cell mode) emits update:content on every edit;
// setPmContent stages the JSON in the store and marks isDirty. flushSave
// fires only on session-end events: panel close, field switch, row nav
// (handled inside the composable), Esc, tab hidden, beforeunload.
const onVisibilityChange = () => {
  if (document.hidden && isDirty.value) flushSave()
}
const onBeforeUnload = () => {
  if (isDirty.value) flushSave()
}

watch(
  isOpen,
  (open) => {
    if (open) {
      document.addEventListener('visibilitychange', onVisibilityChange)
      window.addEventListener('beforeunload', onBeforeUnload)
    } else {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  },
  { immediate: true },
)

// Track the sidebar's actual right edge while the panel is open in fullscreen.
// Use ResizeObserver on the sidebar element + window resize for viewport changes.
watch(
  [isOpen, isFullscreen],
  ([open, fs]) => {
    if (open && fs) {
      nextTick(() => {
        updateSidebarRightEdge()
        const el = document.querySelector('.nc-sidebar-splitpane') as HTMLElement | null
        if (el && 'ResizeObserver' in window) {
          sidebarObserver = new ResizeObserver(updateSidebarRightEdge)
          sidebarObserver.observe(el)
        }
        window.addEventListener('resize', updateSidebarRightEdge)
      })
    } else {
      sidebarObserver?.disconnect()
      sidebarObserver = null
      window.removeEventListener('resize', updateSidebarRightEdge)
    }
  },
  { immediate: true },
)

// Action menu copy-URL feedback timer — cleared on unmount and on each new
// copy. Declared here so onBeforeUnmount can reference it.
let copyResetTimer: ReturnType<typeof setTimeout> | null = null

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibilityChange)
  window.removeEventListener('beforeunload', onBeforeUnload)
  window.removeEventListener('mousemove', onResizeMove)
  window.removeEventListener('mouseup', onResizeEnd)
  sidebarObserver?.disconnect()
  sidebarObserver = null
  window.removeEventListener('resize', updateSidebarRightEdge)
  if (copyResetTimer) {
    clearTimeout(copyResetTimer)
    copyResetTimer = null
  }
})

// Save when focus leaves the panel body (covers blur from editor, dropdowns, etc.).
// During paste / clipboard interactions, focusout fires transiently with a null
// relatedTarget while focus is in flight back to the editor. Defer the check
// until after the focus transition settles by waiting one microtask and reading
// document.activeElement — that reflects the *final* next target.
const onPanelBlur = (e: FocusEvent) => {
  if (!panelRef.value) return
  const next = e.relatedTarget as Node | null
  if (next && panelRef.value.contains(next)) return

  setTimeout(() => {
    if (!panelRef.value) return
    if (panelRef.value.contains(document.activeElement)) return
    if (isDirty.value) flushSave()
  }, 0)
}

// ---- UI helpers ------------------------------------------------------------
const panelTitle = computed(() => activeColumn.value?.title || t('general.untitled'))

const onFieldSwitch = (columnId: string) => {
  if (columnId !== activeColumnId.value) switchField(columnId)
}

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    if (isFullscreen.value) setFullscreen(false)
    else closeEditor()
  }
}

const panelStyle = computed(() => {
  if (isFullscreen.value) {
    return { left: fullscreenLeft.value, right: '0', top: '0', bottom: '0' }
  }
  return { width: `${panelWidth.value}px` }
})

const panelClasses = computed(() => {
  const base = ['nc-smart-text-panel', 'flex', 'flex-col', 'bg-nc-bg-default', 'border-l', 'border-nc-border-gray-medium']
  if (isResizing.value) base.push('is-resizing')
  if (isFullscreen.value) base.push('fixed', 'top-0', 'z-50', 'nc-smart-text-fullscreen')
  else base.push('flex-shrink-0', 'h-full')
  return base
})

const saveStatusLabel = computed(() => {
  if (isSaving.value) return t('general.saving')
  if (isDirty.value) return t('labels.unsavedChanges')
  return ''
})

// Stable initial content for the editor mount. Updates flow via the watcher
// inside DocEditor (cell mode) which compares against current JSON.
const editorInitialContent = computed(() => pmContent.value ?? null)

const onEditorContentUpdate = (content: Record<string, any>) => {
  setPmContent(content)
}

// ---- Action menu: copy URL + download as ----------------------------------
const docEditorRef = ref<{ editor: Ref<any> } | null>(null)

const { appInfo } = useGlobal()

const tiptapEditor = computed(() => docEditorRef.value?.editor as any)

const exportTitle = computed(() => activeDisplayValue.value || activeColumn.value?.title || 'Untitled')

const cellImageUrlBuilder = (fileRefId: string) => {
  const baseId = base.value?.id
  const tableId = activeColumn.value?.fk_model_id
  const colId = activeColumnId.value
  const rowId = activeRowId.value
  if (!baseId || !tableId || !colId || !rowId) return ''
  return `${appInfo.value.ncSiteUrl}/api/v2/data/bases/${baseId}/tables/${tableId}/columns/${colId}/rows/${encodeURIComponent(
    rowId,
  )}/attachment/${encodeURIComponent(fileRefId)}`
}

const { downloadMarkdown, downloadHTML, downloadPDF } = useDocumentExport({
  editor: tiptapEditor,
  title: exportTitle,
  imageUrlBuilder: cellImageUrlBuilder,
})

const { copy } = useCopy()

const isActionsMenuOpen = ref(false)
const isUrlCopied = ref(false)

const onCopyUrl = async () => {
  try {
    await copy(window.location.href)
    isUrlCopied.value = true
    if (copyResetTimer) clearTimeout(copyResetTimer)
    copyResetTimer = setTimeout(() => {
      isUrlCopied.value = false
      isActionsMenuOpen.value = false
      copyResetTimer = null
    }, 1200)
  } catch {
    message.error(t('msg.error.copyToClipboardError'))
  }
}

const onDownloadMarkdown = () => downloadMarkdown()
const onDownloadHTML = () => downloadHTML()
const onDownloadPDF = () => downloadPDF()
</script>

<template>
  <Transition :css="!isExpandedFormPanelOpen" name="nc-slide-right" @after-enter="panelRef?.focus()">
    <div
      v-if="isOpen"
      ref="panelRef"
      tabindex="-1"
      :class="panelClasses"
      :style="panelStyle"
      data-testid="nc-smart-text-panel"
      @keydown="onKeydown"
      @focusout="onPanelBlur"
    >
      <!-- Resize handle (left edge) -->
      <div
        v-if="!isFullscreen"
        class="nc-smart-text-panel-resize-handle"
        data-testid="nc-smart-text-panel-resize"
        @mousedown.prevent="onResizeStart"
      />

      <!-- Header -->
      <div class="flex items-center h-[var(--toolbar-height)] gap-2 px-3 py-2 border-b border-nc-border-gray-medium flex-shrink-0">
        <div
          v-if="isFullscreen"
          class="flex items-center gap-2 text-bodyDefaultSm font-medium text-nc-content-gray-subtle2 leading-normal min-w-0"
        >
          <template v-if="view?.title">
            <NcTooltip show-on-truncate-only class="truncate max-w-40">
              <template #title>{{ view.title }}</template>
              {{ view.title }}
            </NcTooltip>
            <span class="flex-shrink-0">·</span>
          </template>
          <template v-if="activeDisplayValue">
            <NcTooltip show-on-truncate-only class="truncate max-w-40">
              <template #title>{{ activeDisplayValue }}</template>
              {{ activeDisplayValue }}
            </NcTooltip>
            <span class="flex-shrink-0">·</span>
          </template>
        </div>

        <NcDropdown v-if="smartTextColumns.length > 1" placement="bottomLeft">
          <NcButton size="xs" type="text" class="!px-1">
            <div class="flex items-center gap-2 text-nc-content-gray">
              <GeneralIcon icon="ncFileText" class="w-4 h-4" />
              <span class="text-bodyDefaultSm font-medium truncate max-w-48 leading-normal">{{ panelTitle }}</span>
              <GeneralIcon icon="arrowDown" class="w-3 h-3" />
            </div>
          </NcButton>
          <template #overlay>
            <NcMenu>
              <NcMenuItem
                v-for="col in smartTextColumns"
                :key="col.id"
                :class="{ '!text-nc-content-brand': col.id === activeColumnId }"
                @click="onFieldSwitch(col.id!)"
              >
                <div class="flex items-center gap-2">
                  <GeneralIcon icon="ncFileText" class="w-4 h-4" />
                  <span class="truncate">{{ col.title }}</span>
                </div>
              </NcMenuItem>
            </NcMenu>
          </template>
        </NcDropdown>
        <div v-else class="flex items-center gap-2 text-nc-content-gray-subtle px-1">
          <GeneralIcon icon="ncFileText" class="w-4 h-4" />
          <span class="text-bodyDefaultSm font-medium truncate max-w-48 leading-normal">{{ panelTitle }}</span>
        </div>

        <!-- Save status -->
        <span v-if="saveStatusLabel" class="text-captionSm text-nc-content-gray-muted" data-testid="nc-smart-text-save-status">
          {{ saveStatusLabel }}
        </span>

        <div class="flex-1" />

        <div class="flex items-center gap-0.5">
          <NcTooltip :title="$t('labels.prevRow')">
            <NcButton
              size="xs"
              type="text"
              :disabled="!hasPrev"
              :aria-label="$t('labels.prevRow')"
              data-testid="nc-smart-text-panel-prev"
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
              :aria-label="$t('labels.nextRow')"
              data-testid="nc-smart-text-panel-next"
              @click="navigateNext"
            >
              <GeneralIcon icon="arrowDown" class="w-4 h-4" />
            </NcButton>
          </NcTooltip>
        </div>

        <NcTooltip :title="isFullscreen ? $t('labels.exitFullscreen') : $t('labels.enterFullscreen')">
          <NcButton
            size="xs"
            type="text"
            :aria-label="isFullscreen ? $t('labels.exitFullscreen') : $t('labels.enterFullscreen')"
            data-testid="nc-smart-text-panel-fullscreen"
            @click="setFullscreen(!isFullscreen)"
          >
            <GeneralIcon
              :icon="isFullscreen ? 'ncMinimize' : 'ncMaximize'"
              class="w-4 h-4"
              :class="{ 'text-nc-content-brand': isFullscreen }"
            />
          </NcButton>
        </NcTooltip>

        <NcDropdown v-model:visible="isActionsMenuOpen" placement="bottomRight">
          <NcButton size="xs" type="text" :aria-label="$t('general.actions')" data-testid="nc-smart-text-panel-more">
            <GeneralIcon icon="ncMoreVertical" class="w-4 h-4" />
          </NcButton>
          <template #overlay>
            <NcMenu variant="small">
              <NcMenuItem data-testid="nc-smart-text-panel-copy-url" @click.stop="onCopyUrl">
                <GeneralIcon
                  :icon="isUrlCopied ? 'check' : 'ncCopy'"
                  :class="isUrlCopied ? 'text-nc-content-green-medium' : 'text-nc-content-gray-subtle'"
                />
                {{ isUrlCopied ? $t('general.copied') : $t('activity.copyUrl') }}
              </NcMenuItem>
              <NcSubMenu key="download" variant="small">
                <template #title>
                  <GeneralIcon class="text-nc-content-gray-subtle" icon="download" />
                  {{ $t('general.downloadAs') }}
                </template>
                <NcMenuItem data-testid="nc-smart-text-panel-download-md" @click="onDownloadMarkdown">
                  <GeneralIcon icon="ncHash" />
                  {{ $t('general.markdown') }}
                </NcMenuItem>
                <NcMenuItem data-testid="nc-smart-text-panel-download-html" @click="onDownloadHTML">
                  <GeneralIcon icon="code" />
                  {{ $t('general.html') }}
                </NcMenuItem>
                <NcMenuItem data-testid="nc-smart-text-panel-download-pdf" @click="onDownloadPDF">
                  <GeneralIcon icon="pdfFile" />
                  {{ $t('general.pdf') }}
                </NcMenuItem>
              </NcSubMenu>
            </NcMenu>
          </template>
        </NcDropdown>

        <NcTooltip :title="$t('general.close')">
          <NcButton
            size="xs"
            type="text"
            :aria-label="$t('general.close')"
            data-testid="nc-smart-text-panel-close"
            @click="closeEditor"
          >
            <GeneralIcon icon="close" class="w-4 h-4" />
          </NcButton>
        </NcTooltip>
      </div>

      <!-- Body — full noco-docs editor in cell mode -->
      <div class="flex-1 min-h-0 overflow-hidden">
        <div v-if="isLoading" class="flex items-center justify-center h-full">
          <GeneralLoader />
        </div>
        <div v-else class="h-full overflow-auto">
          <LazyDocEditor
            ref="docEditorRef"
            mode="cell"
            embedded
            :initial-content="editorInitialContent"
            @update:content="onEditorContentUpdate"
          />
        </div>
      </div>
    </div>
  </Transition>

  <Transition name="nc-fade">
    <div
      v-if="isOpen && isFullscreen"
      class="fixed top-0 bottom-0 right-0 bg-black/20 z-49 cursor-pointer"
      :style="{ left: fullscreenLeft }"
      @click="setFullscreen(false)"
    />
  </Transition>
</template>

<style lang="scss" scoped>
.nc-smart-text-panel {
  outline: none;

  &:not(.fixed) {
    position: relative;
  }

  &.is-resizing {
    user-select: none;
  }
}

.nc-smart-text-panel-resize-handle {
  @apply absolute left-0 top-0 h-full transition-colors;
  width: 4px;
  z-index: 50;

  &:hover {
    @apply bg-nc-border-gray-medium;
  }
}

.nc-smart-text-panel.is-resizing .nc-smart-text-panel-resize-handle {
  @apply bg-nc-border-gray-medium;
}

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

.nc-fade-enter-active,
.nc-fade-leave-active {
  transition: opacity 0.25s ease;
}

.nc-fade-enter-from,
.nc-fade-leave-to {
  opacity: 0;
}
</style>
