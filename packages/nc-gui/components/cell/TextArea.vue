<script setup lang="ts">
import type { VNodeRef } from '@vue/runtime-core'
import {
  ColumnInj,
  EditColumnInj,
  EditModeInj,
  IsExpandedFormOpenInj,
  IsFormInj,
  ReadonlyInj,
  RowHeightInj,
  computed,
  iconMap,
  inject,
  onClickOutside,
  ref,
  useGlobal,
  useVModel,
  watch,
} from '#imports'

const props = defineProps<{
  modelValue?: string | number
  isFocus?: boolean
  virtual?: boolean
}>()

const emits = defineEmits(['update:modelValue'])

const column = inject(ColumnInj)

const editEnabled = inject(EditModeInj, ref(false))

const isEditColumn = inject(EditColumnInj, ref(false))

const rowHeight = inject(RowHeightInj, ref(1 as const))

const isForm = inject(IsFormInj, ref(false))

const { showNull } = useGlobal()

const vModel = useVModel(props, 'modelValue', emits, { defaultValue: column?.value.cdf ? String(column?.value.cdf) : '' })

const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))!

const position = ref<
  | {
      top: number
      left: number
    }
  | undefined
>({
  top: 200,
  left: 600,
})

const isDragging = ref(false)

const focus: VNodeRef = (el) => !isExpandedFormOpen.value && !isEditColumn.value && (el as HTMLTextAreaElement)?.focus()

const height = computed(() => {
  if (!rowHeight.value || rowHeight.value === 1) return 36

  return rowHeight.value * 36
})

const isVisible = ref(false)

const inputWrapperRef = ref<HTMLElement | null>(null)

const inputRef = ref<HTMLTextAreaElement | null>(null)

const readOnly = inject(ReadonlyInj)

watch(isVisible, () => {
  if (isVisible.value) {
    setTimeout(() => {
      inputRef.value?.focus()
    }, 100)
  }
})

onClickOutside(inputWrapperRef, (e) => {
  if ((e.target as HTMLElement)?.className.includes('nc-long-text-toggle-expand')) return

  isVisible.value = false
})

const onTextClick = () => {
  if (!props.virtual) return

  isVisible.value = true
  editEnabled.value = true
}

const isRichMode = computed(() => {
  let meta: any = {}
  if (typeof column?.value?.meta === 'string') {
    meta = JSON.parse(column?.value?.meta)
  } else {
    meta = column?.value?.meta ?? {}
  }

  return meta?.richMode
})

const onExpand = () => {
  isVisible.value = true

  const { top, left } = inputWrapperRef.value?.getBoundingClientRect() ?? { top: 0, left: 0 }

  position.value = {
    top: top + 42,
    left,
  }
}

const onMouseMove = (e: MouseEvent) => {
  if (!isDragging.value) return

  e.stopPropagation()

  position.value = {
    top: e.clientY - 30,
    left: e.clientX - 120,
  }
}

const onMouseUp = (e: MouseEvent) => {
  if (!isDragging.value) return

  e.stopPropagation()

  isDragging.value = false
  position.value = undefined

  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
}

watch(position, () => {
  const dom = document.querySelector('.nc-textarea-dropdown-active') as HTMLElement
  if (!dom) return

  if (!position.value) return

  // Set left and top of dom
  setTimeout(() => {
    if (!position.value) return

    dom.style.left = `${position.value.left}px`
    dom.style.top = `${position.value.top}px`
  }, 1)
})

const dragStart = () => {
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)

  isDragging.value = true
}

watch(editEnabled, () => {
  if (editEnabled.value) {
    isVisible.value = true
  }
})
</script>

