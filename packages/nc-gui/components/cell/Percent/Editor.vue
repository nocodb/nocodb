<script setup lang="ts">
import type { VNodeRef } from '@vue/runtime-core'
import { ColumnHelper, UITypes, ncIsNaN, roundUpToPrecision } from 'nocodb-sdk'

interface Props {
  modelValue?: number | string | null
  placeholder?: string
  localEditEnabled?: boolean
  location?: 'cell' | 'filter'
}

const props = defineProps<Props>()
const emits = defineEmits(['update:modelValue'])

const column = inject(ColumnInj)

const editEnabled = inject(EditModeInj, ref(false))

const isEditColumn = inject(EditColumnInj, ref(false))

const readOnly = inject(ReadonlyInj, ref(false))

const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))!

const isForm = inject(IsFormInj, ref(false))

const isGrid = inject(IsGridInj, ref(false))

const isWorkflow = inject(isWorkflowInj, ref(false))!

const isCanvasInjected = inject(IsCanvasInjectionInj, false)

const isUnderLookup = inject(IsUnderLookupInj, ref(false))

const isLinkRecordDropdown = inject(IsLinkRecordDropdownInj, ref(false))

const _vModel = useVModel(props, 'modelValue', emits)
const localEditEnabled = useVModel(props, 'localEditEnabled', emits, { defaultValue: false })
const cellFocused = ref(false)
const inputRef = ref<HTMLInputElement>()

const percentMeta = computed(() => {
  return {
    ...ColumnHelper.getColumnDefaultMeta(UITypes.Percent),
    ...parseProp(column?.value?.meta),
    is_progress: isUnderLookup.value && !isLinkRecordDropdown.value ? false : parseProp(column?.value?.meta).is_progress ?? false,
  }
})

const showInput = computed(() => !readOnly.value && (!isGrid.value || isExpandedFormOpen.value))

const focus: VNodeRef = (el) => {
  if ((!isExpandedFormOpen.value || localEditEnabled.value) && !isEditColumn.value) {
    inputRef.value = el as HTMLInputElement

    if (cellFocused.value) return

    if (isExpandedFormOpen.value) {
      inputRef.value?.focus()
      inputRef.value?.select()
    } else if (!isForm.value) {
      inputRef.value?.focus()
    }
  }
}

const vModel = computed({
  get: () => {
    return isForm.value && !isEditColumn.value && !cellFocused.value && !ncIsNaN(_vModel.value) && props.location !== 'filter'
      ? `${roundUpToPrecision(Number(_vModel.value), percentMeta.value.precision ?? 2)}%`
      : _vModel.value
  },
  set: (value) => {
    if (value === '') {
      _vModel.value = null
    } else if (isForm.value && !isEditColumn.value) {
      _vModel.value = ncIsNaN(value) ? value : Number(value)
    } else {
      _vModel.value = value
    }
  },
})
const vModelNumber = computed<number>(() => {
  if (_vModel.value && _vModel.value !== '' && !ncIsNaN(_vModel.value)) {
    return Number(_vModel.value)
  }
  return 0
})

const inputType = computed(() => (isForm.value && !isEditColumn.value && props.location !== 'filter' ? 'text' : 'number'))

const onBlur = () => {
  if (isExpandedFormOpen.value) {
    editEnabled.value = false
    cellFocused.value = false
    localEditEnabled.value = false
  }
}

const onFocus = () => {
  cellFocused.value = true
}
onMounted(() => {
  if (isCanvasInjected || (!isEditColumn.value && !isForm.value)) {
    inputRef.value?.focus()
    if (isExpandedFormOpen.value) {
      inputRef.value?.select()
    }
  }
})
</script>

<template>
  <CellPercentProgressBar
    v-if="percentMeta.is_progress && (isForm || isExpandedFormOpen) && !isWorkflow"
    :style="{
      ...((isForm || isExpandedFormOpen) && { 'min-height': '22px', 'height': '22px' }),
    }"
    :is-show-number="true"
    :percentage="vModelNumber"
    :precision="percentMeta.precision"
  >
    <template v-if="showInput" #default>
      <!-- eslint-disable vue/use-v-on-exact -->
      <input
        :ref="focus"
        v-model="vModel"
        class="nc-cell-field w-full !border-none !outline-none focus:ring-0 h-full min-h-[18px]"
        :class="isExpandedFormOpen ? 'py-1' : ''"
        :type="inputType"
        :placeholder="placeholder"
        :disabled="readOnly"
        @blur="onBlur"
        @focus="onFocus"
        @keydown.down.stop
        @keydown.left.stop
        @keydown.right.stop
        @keydown.up.stop
        @keydown.delete.stop
        @keydown.alt.stop
        @selectstart.capture.stop
        @mousedown.stop
      />
    </template>
  </CellPercentProgressBar>
  <div v-else>
    <!-- eslint-disable vue/use-v-on-exact -->
    <input
      :ref="focus"
      v-model="vModel"
      class="nc-cell-field w-full !border-none !outline-none focus:ring-0 py-1"
      :type="inputType"
      :placeholder="placeholder"
      :disabled="readOnly"
      @blur="onBlur"
      @focus="onFocus"
      @keydown.down.stop
      @keydown.left.stop
      @keydown.right.stop
      @keydown.up.stop
      @keydown.delete.stop
      @keydown.alt.stop
      @selectstart.capture.stop
      @mousedown.stop
    />
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
