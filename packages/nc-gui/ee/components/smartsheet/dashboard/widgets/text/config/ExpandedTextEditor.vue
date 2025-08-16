<script setup lang="ts">
import MarkdownRenderer from '~/components/smartsheet/dashboard/widgets/text/config/Markdown.vue'

interface Props {
  value: boolean
  content: string
  isMarkdown?: boolean
  title?: string
}

const props = withDefaults(defineProps<Props>(), {
  isMarkdown: false,
  title: 'Text Editor',
})

const emits = defineEmits<{
  'update:value': [value: boolean]
  'update:content': [value: string]
}>()

const STORAGE_KEY = 'nc-text-widget-expanded-modal-size'
const isVisible = useVModel(props, 'value', emits)
const inputWrapperRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLElement | null>(null)
const markdownEditorRef = ref<InstanceType<typeof MarkdownRenderer> | null>(null)

const localContent = ref(props.content)
const position = ref<{ top: number; left: number } | undefined>()
const mousePosition = ref<{ top: number; left: number } | undefined>()
const isDragging = ref(false)

/**
 * Tracks whether the size has been updated.
 * Prevents redundant updates when resizing elements.
 */
const isSizeUpdated = ref(false)

/**
 * Controls whether the next size update should be skipped.
 * Used to avoid unnecessary updates on initialization.
 */
const skipSizeUpdate = ref(true)

// Watch for content changes from parent
watch(
  () => props.content,
  (newContent) => {
    localContent.value = newContent
  },
)

// Emit content changes with debounce
const debouncedEmitContent = useDebounceFn(() => {
  emits('update:content', localContent.value)
}, 300)

watch(localContent, () => {
  debouncedEmitContent()
})

const onMouseMove = (e: MouseEvent) => {
  if (!isDragging.value) return

  e.stopPropagation()

  position.value = {
    top: e.clientY - (mousePosition.value?.top || 0) > 0 ? e.clientY - (mousePosition.value?.top || 0) : position.value?.top || 0,
    left:
      e.clientX - (mousePosition.value?.left || 0) > -16
        ? e.clientX - (mousePosition.value?.left || 0)
        : position.value?.left || 0,
  }
}

const onMouseUp = (e: MouseEvent) => {
  if (!isDragging.value) return

  e.stopPropagation()
  isDragging.value = false
  mousePosition.value = undefined

  document.removeEventListener('mousemove', onMouseMove, true)
  document.removeEventListener('mouseup', onMouseUp, true)
}

const dragStart = (e: MouseEvent) => {
  if (e.target && (e.target as HTMLElement).closest('.ant-btn')) return

  isDragging.value = true
  mousePosition.value = {
    top: e.offsetY,
    left: e.offsetX,
  }

  document.addEventListener('mousemove', onMouseMove, true)
  document.addEventListener('mouseup', onMouseUp, true)
}

const getResizeEl = (): HTMLElement | null => {
  return document.querySelector('.nc-text-widget-expanded-textarea') as HTMLElement
}

watch(
  position,
  () => {
    const dom = document.querySelector('.nc-text-widget-expanded .ant-modal-content') as HTMLElement
    if (!dom) return

    if (position.value) {
      dom.style.left = `${position.value.left}px`
      dom.style.top = `${position.value.top}px`
      dom.style.transform = 'none'
    }
  },
  { flush: 'post' },
)

const getResizeEl = (): HTMLElement | null => {
  return document.querySelector('.nc-text-widget-expanded-textarea') as HTMLElement
}

const updateSize = () => {
  if (skipSizeUpdate.value) {
    skipSizeUpdate.value = false
    return
  }

  const resizeEl = getResizeEl()
  if (!resizeEl) return

  const { width, height } = getComputedStyle(resizeEl)
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ width, height }))
  isSizeUpdated.value = true
}

useResizeObserver(inputWrapperRef, () => {
  if (!isVisible.value) return

  /**
   * We're using a watcher to update the size in localStorage.
   * This is because the ResizeObserver callback is called multiple times
   * when the modal is opened, and we only want to update the size once.
   */
  nextTick(() => {
    if (isSizeUpdated.value) return
    updateSize()
  })
})

