<script setup lang="ts">
import dayjs from 'dayjs'
import { ColumnInj, ReadonlyInj, computed, inject, ref, watch } from '#imports'

interface Props {
  modelValue?: string | null
}

const { modelValue } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const columnMeta = inject(ColumnInj, null)!

const readOnly = inject(ReadonlyInj, false)

let isDateInvalid = $ref(false)

const dateFormat = columnMeta?.value?.meta?.date_format ?? 'YYYY-MM-DD'

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
      emit('update:modelValue', val?.format('YYYY-MM-DD'))
    }
  },
})
const open = ref<boolean>(false)

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

const placeholder = computed(() => (isDateInvalid ? 'Invalid date' : ''))
</script>

<template>
  <a-date-picker
    v-model:value="localState"
    :bordered="false"
    class="!w-full px-1"
    :format="dateFormat"
    :placeholder="placeholder"
    :allow-clear="!readOnly"
    :input-read-only="true"
    :dropdown-class-name="`${randomClass} nc-picker-date`"
    :open="readOnly ? false : open"
    @click="open = !open"
  >
    <template #suffixIcon></template>
  </a-date-picker>
</template>

<style scoped>
:deep(.ant-picker-input > input[disabled]) {
  @apply !text-current;
}
</style>
