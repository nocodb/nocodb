<script setup lang="ts">
import { onClickOutside } from '@vueuse/core'
import dayjs from 'dayjs'
import { ReadonlyInj } from '~/context'

interface Props {
  modelValue: number | string | null
}

const { modelValue } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const readOnlyMode = inject(ReadonlyInj, false)

let isYearInvalid = $ref(false)

const localState = $computed({
  get() {
    if (!modelValue) {
      return undefined
    }

    const yearDate = dayjs(modelValue.toString(), 'YYYY')
    if (!yearDate.isValid()) {
      isYearInvalid = true
      return undefined
    }

    return yearDate
  },
  set(val?: dayjs.Dayjs) {
    if (!val) {
      emit('update:modelValue', null)
      return
    }

    if (val?.isValid()) {
      emit('update:modelValue', Number(val.format('YYYY')))
    }
  },
})

const open = ref(false)

const randonClass = `picker_${Math.floor(Math.random() * 99999)}`
watch(
  open,
  (next) => {
    if (next) {
      onClickOutside(document.querySelector(`.${randonClass}`)! as HTMLDivElement, () => (open.value = false))
    }
  },
  { flush: 'post' },
)
</script>

<template>
  <a-date-picker
    v-model:value="localState"
    picker="year"
    :bordered="false"
    class="!w-full px-1"
    :placeholder="isYearInvalid ? 'Invalid year' : !readOnlyMode ? 'Select year' : ''"
    :allow-clear="!readOnlyMode"
    :input-read-only="true"
    :open="readOnlyMode ? false : open"
    :dropdown-class-name="randonClass"
    @click="open = !open"
    @change="open = !open"
  >
    <template #suffixIcon></template>
  </a-date-picker>
</template>

<style scoped></style>
