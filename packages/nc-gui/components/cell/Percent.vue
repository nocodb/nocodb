<script setup lang="ts">
import type { VNodeRef } from '@vue/runtime-core'
import {
  EditColumnInj,
  EditModeInj,
  IsExpandedFormOpenInj,
  IsFormInj,
  ReadonlyInj,
  inject,
  useVModel,
  getPercentStep,
  isValidPercent,
  renderPercent,
} from '#imports'

interface Props {
  modelValue?: number | string | null
}

const props = defineProps<Props>()

const emits = defineEmits(['update:modelValue', 'save'])

const { showNull } = useGlobal()

const column = inject(ColumnInj)!

const editEnabled = inject(EditModeInj, ref(false))

const isEditColumn = inject(EditColumnInj, ref(false))

const readOnly = inject(ReadonlyInj, ref(false))

const _vModel = useVModel(props, 'modelValue', emits)

const wrapperRef = ref<HTMLElement>()

const percent = ref(_vModel.value)

const percentMeta = computed(() => {
  return {
    is_progress: false,
    ...parseProp(column.value?.meta),
  }
})

const percentStep = computed(() => getPercentStep(percentMeta.value.precision || 2))

const displayValue = computed(() => {
  if (_vModel.value === null || _vModel.value === undefined) return null

  if (isNaN(Number(_vModel.value))) return null

  return renderPercent((_vModel.value as number) / 100, percentMeta.value.precision ?? 2)
})

const vModel = computed({
  get: () => {
    if (_vModel.value === null || _vModel.value === undefined || isNaN(Number(_vModel.value))) return null
    return renderPercent(_vModel.value, undefined, false)
  },
  set: (value) => {
    if (value === '' || value === null) value = 0
    if (isValidPercent(value, percentMeta.value?.negative)) {
      percent.value = value / 100
    }
  },
})

const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))!

const isForm = inject(IsFormInj)!

const focus: VNodeRef = (el) =>
  !isExpandedFormOpen.value && !isEditColumn.value && !isForm.value && (el as HTMLInputElement)?.focus()

const cellFocused = ref(false)

const expandedEditEnabled = ref(false)

const onBlur = () => {
  if (_vModel.value !== percent.value) {
    _vModel.value = percent.value ?? null

    emits('save')
  }
  editEnabled.value = false

  cellFocused.value = false
  expandedEditEnabled.value = false
}

const onFocus = () => {
  cellFocused.value = true
  editEnabled.value = true
  expandedEditEnabled.value = true
}

const onWrapperFocus = () => {
  cellFocused.value = true
  editEnabled.value = true
  expandedEditEnabled.value = true

  nextTick(() => {
    wrapperRef.value?.querySelector('input')?.focus()
    wrapperRef.value?.querySelector('input')?.select()
  })
}

const onMouseover = () => {
  expandedEditEnabled.value = true
}

const onMouseleave = () => {
  if (!cellFocused.value) {
    expandedEditEnabled.value = false
  }
}

const onTabPress = (e: KeyboardEvent) => {
  if (e.shiftKey && (isExpandedFormOpen.value || isForm.value)) {
    e.preventDefault()

    // Shift + Tab does not work for percent cell
    // so we manually focus on the last form item
    const focusesNcCellIndex = Array.from(
      document.querySelectorAll(`${isExpandedFormOpen.value ? '.nc-expanded-form-row' : '.nc-form-wrapper'} .nc-data-cell`),
    ).findIndex((el) => {
      return el.querySelector('.nc-filter-value-select') === wrapperRef.value
    })

    if (focusesNcCellIndex >= 0) {
      const nodes = document.querySelectorAll(
        `${isExpandedFormOpen.value ? '.nc-expanded-form-row' : '.nc-form-wrapper'} .nc-data-cell`,
      )

      for (let i = focusesNcCellIndex - 1; i >= 0; i--) {
        const lastFormItem = nodes[i].querySelector('[tabindex="0"]') as HTMLElement
        if (lastFormItem) {
          lastFormItem.focus()
          break
        }
      }
    }
  }
}

function onKeyDown(evt: KeyboardEvent) {
  const keys = ['e', 'E', '+']
  if (!percentMeta.value?.negative) keys.push('-')
  return keys.includes(evt.key) && evt.preventDefault()
}
</script>

<template>
  <div
    ref="wrapperRef"
    :tabindex="readOnly ? -1 : 0"
    class="nc-filter-value-select w-full focus:outline-transparent"
    :class="readOnly ? 'cursor-not-allowed pointer-events-none' : ''"
    @mouseover="onMouseover"
    @mouseleave="onMouseleave"
    @focus="onWrapperFocus"
  >
    <input
      v-if="!readOnly && editEnabled && (isExpandedFormOpen ? expandedEditEnabled : true)"
      :ref="focus"
      v-model="vModel"
      class="nc-cell-field w-full !text-sm !border-none !outline-none focus:ring-0 text-base py-1"
      type="number"
      :placeholder="isEditColumn ? $t('labels.optional') : ''"
      :step="percentStep"
      @blur="onBlur"
      @focus="onFocus"
      @keydown.down.stop
      @keydown.left.stop
      @keydown.right.stop
      @keydown.up.stop
      @keydown.delete.stop
      @keydown.tab="onTabPress"
      @keydown="onKeyDown"
      @selectstart.capture.stop
      @mousedown.stop
    />
    <span v-else-if="vModel === null && showNull" class="nc-cell-field nc-null uppercase">{{ $t('general.null') }}</span>
    <div v-else-if="percentMeta.is_progress === true && vModel !== null && vModel !== undefined" class="px-2">
      <a-progress
        :percent="Number(parseFloat(vModel.toString()).toFixed(2))"
        size="small"
        status="normal"
        stroke-color="#3366FF"
        trail-color="#E5E5E5"
        :show-info="false"
      />
    </div>
    <!-- nbsp to keep height even if vModel is zero length -->
    <span v-else class="nc-cell-field">{{ displayValue }}&nbsp;</span>
  </div>
</template>

<style lang="scss" scoped>
/* Chrome, Safari, Edge, Opera */
input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

/* Firefox */
input[type='number'] {
  -moz-appearance: textfield;
}
</style>
