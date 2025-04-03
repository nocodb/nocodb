<script setup lang="ts">
interface Props {
  modelValue?: number | string | null
  localEditEnabled?: boolean
}

const props = defineProps<Props>()

const emits = defineEmits(['update:localEditEnabled'])

const column = inject(ColumnInj)!

const readOnly = inject(ReadonlyInj, ref(false))

const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))

const isUnderLookup = inject(IsUnderLookupInj, ref(false))

const isUnderLTAR = inject(IsUnderLTARInj, ref(false))

const isGrid = inject(IsGridInj, ref(false))

const isLinkRecordDropdown = inject(IsLinkRecordDropdownInj, ref(false))

const localEditEnabled = useVModel(props, 'localEditEnabled', emits, { defaultValue: false })

const expandedEditEnabled = ref(false)

const percentValue = computed(() => {
  return !ncIsNull(props.modelValue) && !ncIsUndefined(props.modelValue) && !isNaN(Number(props.modelValue))
    ? `${props.modelValue}%`
    : props.modelValue
})
const percentValueNumber = computed(() => {
  if (props.modelValue && props.modelValue !== '' && !isNaN(Number(props.modelValue))) {
    return Number(props.modelValue)
  }
  return 0
})

const percentMeta = computed(() => {
  return {
    is_progress: false,
    ...parseProp(column.value?.meta),
  }
})

const onWrapperFocus = () => {
  if (readOnly.value) return

  localEditEnabled.value = true
}

const onMouseover = () => {
  expandedEditEnabled.value = true
}

const onMouseleave = () => {
  expandedEditEnabled.value = false
}

const progressPercent = computed(() => {
  if (
    (isExpandedFormOpen.value ? !expandedEditEnabled.value : true) &&
    !!percentMeta.value.is_progress &&
    !ncIsNull(props.modelValue) &&
    !ncIsUndefined(props.modelValue) &&
    !isUnderLookup
  ) {
    return Number(parseFloat(props.modelValue!.toString()).toFixed(2))
  }

  return null
})

const showAsProgres = computed(
  () => (column.value.meta as any)?.is_progress && (isLinkRecordDropdown.value || (!isUnderLTAR.value && !isUnderLookup.value)),
)

const showInput = computed(() => !readOnly.value && (!isGrid.value || isExpandedFormOpen.value))
</script>

<template>
  <div
    v-if="showAsProgres"
    class="nc-cell-field percent-progress w-full py-1 flex"
    :style="{
      ...(isExpandedFormOpen && !isLinkRecordDropdown && { height: '100%' }),
      ...(isLinkRecordDropdown && { height: '16px' }),
    }"
  >
    <div
      class="w-full min-w-[100px]"
      :style="{
        ...(!isExpandedFormOpen && { height: '4px' }),
      }"
      style="min-height: 4px"
      @mouseover="onMouseover"
      @mouseleave="onMouseleave"
      @focus="onWrapperFocus"
      @click="onWrapperFocus"
    >
      <CellPercentProgressBar :percentage="percentValueNumber" :is-show-number="isExpandedFormOpen">
        <template v-if="showInput" #default>
          <input
            class="w-full !border-none !outline-none focus:ring-0 min-h-[10px]"
            :value="modelValue"
            @click="onWrapperFocus"
            @focus="onWrapperFocus"
          />
        </template>
      </CellPercentProgressBar>
    </div>
  </div>
  <div
    v-else
    :tabindex="readOnly ? -1 : 0"
    class="nc-filter-value-select w-full focus:outline-transparent relative z-3"
    :class="readOnly ? 'cursor-not-allowed pointer-events-none' : ''"
    @mouseover="onMouseover"
    @mouseleave="onMouseleave"
    @focus="onWrapperFocus"
    @click="onWrapperFocus"
  >
    <div v-if="progressPercent !== null" class="px-2">
      <a-progress
        :percent="progressPercent"
        size="small"
        status="normal"
        stroke-color="#3366FF"
        trail-color="#E5E5E5"
        :show-info="false"
      />
    </div>
    <!-- nbsp to keep height even if percentValue is zero length -->
    <span v-else class="nc-cell-field">{{ percentValue ? percentValue : '&nbsp;' }} </span>
  </div>
</template>

<style lang="scss">
.nc-cell:has(.progress-container) {
  height: 100% !important;
}
</style>

<style lang="scss" scoped>
td.align-middle .percent-progress {
  align-items: center;
}
td.align-top .percent-progress {
  align-items: center;
  height: 16px;
}
</style>
