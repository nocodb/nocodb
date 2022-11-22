<script setup lang="ts">
import type { VNodeRef } from '@vue/runtime-core'
import {
  ColumnInj,
  EditModeInj,
  computed,
  convertDurationToSeconds,
  convertMS2Duration,
  durationOptions,
  inject,
  ref,
} from '#imports'

interface Props {
  modelValue: number | string | null | undefined
}

const { modelValue } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const column = inject(ColumnInj)

const editEnabled = inject(EditModeInj)

const showWarningMessage = ref(false)

const durationInMS = ref(0)

const isEdited = ref(false)

const durationType = computed(() => column?.value?.meta?.duration || 0)

const durationPlaceholder = computed(() => durationOptions[durationType.value].title)

const localState = computed({
  get: () => convertMS2Duration(modelValue, durationType.value),
  set: (val) => {
    isEdited.value = true
    const res = convertDurationToSeconds(val, durationType.value)
    if (res._isValid) {
      durationInMS.value = res._sec
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
}

const focus: VNodeRef = (el) => (el as HTMLInputElement)?.focus()
</script>

<template>
  <div class="duration-cell-wrapper">
    <input
      v-if="editEnabled"
      :ref="focus"
      v-model="localState"
      class="w-full !border-none p-0"
      :class="{ '!px-2': editEnabled }"
      :placeholder="durationPlaceholder"
      @blur="submitDuration"
      @keypress="checkDurationFormat($event)"
      @keydown.enter="submitDuration"
      @keydown.down.stop
      @keydown.left.stop
      @keydown.right.stop
      @keydown.up.stop
      @keydown.delete.stop
    />

    <span v-else> {{ localState }}</span>

    <div v-if="showWarningMessage" class="duration-warning">
      <!-- TODO: i18n -->
      Please enter a number
    </div>
  </div>
</template>

<style scoped>
.duration-warning {
  @apply text-left mt-[10px] text-[#e65100];
}
</style>

<!--
-->
