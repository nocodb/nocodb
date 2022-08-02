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

let isTimeInvalid = $ref(false)
const dateFormat = isMysql ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD HH:mm:ssZ'

const localState = $computed({
  get() {
    if (!modelValue) {
      return undefined
    }

    if (!dayjs(modelValue).isValid()) {
      isTimeInvalid = true
      return undefined
    }

    return dayjs(modelValue)
  },
  set(val?: dayjs.Dayjs) {
    if (!val) {
      emit('update:modelValue', null)
      return
    }

    if (val.isValid()) {
      const time = val.format('HH:mm')
      const date = dayjs(`1999-01-01 ${time}:00`)
      emit('update:modelValue', date.format(dateFormat))
    }
  },
})
</script>

<template>
  <a-time-picker
    v-model:value="localState"
    autofocus
    :show-time="true"
    :bordered="false"
    use12-hours
    format="HH:mm"
    class="!w-full px-1"
    :placeholder="isTimeInvalid ? 'Invalid time' : !readOnlyMode ? 'Select time' : ''"
    :allow-clear="!readOnlyMode"
    :input-read-only="true"
    :open="readOnlyMode ? false : undefined"
  >
    <template #suffixIcon></template>
  </a-time-picker>
</template>

<style scoped></style>
