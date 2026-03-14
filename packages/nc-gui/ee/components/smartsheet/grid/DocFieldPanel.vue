<script setup lang="ts">
const docFieldStore = useDocFieldOrThrow()

const {
  isOpen,
  docId,
  mode,
  panelWidth,
  isLoading,
  isFullscreen,
  activeColumn,
  docColumns,
  activeColumnId,
} = docFieldStore

const { closeDoc, switchField, setFullscreen } = docFieldStore

const { t } = useI18n()

const panelRef = ref<HTMLElement>()

const isResizing = ref(false)
const resizeStartX = ref(0)
const resizeStartWidth = ref(0)

const MIN_WIDTH = 320

const panelTitle = computed(() => {
  return activeColumn.value?.title || t('general.untitled')
})

const onResizeStart = (e: MouseEvent) => {
  isResizing.value = true
  resizeStartX.value = e.clientX
  resizeStartWidth.value = panelWidth.value
  document.body.style.cursor = 'col-resize'

  window.addEventListener('mousemove', onResizeMove)
  window.addEventListener('mouseup', onResizeEnd)
}

const getMaxWidth = () => {
  const containerWidth = panelRef.value?.parentElement?.clientWidth ?? 0
  return Math.max(MIN_WIDTH, Math.floor(containerWidth * 0.75))
}

const onResizeMove = (e: MouseEvent) => {
  if (!isResizing.value) return
  const delta = resizeStartX.value - e.clientX
  const newWidth = Math.max(MIN_WIDTH, Math.min(getMaxWidth(), resizeStartWidth.value + delta))
  panelWidth.value = newWidth
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
  } else {
    base.push('flex-shrink-0', 'h-full')
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

    <!-- Body -->
    <div class="flex-1 min-h-0 overflow-hidden">
      <div v-if="isLoading" class="flex items-center justify-center h-full">
        <GeneralLoader />
      </div>
      <div v-else-if="docId" class="h-full overflow-auto">
        <LazyDocEditor :key="docId" :doc-id="docId" embedded />
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

  &.is-resizing {
    cursor: col-resize;
    user-select: none;
  }
}

.nc-doc-field-panel-resize-handle {
  @apply absolute top-0 h-full z-10 cursor-col-resize;
  left: -4px;
  width: 8px;

  &:before {
    @apply bg-transparent absolute left-0 top-[12px] h-[calc(100%_-_24px)] rounded-full z-40 transition-colors;
    content: '';
    width: 3px;
  }

  &:hover:before {
    @apply bg-nc-border-gray-medium;
  }
}

.nc-doc-field-panel.is-resizing .nc-doc-field-panel-resize-handle:before {
  @apply bg-nc-border-gray-medium;
}
</style>
