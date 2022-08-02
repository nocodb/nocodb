<script setup lang="ts">
import dayjs from 'dayjs'
import { ReadonlyInj } from '~/context'

const { modelValue } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

interface Props {
  modelValue: string
}

const { isMysql } = useProject()

const readOnlyMode = inject(ReadonlyInj, false)

let isDateInvalid = $ref(false)
const dateFormat = isMysql ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD HH:mm:ssZ'

const localState = $computed({
  get() {
    if (!modelValue) {
      return undefined
    }

    if (!dayjs(modelValue).isValid()) {
      isDateInvalid = true
      return undefined
    }

    return /^\d+$/.test(modelValue) ? dayjs(+modelValue) : dayjs(modelValue)
  },
  set(val?: dayjs.Dayjs) {
    if (!val) {
      emit('update:modelValue', null)
      return
    }

    if (val.isValid()) {
      emit('update:modelValue', val?.format(dateFormat))
    }
  },
})
</script>

<template>
  <a-date-picker
    v-model:value="localState"
    :show-time="true"
    :bordered="false"
    class="!w-full px-1"
    format="YYYY-MM-DD HH:mm"
    :placeholder="isDateInvalid ? 'Invalid date' : !readOnlyMode ? 'Select date and time' : ''"
    :allow-clear="!readOnlyMode"
    :input-read-only="true"
    :open="readOnlyMode ? false : undefined"
  >
    <template #suffixIcon></template>
  </a-date-picker>
</template>

<style scoped></style>
