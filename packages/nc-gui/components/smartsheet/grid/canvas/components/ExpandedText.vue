<script setup lang="ts">
import { type ColumnType, handleTZ } from 'nocodb-sdk'

const props = defineProps<{
  column: ColumnType
  modelVisible: boolean
  modelValue: string
}>()

const emits = defineEmits(['update:modelVisible'])

const STORAGE_KEY = 'nc-long-text-expanded-modal-size'
const isVisible = useVModel(props, 'modelVisible', emits)
const inputWrapperRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLElement | null>(null)
const column = toRef(props, 'column')
const modelValue = toRef(props, 'modelValue')

const position = ref<{ top: number; left: number } | undefined>()
const mousePosition = ref<{ top: number; left: number } | undefined>()
const isDragging = ref(false)

const isSizeUpdated = ref(false)
const skipSizeUpdate = ref(true)

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
  position.value = undefined
  mousePosition.value = undefined

  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
}

const dragStart = (e: MouseEvent) => {
  const dom = document.querySelector('.nc-long-text-expanded .ant-modal-content') as HTMLElement
  if (!dom) return

  mousePosition.value = {
    top: e.clientY - dom.getBoundingClientRect().top,
    left: e.clientX - dom.getBoundingClientRect().left + 16,
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
  isDragging.value = true
}

watch(
  position,
  () => {
    const dom = document.querySelector('.nc-long-text-expanded .ant-modal-content') as HTMLElement
    if (!dom || !position.value) return

    dom.style.transform = 'none'
    dom.style.left = `${position.value.left}px`
    dom.style.top = `${position.value.top}px`
  },
  { deep: true },
)

watch(isVisible, (open) => {
  if (!open) {
    isSizeUpdated.value = false
    skipSizeUpdate.value = true
  }
})

const updateSize = () => {
  try {
    const size = localStorage.getItem(STORAGE_KEY)
    const elem = inputRef.value as HTMLElement
    const parsedJSON = size ? JSON.parse(size) : null

    if (parsedJSON && elem?.style) {
      elem.style.width = `${parsedJSON.width}px`
      elem.style.height = `${parsedJSON.height}px`
    }
  } catch (e) {
    console.error('Error updating size:', e)
  }
}

const getResizeEl = () => {
  return inputWrapperRef.value?.querySelector('.nc-long-text-expanded-textarea') as HTMLElement
}

useResizeObserver(inputWrapperRef, () => {
  if (!isSizeUpdated.value) {
    nextTick(() => {
      until(() => !!getResizeEl())
        .toBeTruthy()
        .then(() => {
          updateSize()
          isSizeUpdated.value = true
        })
    })
    return
  }

  if (skipSizeUpdate.value) {
    skipSizeUpdate.value = false
    return
  }

  const resizeEl = getResizeEl()
  if (!resizeEl) return

  const { width, height } = resizeEl.getBoundingClientRect()

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      width,
      height,
    }),
  )
})

const { isPg } = useBase()

const result = isPg(column.value?.source_id) ? renderValue(handleTZ(modelValue.value)) : renderValue(modelValue.value)
const urls = replaceUrlsWithLink(result)
</script>

<template>
  <a-modal
    v-model:visible="isVisible"
    :closable="false"
    :footer="null"
    :class="{ active: isVisible }"
    wrap-class-name="nc-long-text-expanded"
    :mask="true"
    :mask-closable="false"
    :mask-style="{ zIndex: 1051 }"
    :z-index="1052"
  >
    <div
      ref="inputWrapperRef"
      class="flex flex-col pb-3 w-full relative"
      :class="{ 'cursor-move': isDragging }"
      @keydown.enter.stop
    >
      <div
        v-if="column"
        class="flex flex-row gap-x-1 items-center font-medium pl-3 pb-2.5 pt-3 border-b-1 border-gray-100 overflow-hidden cursor-move select-none"
        @mousedown="dragStart"
      >
        <SmartsheetHeaderCellIcon :column-meta="column" class="flex" />
        <div class="flex max-w-38">
          <span class="truncate">
            {{ column.title }}
          </span>
        </div>
        <div class="flex-1" />
        <NcButton class="mr-2" type="text" size="small" @click="isVisible = false">
          <GeneralIcon icon="close" />
        </NcButton>
      </div>
      <div class="p-3 pb-0 h-full">
        <div
          v-if="urls"
          ref="inputRef"
          :style="{
            resize: 'both',
            maxHeight: 'min(795px, 100vh - 170px)',
            width: 'min(1256px, 100vw - 124px)',
          }"
          class="nc-long-text-expanded-textarea border-1 border-gray-200 bg-gray-50 !py-1 !px-3 !text-black !transition-none !cursor-text !min-h-[210px] !rounded-lg focus:border-brand-500 disabled:!bg-gray-50 nc-longtext-scrollbar"
          v-html="urls"
        ></div>

        <a-textarea
          v-else
          ref="inputRef"
          disabled
          :value="modelValue"
          class="nc-long-text-expanded-textarea !py-1 !px-3 !text-black !transition-none !cursor-text !min-h-[210px] !rounded-lg focus:border-brand-500 disabled:!bg-gray-50 nc-longtext-scrollbar"
          :placeholder="$t('activity.enterText')"
          :style="{
            resize: 'both',
            maxHeight: 'min(795px, 100vh - 170px)',
            width: 'min(1256px, 100vw - 124px)',
          }"
          @keydown.escape="isVisible = false"
          @keydown.alt.stop
        />
      </div>
    </div>
  </a-modal>
</template>

<style lang="scss">
.nc-long-text-expanded {
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

.nc-long-text-expanded-textarea {
  min-width: -webkit-fill-available;
  max-width: min(1256px, 100vw - 126px);
  transition-property: shadow, colors, border;
  scrollbar-width: thin !important;
  &::-webkit-scrollbar-thumb {
    @apply rounded-lg;
  }
}
</style>