<template>
  <NcDropdown
    v-model:visible="isVisible"
    class="overflow-visible"
    :trigger="[]"
    placement="bottomLeft"
    :overlay-class-name="isVisible ? 'nc-textarea-dropdown-active' : undefined"
  >
    <div
      class="flex flex-row pt-0.5 w-full rich-wrapper"
      :class="{
        'min-h-10': rowHeight !== 1,
        'min-h-6.5': rowHeight === 1,
        'h-full': isForm,
      }"
    >
      <div
        v-if="isRichMode"
        class="w-full cursor-pointer"
        :style="{
          maxHeight: `${height}px !important`,
          minHeight: `${height}px !important`,
        }"
        @dblclick="onExpand"
      >
        <LazyCellRichText v-model:value="vModel" sync-value-change readonly />
      </div>
      <textarea
        v-else-if="editEnabled && !isVisible"
        :ref="focus"
        v-model="vModel"
        rows="4"
        class="h-full w-full outline-none border-none"
        :class="{
          'p-2': editEnabled,
          'py-1 h-full': isForm,
          'px-1': isExpandedFormOpen,
        }"
        :style="{
          minHeight: `${height}px`,
        }"
        :placeholder="isEditColumn ? $t('labels.optional') : ''"
        @blur="editEnabled = false"
        @keydown.alt.enter.stop
        @keydown.shift.enter.stop
        @keydown.down.stop
        @keydown.left.stop
        @keydown.right.stop
        @keydown.up.stop
        @keydown.delete.stop
        @selectstart.capture.stop
        @mousedown.stop
      />

      <span v-else-if="vModel === null && showNull" class="nc-null uppercase">{{ $t('general.null') }}</span>

      <LazyCellClampedText
        v-else-if="rowHeight"
        :value="vModel"
        :lines="rowHeight"
        class="mr-7 nc-text-area-clamped-text"
        :style="{
          'word-break': 'break-word',
          'white-space': 'pre-line',
        }"
        @click="onTextClick"
      />

      <span v-else>{{ vModel }}</span>

      <NcTooltip
        v-if="!isVisible"
        placement="bottom"
        class="!absolute right-0 bottom-1 hidden nc-text-area-expand-btn"
        :class="{ 'right-0 bottom-1': editEnabled, '!bottom-0': !isRichMode }"
      >
        <template #title>{{ $t('title.expand') }}</template>
        <NcButton type="secondary" size="xsmall" data-testid="attachment-cell-file-picker-button" @click.stop="onExpand">
          <component :is="iconMap.expand" class="transform group-hover:(!text-grey-800 ) scale-120 text-gray-700 text-xs" />
        </NcButton>
      </NcTooltip>
    </div>

    <template #overlay>
      <div
        v-if="isVisible"
        ref="inputWrapperRef"
        class="flex flex-col min-w-200 min-h-70 py-3 expanded-cell-input relative"
        :class="{
          'cursor-move': isDragging,
        }"
      >
        <div
          v-if="column"
          class="flex flex-row gap-x-1 items-center font-medium pl-3 pb-2.5 border-b-1 border-gray-100 cursor-move"
          :class="{
            'select-none': isDragging,
          }"
          @mousedown="dragStart"
        >
          <SmartsheetHeaderCellIcon class="flex" />
          <div class="flex max-w-38">
            <span class="truncate">
              {{ column.title }}
            </span>
          </div>
        </div>
        <a-textarea
          v-if="!isRichMode"
          ref="inputRef"
          v-model:value="vModel"
          class="p-1 !pt-1 !pr-3 !border-0 !border-r-0 !focus:outline-transparent nc-scrollbar-md !text-black !cursor-text"
          :placeholder="$t('activity.enterText')"
          :bordered="false"
          :auto-size="{ minRows: 20, maxRows: 20 }"
          :disabled="readOnly"
          @keydown.stop
          @keydown.escape="isVisible = false"
        />

        <LazyCellRichText v-else-if="isVisible" v-model:value="vModel" show-menu full-mode :read-only="readOnly" />
      </div>
    </template>
  </NcDropdown>
</template>

<style lang="scss" scoped>
textarea:focus {
  box-shadow: none;
}
</style>

<style lang="scss">
.cell:hover .nc-text-area-expand-btn {
  @apply !block;
}
.rich-wrapper:hover,
.rich-wrapper:active {
  :deep(.nc-text-area-expand-btn) {
    @apply !block cursor-pointer;
  }
}
</style>
