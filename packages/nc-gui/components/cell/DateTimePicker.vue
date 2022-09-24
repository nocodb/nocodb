<script setup lang="ts">
import dayjs from 'dayjs'
import { ReadonlyInj, inject, ref, useProject, watch } from '#imports'

interface Props {
  modelValue?: string | null
}

const { modelValue } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const { isMysql } = useProject()

const readOnly = inject(ReadonlyInj, false)

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

const open = ref(false)

const randomClass = `picker_${Math.floor(Math.random() * 99999)}`
watch(
  open,
  (next) => {
    if (next) {
      onClickOutside(document.querySelector(`.${randomClass}`)! as HTMLDivElement, () => (open.value = false))
    }
  },
  { flush: 'post' },
)
</script>

<template>
  <a-date-picker
    v-model:value="localState"
    :show-time="true"
    :bordered="false"
    class="!w-full px-1"
    format="YYYY-MM-DD HH:mm"
    :placeholder="isDateInvalid ? 'Invalid date' : ''"
    :allow-clear="!readOnly"
    :input-read-only="true"
    :dropdown-class-name="`${randomClass} nc-picker-datetime`"
    :open="readOnly ? false : open"
    :disabled="readOnly"
    @click="open = !open"
    @ok="open = !open"
  >
    <template #suffixIcon></template>
  </a-date-picker>
</template>

<style scoped>
:deep(.ant-picker-input > input[disabled]) {
  @apply !text-current;
}
</style>
