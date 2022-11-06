<script setup lang="ts">
import dayjs from 'dayjs'
import { ActiveCellInj, ReadonlyInj, inject, ref, useProject, useSelectedCellKeyupListener, watch } from '#imports'

interface Props {
  modelValue?: string | null
  isPk?: boolean
}

const { modelValue, isPk } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const { isMysql } = useProject()

const readOnly = inject(ReadonlyInj, ref(false))

const active = inject(ActiveCellInj, ref(false))

const editable = inject(EditModeInj, ref(false))

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
    :show-time="true"
    :bordered="false"
    class="!w-full !px-0 !border-none"
    format="YYYY-MM-DD HH:mm"
    :placeholder="isDateInvalid ? 'Invalid date' : ''"
    :allow-clear="!readOnly && !localState && !isPk"
    :input-read-only="true"
    :dropdown-class-name="`${randomClass} nc-picker-datetime ${open ? 'active' : ''}`"
    :open="readOnly || (localState && isPk) ? false : open && (active || editable)"
    :disabled="readOnly || (localState && isPk)"
    @click="open = (active || editable) && !open"
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
