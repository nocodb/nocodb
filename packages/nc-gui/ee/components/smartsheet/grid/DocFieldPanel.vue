<script setup lang="ts">
const docFieldStore = useDocFieldOrThrow()

const {
  isOpen,
  docId,
  mode,
  panelWidth,
  isLoading,
  isPinned,
  isFullscreen,
  activeColumn,
  docColumns,
  activeRowId,
  activeColumnId,
} = docFieldStore

const { closeDoc, switchField, togglePin, setFullscreen } = docFieldStore

const meta = inject(MetaInj, ref())

const { t } = useI18n()

const panelRef = ref<HTMLElement>()

const isResizing = ref(false)
const resizeStartX = ref(0)
const resizeStartWidth = ref(0)

const MIN_WIDTH = 320
const MAX_WIDTH = 800

const panelTitle = computed(() => {
  return activeColumn.value?.title || t('general.untitled')
})

const panelSubtitle = computed(() => {
  const tableName = meta.value?.title || ''
  const rowId = activeRowId.value || ''
  if (!tableName) return rowId
  return rowId ? `${tableName} · Row ${rowId}` : tableName
})

const onResizeStart = (e: MouseEvent) => {
  isResizing.value = true
  resizeStartX.value = e.clientX
  resizeStartWidth.value = panelWidth.value

  window.addEventListener('mousemove', onResizeMove)
  window.addEventListener('mouseup', onResizeEnd)
}

const onResizeMove = (e: MouseEvent) => {
  if (!isResizing.value) return
  const delta = resizeStartX.value - e.clientX
  const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, resizeStartWidth.value + delta))
  panelWidth.value = newWidth
}

const onResizeEnd = () => {
  isResizing.value = false
  window.removeEventListener('mousemove', onResizeMove)
  window.removeEventListener('mouseup', onResizeEnd)
}

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onResizeMove)
  window.removeEventListener('mouseup', onResizeEnd)
})

const onFieldSwitch = (columnId: string) => {
  if (columnId !== activeColumnId.value) {
    switchField(columnId)
  }
}

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    if (isFullscreen.value) {
      setFullscreen(false)
    } else {
      closeDoc()
    }
  }
}

watch(isOpen, (val) => {
  if (val) {
    nextTick(() => panelRef.value?.focus())
  }
})

const panelStyle = computed(() => {
  if (isFullscreen.value) {
    return {
      left: 'var(--mini-sidebar-width)',
      width: 'calc(100vw - var(--mini-sidebar-width))',
      height: '100vh',
    }
  }
  return { width: `${panelWidth.value}px` }
})

const panelClasses = computed(() => {
  const base = ['nc-doc-field-panel', 'flex', 'flex-col', 'bg-nc-bg-default', 'border-l', 'border-nc-border-gray-medium']
  if (isResizing.value) base.push('is-resizing')
  if (isFullscreen.value) {
    base.push('fixed', 'top-0', 'z-50')
  } else if (isPinned.value) {
    base.push('flex-shrink-0', 'h-full')
  } else {
    base.push('absolute', 'right-0', 'top-0', 'h-full', 'z-40', 'shadow-lg')
  }
  return base
})
</script>

