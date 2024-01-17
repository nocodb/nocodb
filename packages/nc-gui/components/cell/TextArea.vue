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

const vModel = useVModel(props, 'modelValue', emits)

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
  !isExpandedFormOpen.value && !isEditColumn.value && isForm.value && (el as HTMLTextAreaElement)?.focus()

const height = computed(() => {
  if (isExpandedFormOpen.value) return 36 * 4

  if (!rowHeight.value || rowHeight.value === 1 || isEditColumn.value) return 36

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
}

const onMouseMove = (e: MouseEvent) => {
  if (!isDragging.value) return

  e.stopPropagation()

  position.value = {
    top: e.clientY - (mousePosition.value?.top || 0) > 0 ? e.clientY - (mousePosition.value?.top || 0) : position.value?.top || 0,
    left:
      e.clientX - (mousePosition.value?.left || 0) > 0 ? e.clientX - (mousePosition.value?.left || 0) : position.value?.left || 0,
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
  if (editEnabled.value) {
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
      class="flex flex-row pt-0.5 w-full long-text-wrapper"
      :class="{
        'min-h-10': rowHeight !== 1 || isExpandedFormOpen,
        'min-h-9': rowHeight === 1 && !isExpandedFormOpen,
        'h-full': isForm,
      }"
    >
      <div
        v-if="isRichMode"
        class="w-full cursor-pointer nc-readonly-rich-text-wrapper"
        :style="{
          maxHeight: isExpandedFormOpen ? `${height}px` : `${25 * (rowHeight || 1)}px`,
          minHeight: isExpandedFormOpen ? `${height}px` : `${25 * (rowHeight || 1)}px`,
        }"
        @dblclick="onExpand"
        @keydown.enter="onExpand"
      >
        <LazyCellRichText v-model:value="vModel" sync-value-change readonly />
      </div>
      <textarea
        v-else-if="editEnabled && !isVisible"
        :ref="focus"
        v-model="vModel"
        rows="4"
        class="h-full w-full outline-none border-none nc-scrollbar-lg"
        :class="{
          'p-2': editEnabled,
          'py-1 h-full': isForm,
          'px-2': isExpandedFormOpen,
        }"
        :style="{
          minHeight: `${height}px`,
        }"
        :placeholder="isEditColumn ? $t('labels.optional') : ''"
        :disabled="readOnly"
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
          'max-height': `${25 * (rowHeight || 1)}px`,
        }"
        @click="onTextClick"
      />

      <span v-else>{{ vModel }}</span>

      <NcTooltip
        v-if="!isVisible"
        placement="bottom"
        class="!absolute right-0 hidden nc-text-area-expand-btn group-hover:block"
        :class="isExpandedFormOpen || isForm || isRichMode ? 'top-1' : 'bottom-1'"
      >
        <template #title>{{ $t('title.expand') }}</template>
        <NcButton type="secondary" size="xsmall" data-testid="attachment-cell-file-picker-button" @click.stop="onExpand">
          <component :is="iconMap.expand" class="transform group-hover:(!text-grey-800 ) scale-120 text-gray-700 text-xs" />
        </NcButton>
      </NcTooltip>
    </div>
    <a-modal
      v-model:visible="isVisible"
      :closable="false"
      :footer="null"
      wrap-class-name="nc-long-text-expanded-modal !z-1151"
      :mask="true"
      :mask-closable="false"
      :mask-style="{ zIndex: 1051 }"
      :z-index="1052"
      :destroy-on-close="true"
    >
      <div
        v-if="isVisible"
        ref="inputWrapperRef"
        class="flex flex-col py-3 w-full expanded-cell-input relative"
        :class="{
          'cursor-move': isDragging,
        }"
      >
        <div
          v-if="column"
          class="flex flex-row gap-x-1 items-center font-medium pl-3 pb-2.5 border-b-1 border-gray-100"
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
            class="nc-text-area-expanded !py-1 !px-3 !text-black !cursor-text !min-h-[210px] !rounded-lg focus:border-brand-500 disabled:!bg-gray-50"
            :placeholder="$t('activity.enterText')"
            :style="{ resize: 'vertical' }"
            :disabled="readOnly"
            @keydown.escape="isVisible = false"
          />
        </div>

        <LazyCellRichText v-else-if="isVisible" v-model:value="vModel" show-menu full-mode :readonly="readOnly" />
      </div>
    </a-modal>
  </div>
</template>

<style lang="scss" scoped>
textarea:focus {
  box-shadow: none;
}
.nc-text-area-expanded {
  max-height: min(794px, calc(100vh - 170px));
  scrollbar-width: thin !important;
  &::-webkit-scrollbar-thumb {
    @apply rounded-lg;
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
    @apply !w-full h-full !top-0;

    .ant-modal-content {
      @apply absolute w-full min-h-70 !p-0 left-[50%] top-[50%];

      /* Use 'transform' to center the div correctly */
      transform: translate(-50%, -50%);

      min-width: min(800px, calc(100vw - 100px));
      max-width: min(1280px, calc(100vw - 100px));
      max-height: min(864px, calc(100vh - 100px));
    }
  }
}
</style>
