<script setup lang="ts">
import type { VNodeRef } from '@vue/runtime-core'

interface Props {
  modelValue: number | string | null | undefined
  showValidationError?: boolean
}

const { modelValue, showValidationError = true } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const { showNull } = useGlobal()

const column = inject(ColumnInj)

const editEnabled = inject(EditModeInj, ref(false))

const isEditColumn = inject(EditColumnInj, ref(false))

const readOnly = inject(ReadonlyInj, ref(false))

const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))!

const isForm = inject(IsFormInj)!

const showWarningMessage = ref(false)

const durationInMS = ref(0)

const isEdited = ref(false)

const durationType = computed(() => parseProp(column?.value?.meta)?.duration || 0)

const durationPlaceholder = computed(() => durationOptions[durationType.value].title)

const tempState = ref()

const localState = computed({
  get: () => {
    if (tempState.value === undefined) {
      return convertMS2Duration(modelValue, durationType.value)
    }

    return tempState.value
  },
  set: (val) => {
    tempState.value = val

    isEdited.value = true
    const res = convertDurationToSeconds(val, durationType.value)
    if (res._isValid) {
      durationInMS.value = res._sec
    }

    if (!val) {
      emit('update:modelValue', null)
      isEdited.value = false
      tempState.value = undefined
    } else {
      emit('update:modelValue', durationInMS.value)
    }
  },
})

const checkDurationFormat = (evt: KeyboardEvent) => {
  evt = evt || window.event
  const charCode = evt.which ? evt.which : evt.keyCode
  // ref: http://www.columbia.edu/kermit/ascii.html
  const PRINTABLE_CTL_RANGE = charCode > 31
  const NON_DIGIT = charCode < 48 || charCode > 57
  const NON_COLON = charCode !== 58
  const NON_PERIOD = charCode !== 46
  if (PRINTABLE_CTL_RANGE && NON_DIGIT && NON_COLON && NON_PERIOD) {
    showWarningMessage.value = true
    evt.preventDefault()
  } else {
    showWarningMessage.value = false
    // only allow digits, '.' and ':' (without quotes)
    return true
  }
}

const submitDuration = () => {
  if (isEdited.value) {
    emit('update:modelValue', durationInMS.value)
  }

  isEdited.value = false

  tempState.value = undefined
}

const focus: VNodeRef = (el) =>
  !isExpandedFormOpen.value && !isEditColumn.value && !isForm.value && (el as HTMLInputElement)?.focus()
</script>

<template>
  <div class="duration-cell-wrapper">
    <!-- eslint-disable vue/use-v-on-exact -->
    <input
      v-if="!readOnly && editEnabled"
      :ref="focus"
      v-model="localState"
      class="nc-cell-field w-full !border-none !outline-none py-1"
      :placeholder="durationPlaceholder"
      @blur="submitDuration"
      @keypress="checkDurationFormat($event)"
      @keydown.enter="submitDuration"
      @keydown.down.stop
      @keydown.left.stop
      @keydown.right.stop
      @keydown.up.stop
      @keydown.delete.stop
      @keydown.alt.stop
      @selectstart.capture.stop
      @mousedown.stop
    />

    <span v-else-if="modelValue === null && showNull" class="nc-cell-field nc-null uppercase">{{ $t('general.null') }}</span>

    <span v-else class="nc-cell-field"> {{ localState }}</span>

    <div v-if="showWarningMessage && showValidationError" class="nc-cell-field duration-warning">
      {{ $t('msg.plsEnterANumber') }}
    </div>
  </div>
</template>

<style scoped lang="scss">
.duration-warning {
  @apply text-left mt-[10px] text-[#e65100];
}
</style>

<!--
-->