watch(isVisible, async (nextVal) => {
  if (nextVal) {
    await nextTick()

    try {
      const storedSize = localStorage.getItem(STORAGE_KEY)
      if (storedSize) {
        const { width, height } = JSON.parse(storedSize)
        const resizeEl = getResizeEl()
        if (resizeEl) {
          resizeEl.style.width = width
          resizeEl.style.height = height
        }
      }
    } catch (e) {
      console.error('Failed to parse stored size', e)
    }

    // Focus the appropriate editor
    if (props.isMarkdown) {
      markdownEditorRef.value?.focusEditor?.()
    } else {
      inputRef.value?.focus?.()
    }
  } else {
    // Reset position when modal closes
    position.value = undefined
    skipSizeUpdate.value = true
    isSizeUpdated.value = false
  }
})

const handleCancel = () => {
  localContent.value = props.content // Reset to original content
  isVisible.value = false
}
</script>

<template>
  <a-modal
    v-model:visible="isVisible"
    :class="{ active: isVisible }"
    :closable="false"
    :footer="null"
    :width="1280"
    wrap-class-name="nc-text-widget-expanded"
    :z-index="1052"
  >
    <div
      ref="inputWrapperRef"
      class="flex flex-col pb-3 w-full relative"
      :class="{ 'cursor-move': isDragging }"
      @keydown.enter.stop
    >
      <div
        class="flex flex-row gap-x-1 items-center font-medium pl-3 pb-2.5 pt-3 border-b-1 border-gray-100 overflow-hidden cursor-move select-none"
        @mousedown="dragStart"
      >
        <div class="flex max-w-38">
          <span class="truncate"> Text Widget </span>
        </div>
        <div class="flex-1" />
        <NcButton class="mr-2" type="text" size="small" @click="handleCancel">
          <GeneralIcon icon="close" />
        </NcButton>
      </div>
      <div class="p-3 pb-0 h-full">
        <div
          v-if="isMarkdown"
          class="nc-text-widget-expanded-textarea overflow-auto border-1 border-gray-200 bg-white !rounded-lg focus-within:border-brand-500"
          :style="{
            resize: 'both',
            maxHeight: 'min(795px, 100vh - 170px)',
            width: 'min(1256px, 100vw - 124px)',
            minHeight: '210px',
          }"
        >
          <MarkdownRenderer
            ref="markdownEditorRef"
            v-model:value="localContent"
            :placeholder="$t('activity.enterText')"
            :hide-options="false"
            class="!min-h-[400px] p-2"
            @keydown.escape="handleCancel"
          />
        </div>

        <a-textarea
          v-else
          ref="inputRef"
          v-model:value="localContent"
          class="nc-text-widget-expanded-textarea !py-3 !px-3 !text-black !transition-none !cursor-text !min-h-[210px] !rounded-lg focus:border-brand-500 nc-longtext-scrollbar"
          :placeholder="$t('activity.enterText')"
          :style="{
            resize: 'both',
            maxHeight: 'min(795px, 100vh - 170px)',
            width: 'min(1256px, 100vw - 124px)',
          }"
          @keydown.escape="handleCancel"
          @keydown.alt.stop
        />
      </div>
    </div>
  </a-modal>
</template>

<style lang="scss">
.nc-text-widget-expanded {
  .ant-modal {
    @apply !w-full h-full !top-0 !mx-auto !my-0;

    .ant-modal-content {
      @apply absolute w-[fit-content] min-h-70 min-w-70 !p-0 left-[50%] top-[50%];

      /* Use 'transform' to center the div correctly */
      transform: translate(-50%, -50%);

      max-width: min(1280px, 100vw - 100px);
      max-height: min(864px, 100vh - 100px);

      .nc-longtext-scrollbar {
        @apply scrollbar-thin scrollbar-thumb-gray-200 hover:scrollbar-thumb-gray-300 scrollbar-track-transparent;
      }
    }
  }
}

.nc-text-widget-expanded-textarea {
  min-width: -webkit-fill-available;
  max-width: min(1256px, 100vw - 126px);
  transition-property: shadow, colors, border;
  scrollbar-width: thin !important;
  &::-webkit-scrollbar-thumb {
    @apply rounded-lg;
  }
}
</style>