<template>
  <div
    v-if="isOpen"
    ref="panelRef"
    tabindex="-1"
    :class="panelClasses"
    :style="panelStyle"
    data-testid="nc-doc-field-panel"
    @keydown="onKeydown"
  >
    <!-- Resize handle (left edge) -->
    <div
      v-if="!isFullscreen"
      class="nc-doc-field-panel-resize-handle"
      data-testid="nc-doc-field-panel-resize"
      @mousedown.prevent="onResizeStart"
    />

    <!-- Header -->
    <div class="flex items-center gap-2 px-3 py-2 border-b border-nc-border-gray-medium flex-shrink-0">
      <!-- Field switcher -->
      <NcDropdown v-if="docColumns.length > 1" placement="bottomLeft">
        <NcButton size="xs" type="text" class="!px-1">
          <div class="flex items-center gap-1 text-nc-content-gray">
            <GeneralIcon icon="ncFileText" class="w-4 h-4" />
            <span class="text-bodySm font-medium truncate max-w-32">{{ panelTitle }}</span>
            <GeneralIcon icon="arrowDown" class="w-3 h-3" />
          </div>
        </NcButton>
        <template #overlay>
          <NcMenu>
            <NcMenuItem
              v-for="col in docColumns"
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
      <div v-else class="flex items-center gap-1 text-nc-content-gray-subtle px-1">
        <GeneralIcon icon="ncFileText" class="w-4 h-4" />
        <span class="text-bodySm font-medium truncate max-w-32">{{ panelTitle }}</span>
      </div>

      <div class="flex-1" />

      <!-- Toolbar buttons -->
      <NcTooltip :title="isPinned ? $t('general.unpin') : $t('general.pin')">
        <NcButton
          size="xs"
          type="text"
          :aria-label="isPinned ? $t('general.unpin') : $t('general.pin')"
          :class="{ '!text-nc-content-brand': isPinned }"
          data-testid="nc-doc-field-panel-pin"
          @click="togglePin"
        >
          <GeneralIcon :icon="isPinned ? 'ncPinOff' : 'ncPin'" class="w-4 h-4" />
        </NcButton>
      </NcTooltip>

      <NcTooltip :title="isFullscreen ? $t('labels.exitFullscreen') : $t('labels.enterFullscreen')">
        <NcButton
          size="xs"
          type="text"
          :aria-label="isFullscreen ? $t('labels.exitFullscreen') : $t('labels.enterFullscreen')"
          data-testid="nc-doc-field-panel-fullscreen"
          @click="setFullscreen(!isFullscreen)"
        >
          <GeneralIcon :icon="isFullscreen ? 'ncMinimize' : 'ncMaximize'" class="w-4 h-4" />
        </NcButton>
      </NcTooltip>

      <NcTooltip :title="$t('general.close')">
        <NcButton
          size="xs"
          type="text"
          :aria-label="$t('general.close')"
          data-testid="nc-doc-field-panel-close"
          @click="closeDoc"
        >
          <GeneralIcon icon="close" class="w-4 h-4" />
        </NcButton>
      </NcTooltip>
    </div>

    <!-- Subtitle -->
    <div class="px-4 py-2 border-b border-nc-border-gray-light flex-shrink-0">
      <NcTooltip show-on-truncate-only class="text-captionSm text-nc-content-gray-subtle2 truncate block">
        <template #title>{{ panelSubtitle }}</template>
        {{ panelSubtitle }}
      </NcTooltip>
    </div>

    <!-- Body -->
    <div class="flex-1 min-h-0 overflow-hidden">
      <div v-if="isLoading" class="flex items-center justify-center h-full">
        <GeneralLoader />
      </div>
      <div v-else-if="docId" class="h-full overflow-auto">
        <LazyDocEditor :key="docId" :doc-id="docId" />
      </div>
      <div v-else class="flex items-center justify-center h-full text-nc-content-gray-subtle2">
        {{ t('msg.docFieldEmpty') }}
      </div>
    </div>
  </div>

  <!-- Fullscreen backdrop -->
  <div
    v-if="isOpen && isFullscreen"
    class="fixed top-0 bottom-0 right-0 bg-black/20 z-49 cursor-pointer"
    :style="{ left: 'var(--mini-sidebar-width)' }"
    @click="setFullscreen(false)"
  />
</template>

<style lang="scss" scoped>
.nc-doc-field-panel {
  outline: none;

  &:not(.fixed):not(.is-resizing) {
    transition: width 0.15s ease;
  }
}

.nc-doc-field-panel-resize-handle {
  @apply absolute top-0 h-full z-10 cursor-col-resize transition-colors;
  left: -4px;
  width: 8px;

  &:hover,
  &:active {
    @apply bg-nc-fill-primary;
  }
}
</style>
