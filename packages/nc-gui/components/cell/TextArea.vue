<script setup lang="ts">
import type { VNodeRef } from '@vue/runtime-core'

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

const isGrid = inject(IsGridInj, ref(false))

const isGallery = inject(IsGalleryInj, ref(false))

const isKanban = inject(IsKanbanInj, ref(false))

const readOnly = inject(ReadonlyInj, ref(false))

const { showNull } = useGlobal()

const vModel = useVModel(props, 'modelValue', emits, {
  shouldEmit: () => !readOnly.value,
})

const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))!

const position = ref<
  | {
      top: number
      left: number
    }
  | undefined
>()

const mousePosition = ref<
  | {
      top: number
      left: number
    }
  | undefined
>()

const isDragging = ref(false)

const focus: VNodeRef = (el) =>
  !isExpandedFormOpen.value && !isEditColumn.value && !isForm.value && (el as HTMLTextAreaElement)?.focus()

const height = computed(() => {
  if (isExpandedFormOpen.value) return 36 * 4

  if (!rowHeight.value || rowHeight.value === 1 || isEditColumn.value) return 36

  return rowHeight.value * 36
})

const localRowHeight = computed(() => {
  if (readOnly.value && !isExpandedFormOpen.value && (isGallery.value || isKanban.value)) return 6

  return rowHeight.value
})

const isVisible = ref(false)

const inputWrapperRef = ref<HTMLElement | null>(null)

const inputRef = ref<HTMLTextAreaElement | null>(null)

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
}

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

watch(
  position,
  () => {
    const dom = document.querySelector('.nc-long-text-expanded-modal .ant-modal-content') as HTMLElement
    if (!dom || !position.value) return

    // Set left and top of dom
    dom.style.transform = 'none'
    dom.style.left = `${position.value.left}px`
    dom.style.top = `${position.value.top}px`
  },
  { deep: true },
)

const dragStart = (e: MouseEvent) => {
  if (isEditColumn.value) return

  const dom = document.querySelector('.nc-long-text-expanded-modal .ant-modal-content') as HTMLElement

  mousePosition.value = {
    top: e.clientY - dom.getBoundingClientRect().top,
    left: e.clientX - dom.getBoundingClientRect().left + 16,
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)

  isDragging.value = true
}

watch(editEnabled, () => {
  if (editEnabled.value && isRichMode.value) {
    isVisible.value = true
  }
})

const stopPropagation = (event: MouseEvent) => {
  event.stopPropagation()
}

watch(inputWrapperRef, () => {
  if (!isEditColumn.value) return

  // stop event propogation in edit column
  const modal = document.querySelector('.nc-long-text-expanded-modal') as HTMLElement

  if (isVisible.value && modal?.parentElement) {
    modal.parentElement.addEventListener('click', stopPropagation)
    modal.parentElement.addEventListener('mousedown', stopPropagation)
    modal.parentElement.addEventListener('mouseup', stopPropagation)
  } else if (modal?.parentElement) {
    modal.parentElement.removeEventListener('click', stopPropagation)
    modal.parentElement.removeEventListener('mousedown', stopPropagation)
    modal.parentElement.removeEventListener('mouseup', stopPropagation)
  }
})
</script>

