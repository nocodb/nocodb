<script setup lang="ts">
import { EditorContent, useEditor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import TaskList from '@tiptap/extension-task-list'
import { TaskItem } from '~/helpers/tiptap-markdown/extensions/nodes/task-item'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'

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
  smartTextColumns,
  hasPrev,
  hasNext,
} = smartTextStore

const {
  closeEditor,
  flushSave,
  switchField,
  setFullscreen,
  setPmContent,
  navigatePrev,
  navigateNext,
} = smartTextStore

const { t } = useI18n()
const meta = inject(MetaInj, ref())

const panelRef = ref<HTMLElement>()

// ---- Resize handle (mirrors Doc field panel) -------------------------------
const isResizing = ref(false)
const resizeStartX = ref(0)
const resizeStartWidth = ref(0)
const MIN_WIDTH = 320

const getMaxWidth = () => {
  const containerWidth = panelRef.value?.parentElement?.clientWidth ?? 0
  return Math.max(MIN_WIDTH, Math.floor(containerWidth * 0.75))
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
}

// ---- Tiptap editor ---------------------------------------------------------
// v1 mounts a minimal extension set. Full extension parity (tables, callouts,
// columns, code blocks with language, file attachments, math, etc.) is a
// follow-up tied to extracting the docs Editor.vue into a shared component.
const editor = useEditor({
  extensions: [
    StarterKit,
    Underline,
    Link.configure({ openOnClick: false }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Placeholder.configure({ placeholder: 'Start writing...' }),
  ],
  editorProps: {
    attributes: {
      class: 'nc-smart-text-editor focus:outline-none',
    },
  },
  onUpdate: ({ editor: e }) => {
    setPmContent(e.getJSON() as Record<string, any>)
  },
})

// Push freshly-loaded PM content into the editor when the panel switches cells.
watch(
  pmContent,
  (val) => {
    if (!editor.value) return
    if (!val) {
      editor.value.commands.setContent('')
      return
    }
    const current = editor.value.getJSON()
    if (JSON.stringify(current) === JSON.stringify(val)) return
    editor.value.commands.setContent(val as any, false)
  },
  { flush: 'post' },
)

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onResizeMove)
  window.removeEventListener('mouseup', onResizeEnd)
  editor.value?.destroy()
})

// ---- Session-end save triggers ---------------------------------------------
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

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibilityChange)
  window.removeEventListener('beforeunload', onBeforeUnload)
})

// Save on editor blur — fires when focus leaves the ProseMirror node.
const onEditorBlur = () => {
  if (isDirty.value) flushSave()
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
    return { left: 'var(--mini-sidebar-width)', right: '0', top: '0', bottom: '0' }
  }
  return { width: `${panelWidth.value}px` }
})

const panelClasses = computed(() => {
  const base = ['nc-smart-text-panel', 'flex', 'flex-col', 'bg-nc-bg-default', 'border-l', 'border-nc-border-gray-medium']
  if (isResizing.value) base.push('is-resizing')
  if (isFullscreen.value) base.push('fixed', 'top-0', 'z-50')
  else base.push('flex-shrink-0', 'h-full')
  return base
})

const saveStatusLabel = computed(() => {
  if (isSaving.value) return t('general.saving') || 'Saving...'
  if (isDirty.value) return 'Unsaved changes'
  return ''
})
</script>

<template>
  <Transition name="nc-slide-right" @after-enter="panelRef?.focus()">
    <div
      v-if="isOpen"
      ref="panelRef"
      tabindex="-1"
      :class="panelClasses"
      :style="panelStyle"
      data-testid="nc-smart-text-panel"
      @keydown="onKeydown"
    >
      <!-- Resize handle (left edge) -->
      <div
        v-if="!isFullscreen"
        class="nc-smart-text-panel-resize-handle"
        data-testid="nc-smart-text-panel-resize"
        @mousedown.prevent="onResizeStart"
      />

      <!-- Header -->
      <div
        class="flex items-center h-[var(--topbar-height)] gap-2 px-3 py-2 border-b border-nc-border-gray-medium flex-shrink-0"
      >
        <div
          v-if="isFullscreen && meta?.title"
          class="flex items-center gap-1 text-bodySm text-nc-content-gray-subtle2 truncate max-w-40"
        >
          <GeneralIcon icon="table" class="w-4 h-4 flex-shrink-0" />
          <span class="truncate">{{ meta.title }}</span>
          <span>·</span>
        </div>

        <NcDropdown v-if="smartTextColumns.length > 1" placement="bottomLeft">
          <NcButton size="xs" type="text" class="!px-1">
            <div class="flex items-center gap-1 text-nc-content-gray">
              <GeneralIcon icon="ncFileText" class="w-4 h-4" />
              <span class="text-bodySm font-medium truncate max-w-48 leading-normal">{{ panelTitle }}</span>
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
        <div v-else class="flex items-center gap-1 text-nc-content-gray-subtle px-1">
          <GeneralIcon icon="ncFileText" class="w-4 h-4" />
          <span class="text-bodySm font-medium truncate max-w-48 leading-normal">{{ panelTitle }}</span>
        </div>

        <!-- Save status -->
        <span
          v-if="saveStatusLabel"
          class="text-captionSm text-nc-content-gray-subtle2"
          data-testid="nc-smart-text-save-status"
        >
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

      <!-- Body -->
      <div class="flex-1 min-h-0 overflow-auto" @blur.capture="onEditorBlur">
        <div v-if="isLoading" class="flex items-center justify-center h-full">
          <GeneralLoader />
        </div>
        <div v-else class="px-6 py-4">
          <EditorContent :editor="editor" />
        </div>
      </div>
    </div>
  </Transition>

  <Transition name="nc-fade">
    <div
      v-if="isOpen && isFullscreen"
      class="fixed top-0 bottom-0 right-0 bg-black/20 z-49 cursor-pointer"
      :style="{ left: 'var(--mini-sidebar-width)' }"
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

:deep(.nc-smart-text-editor) {
  @apply text-bodyDefaultSm text-nc-content-gray;
  min-height: 200px;

  p.is-editor-empty:first-child::before {
    @apply text-nc-content-gray-subtle2;
    content: attr(data-placeholder);
    float: left;
    height: 0;
    pointer-events: none;
  }

  ul[data-type='taskList'] {
    @apply list-none pl-0;

    li {
      @apply flex items-start gap-2;

      > label {
        @apply mt-1;
      }

      > div {
        @apply flex-1;
      }
    }
  }
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
