<script setup lang="ts">
import dayjs from 'dayjs'
import { ActiveCellInj, ReadonlyInj, computed, inject, onClickOutside, ref, useSelectedCellKeyupListener, watch } from '#imports'

interface Props {
  modelValue?: number | string | null
  isPk?: boolean
}

const { modelValue, isPk = false } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const readOnly = inject(ReadonlyInj, ref(false))

const active = inject(ActiveCellInj, ref(false))

const editable = inject(EditModeInj, ref(false))

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

const placeholder = computed(() => (isYearInvalid ? 'Invalid year' : ''))

useSelectedCellKeyupListener(active, (e: KeyboardEvent) => {
  switch (e.key) {
    case 'Enter':
      e.stopPropagation()
      open.value = true
      break
    case 'Escape':
      if (open.value) {
        e.stopPropagation()
        open.value = false
      }
      break
  }
})
</script>

<template>
  <a-date-picker
    v-model:value="localState"
    picker="year"
    :bordered="false"
    class="!w-full !px-0 !border-none"
    :placeholder="placeholder"
    :allow-clear="!readOnly && !localState && !isPk"
    :input-read-only="true"
    :open="(readOnly || (localState && isPk)) && !active && !editable ? false : open"
    :dropdown-class-name="`${randomClass} nc-picker-year ${open ? 'active' : ''}`"
    @click="open = (active || editable) && !open"
    @change="open = (active || editable) && !open"
  >
    <template #suffixIcon></template>
  </a-date-picker>
</template>

<style scoped>
:deep(.ant-picker-input > input[disabled]) {
  @apply !text-current;
}
</style>
