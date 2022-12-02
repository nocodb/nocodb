<script setup lang="ts">
import dayjs from 'dayjs'
import { ActiveCellInj, ReadonlyInj, inject, onClickOutside, useProject, useSelectedCellKeyupListener, watch } from '#imports'

interface Props {
  modelValue?: string | null | undefined
  isPk?: boolean
}

const { modelValue, isPk } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const { isMysql } = useProject()

const readOnly = inject(ReadonlyInj, ref(false))

const active = inject(ActiveCellInj, ref(false))

const editable = inject(EditModeInj, ref(false))

let isTimeInvalid = $ref(false)

const dateFormat = isMysql.value ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD HH:mm:ssZ'

const localState = $computed({
  get() {
    if (!modelValue) {
      return undefined
    }
    let dateTime = dayjs(modelValue)

    if (!dateTime.isValid()) {
      dateTime = dayjs(modelValue, 'HH:mm:ss')
    }
    if (!dateTime.isValid()) {
      dateTime = dayjs(`1999-01-01 ${modelValue}`)
    }
    if (!dateTime.isValid()) {
      isTimeInvalid = true
      return undefined
    }

    return dateTime
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
  <a-time-picker
    v-model:value="localState"
    autofocus
    :show-time="true"
    :bordered="false"
    use12-hours
    format="HH:mm"
    class="!w-full !px-0 !border-none"
    :placeholder="isTimeInvalid ? 'Invalid time' : ''"
    :allow-clear="!readOnly && !localState && !isPk"
    :input-read-only="true"
    :open="(readOnly || (localState && isPk)) && !active && !editable ? false : open"
    :popup-class-name="`${randomClass} nc-picker-time ${open ? 'active' : ''}`"
    @click="open = (active || editable) && !open"
    @ok="open = !open"
  >
    <template #suffixIcon></template>
  </a-time-picker>
</template>

<style scoped>
:deep(.ant-picker-input > input[disabled]) {
  @apply !text-current;
}
</style>