<template>
  <div>
    <div
      class="flex flex-row w-full long-text-wrapper items-center"
      :class="{
        'min-h-10': rowHeight !== 1 || isExpandedFormOpen,
        'min-h-5.5': rowHeight === 1 && !isExpandedFormOpen,
        'h-full w-full': isForm,
      }"
    >
      <div v-if="isForm && isRichMode" class="w-full">
        <div
          class="w-full relative w-full px-0"
          :class="{
            'pt-11': !readOnly,
          }"
        >
          <LazyCellRichText
            v-model:value="vModel"
            :class="{
              'border-t-1 border-gray-100 allow-vertical-resize': !readOnly,
            }"
            :autofocus="false"
            show-menu
            :read-only="readOnly"
          />
        </div>
      </div>

      <div
        v-else-if="isRichMode"
        class="w-full cursor-pointer nc-readonly-rich-text-wrapper"
        :class="{
          'nc-readonly-rich-text-grid ': !isExpandedFormOpen && !isForm,
          'nc-readonly-rich-text-sort-height': localRowHeight === 1 && !isExpandedFormOpen && !isForm,
        }"
        :style="{
          maxHeight: isForm ? undefined : isExpandedFormOpen ? `${height}px` : `${21 * rowHeightTruncateLines(localRowHeight)}px`,
          minHeight: isForm ? undefined : isExpandedFormOpen ? `${height}px` : `${21 * rowHeightTruncateLines(localRowHeight)}px`,
        }"
        @dblclick="onExpand"
        @keydown.enter="onExpand"
      >
        <LazyCellRichText v-model:value="vModel" sync-value-change read-only />
      </div>
      <!-- eslint-disable vue/use-v-on-exact -->
      <textarea
        v-else-if="(editEnabled && !isVisible) || isForm"
        :ref="focus"
        v-model="vModel"
        :rows="isForm ? 5 : 4"
        class="h-full w-full outline-none border-none nc-longtext-scrollbar"
        :class="{
          'p-2': editEnabled,
          'py-1 h-full': isForm,
          'px-2': isExpandedFormOpen,
        }"
        :style="{
          minHeight: isForm ? '117px' : `${height}px`,
          maxHeight: 'min(800px, calc(100vh - 200px))',
        }"
        :disabled="readOnly"
        @blur="editEnabled = false"
        @keydown.alt.stop
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
        :lines="rowHeightTruncateLines(localRowHeight)"
        class="nc-text-area-clamped-text"
        :style="{
          'word-break': 'break-word',
          'max-height': `${25 * rowHeightTruncateLines(localRowHeight)}px`,
          'my-auto': rowHeightTruncateLines(localRowHeight) === 1,
        }"
        @click="onTextClick"
      />

      <span v-else>{{ vModel }}</span>

      <NcTooltip
        v-if="!isVisible && !isForm"
        placement="bottom"
        class="nc-action-icon !absolute !hidden nc-text-area-expand-btn group-hover:block z-3"
        :class="{
          'right-1': isForm,
          'right-0': !isForm,
          'top-0': isGrid && !isExpandedFormOpen && !isForm && !(!rowHeight || rowHeight === 1),
          'top-1': !(isGrid && !isExpandedFormOpen && !isForm),
        }"
        :style="
          isGrid && !isExpandedFormOpen && !isForm && (!rowHeight || rowHeight === 1)
            ? { top: '50%', transform: 'translateY(-50%)' }
            : undefined
        "
      >
        <template #title>{{ $t('title.expand') }}</template>
        <NcButton
          type="secondary"
          size="xsmall"
          data-testid="attachment-cell-file-picker-button"
          class="!p-0 !w-5 !h-5 !min-w-[fit-content]"
          @click.stop="onExpand"
        >
          <component :is="iconMap.expand" class="transform group-hover:(!text-grey-800) text-gray-700 text-xs" />
        </NcButton>
      </NcTooltip>
    </div>
    <a-modal
      v-if="isVisible"
      v-model:visible="isVisible"
      :closable="false"
      :footer="null"
      wrap-class-name="nc-long-text-expanded-modal"
      :mask="true"
      :mask-closable="false"
      :mask-style="{ zIndex: 1051 }"
      :z-index="1052"
    >
      <div
        ref="inputWrapperRef"
        class="flex flex-col py-3 w-full expanded-cell-input relative"
        :class="{
          'cursor-move': isDragging,
        }"
        @keydown.enter.stop
      >
        <div
          v-if="column"
          class="flex flex-row gap-x-1 items-center font-medium pl-3 pb-2.5 border-b-1 border-gray-100 overflow-hidden"
          :class="{
            'select-none': isDragging,
            'cursor-move': !isEditColumn,
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
        <div v-if="!isRichMode" class="p-3 pb-0 h-full">
          <a-textarea
            ref="inputRef"
            v-model:value="vModel"
            class="nc-text-area-expanded !py-1 !px-3 !text-black !cursor-text !min-h-[210px] !rounded-lg focus:border-brand-500 disabled:!bg-gray-50 nc-longtext-scrollbar"
            :placeholder="$t('activity.enterText')"
            :style="{ resize: 'both' }"
            :disabled="readOnly"
            @keydown.escape="isVisible = false"
            @keydown.alt.stop
          />
        </div>

        <LazyCellRichText v-else v-model:value="vModel" show-menu full-mode :read-only="readOnly" />
      </div>
    </a-modal>
  </div>
</template>

<style lang="scss" scoped>
textarea:focus {
  box-shadow: none;
}
.nc-text-area-expanded {
  @apply h-[min(795px,100vh_-_170px)] w-[min(1256px,100vw_-_124px)];

  max-height: min(795px, 100vh - 170px);
  min-width: 256px;
  max-width: min(1256px, 100vw - 126px);
  scrollbar-width: thin !important;
  &::-webkit-scrollbar-thumb {
    @apply rounded-lg;
  }
}
.nc-longtext-scrollbar {
  @apply scrollbar-thin scrollbar-thumb-gray-200 hover:scrollbar-thumb-gray-300 scrollbar-track-transparent;
}

.nc-readonly-rich-text-wrapper {
  &.nc-readonly-rich-text-grid {
    :deep(.ProseMirror) {
      @apply !pt-0;
    }
    // &.nc-readonly-rich-text-sort-height {
    //   @apply mt-1;
    // }
  }
}
</style>

<style lang="scss">
.cell:hover .nc-text-area-expand-btn,
.long-text-wrapper:hover .nc-text-area-expand-btn {
  @apply !block cursor-pointer;
}

.nc-long-text-expanded-modal {
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
</style>
