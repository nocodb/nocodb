<script setup lang="ts">
import dayjs from 'dayjs'
import {
  ActiveCellInj,
  EditColumnInj,
  ReadonlyInj,
  inject,
  onClickOutside,
  useBase,
  useSelectedCellKeyupListener,
  watch,
} from '#imports'

interface Props {
  modelValue?: string | null | undefined
  isPk?: boolean
}

const { modelValue, isPk } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const { isMysql } = useBase()

const { showNull } = useGlobal()

const readOnly = inject(ReadonlyInj, ref(false))

const active = inject(ActiveCellInj, ref(false))

const editable = inject(EditModeInj, ref(false))

const isEditColumn = inject(EditColumnInj, ref(false))

const column = inject(ColumnInj)!

const isTimeInvalid = ref(false)

const dateFormat = isMysql(column.value.source_id) ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD HH:mm:ssZ'

const { t } = useI18n()

const localState = computed({
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
      isTimeInvalid.value = true
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
    } else {
      editable.value = false
    }
  },
  { flush: 'post' },
)

const placeholder = computed(() => {
  if (isEditColumn.value && (modelValue === '' || modelValue === null)) {
    return t('labels.optional')
  } else if (modelValue === null && showNull.value) {
    return t('general.null')
  } else if (isTimeInvalid.value) {
    return t('msg.invalidTime')
  } else {
    return ''
  }
})

const isOpen = computed(() => {
  if (readOnly.value) return false

  return (readOnly.value || (localState.value && isPk)) && !active.value && !editable.value ? false : open.value
})

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
    :show-time="true"
    :bordered="false"
    use12-hours
    format="HH:mm"
    class="!w-full !px-1 !border-none"
    :class="{ 'nc-null': modelValue === null && showNull }"
    :placeholder="placeholder"
    :allow-clear="!readOnly && !localState && !isPk"
    :input-read-only="true"
    :open="isOpen"
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
