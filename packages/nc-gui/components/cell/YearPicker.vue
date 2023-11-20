<script setup lang="ts">
import dayjs from 'dayjs'
import {
  ActiveCellInj,
  EditColumnInj,
  ReadonlyInj,
  computed,
  inject,
  onClickOutside,
  ref,
  useSelectedCellKeyupListener,
  watch,
} from '#imports'

interface Props {
  modelValue?: number | string | null
  isPk?: boolean
}

const { modelValue, isPk = false } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const { showNull } = useGlobal()

const readOnly = inject(ReadonlyInj, ref(false))

const active = inject(ActiveCellInj, ref(false))

const editable = inject(EditModeInj, ref(false))

const isEditColumn = inject(EditColumnInj, ref(false))

const isYearInvalid = ref(false)

const { t } = useI18n()

const localState = computed({
  get() {
    if (!modelValue) {
      return undefined
    }

    const yearDate = dayjs(modelValue.toString(), 'YYYY')
    if (!yearDate.isValid()) {
      isYearInvalid.value = true
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
      emit('update:modelValue', val.format('YYYY'))
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
  } else if (isYearInvalid.value) {
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
  <a-date-picker
    v-model:value="localState"
    picker="year"
    :bordered="false"
    class="!w-full !px-1 !border-none"
    :class="{ 'nc-null': modelValue === null && showNull }"
    :placeholder="placeholder"
    :allow-clear="(!readOnly && !localState && !isPk) || isEditColumn"
    :input-read-only="true"
    :open="isOpen"
    :dropdown-class-name="`${randomClass} nc-picker-year ${open ? 'active' : ''}`"
    @click="open = (active || editable) && !open"
    @change="open = (active || editable) && !open"
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
