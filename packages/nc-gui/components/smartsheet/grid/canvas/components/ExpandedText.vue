<script setup lang="ts">

import type { ColumnType } from 'nocodb-sdk';

const props = defineProps<{
  column:ColumnType,
  modelVisible: string
}>()

const STORAGE_KEY = 'nc-textarea-size'
const isVisible = toRef(props, 'modelVisible')
const inputWrapperRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLElement | null>(null)

const isSizeUpdated = ref(false)
const skipSizeUpdate = ref(true)

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

    if (parsedJSON && elem) {
      elem.style.width = `${parsedJSON.width}px`
      elem.style.height = `${parsedJSON.height}px`
    }
  } catch (e) {
    console.error('Error updating size:', e)
  }
}

const getResizeEl = () => {
  return inputWrapperRef.value?.querySelector('.nc-expanded-text-expanded') as HTMLElement
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
    })
  )
})
</script>
<template>
  <a-modal
    v-if="isVisible"
    v-model:visible="isVisible"
    :closable="false"
    :footer="null"
    wrap-class-name="nc-expanded-text-expanded"
    :mask="true"
    :mask-closable="false"
    :mask-style="{ zIndex: 1051 }"
    :z-index="1052"
  >
    <div
      ref="inputWrapperRef"
      class="flex flex-col pb-3 w-full relative"
    >
      <div
        v-if="column"
        class="flex flex-row gap-x-1 items-center font-medium pl-3 pb-2.5 pt-3 border-b-1 border-gray-100 overflow-hidden"
      >
        <SmartsheetHeaderCellIcon class="flex" />
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
        <a-textarea
          ref="inputRef"
          v-model:value="vModel"
          class="nc-text-area-expanded !py-1 !px-3 !text-black !transition-none !cursor-text !min-h-[210px] !rounded-lg focus:border-brand-500 disabled:!bg-gray-50 nc-longtext-scrollbar"
          :placeholder="$t('activity.enterText')"
          :style="{
          resize: 'both',
          maxHeight: 'min(795px, 100vh - 170px)',
        }"
          @keydown.escape="isVisible = false"
        />
      </div>
    </div>
  </a-modal>
</template>