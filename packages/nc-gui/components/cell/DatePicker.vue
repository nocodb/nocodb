<script setup lang="ts">
import dayjs from 'dayjs'
import {
  ActiveCellInj,
  CellClickHookInj,
  ColumnInj,
  EditColumnInj,
  EditModeInj,
  ReadonlyInj,
  computed,
  inject,
  isDrawerOrModalExist,
  parseProp,
  ref,
  useSelectedCellKeyupListener,
  watch,
} from '#imports'

interface Props {
  modelValue?: string | null
  isPk?: boolean
}

const { modelValue, isPk } = defineProps<Props>()
const emit = defineEmits(['update:modelValue'])

const { t } = useI18n()

const { showNull } = useGlobal()

const columnMeta = inject(ColumnInj, null)!

const readOnly = inject(ReadonlyInj, ref(false))

const isLockedMode = inject(IsLockedInj, ref(false))

const isEditColumn = inject(EditColumnInj, ref(false))

const active = inject(ActiveCellInj, ref(false))

const editable = inject(EditModeInj, ref(false))

const isDateInvalid = ref(false)

const dateFormat = computed(() => parseProp(columnMeta?.value?.meta)?.date_format ?? 'YYYY-MM-DD')

const localState = computed({
  get() {
    if (!modelValue) {
      return undefined
    }

    if (!dayjs(modelValue).isValid()) {
      isDateInvalid.value = true
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
  } else if (isDateInvalid.value) {
    return t('msg.invalidDate')
  } else {
    return ''
  }
})

useSelectedCellKeyupListener(active, (e: KeyboardEvent) => {
  switch (e.key) {
    case 'Enter':
      e.stopPropagation()
      // skip if drawer / modal is active
      if (isDrawerOrModalExist()) {
        return
      }
      if (!open.value) {
        // open date picker
        open.value = true
      } else {
        // select the current day
        const el = document.querySelector('.nc-picker-date.active .ant-picker-cell-selected') as HTMLButtonElement
        if (el) {
          el.click()
          open.value = false
        }
      }
      break
    case 'Escape':
      // skip if drawer / modal is active
      if (isDrawerOrModalExist()) {
        return
      }
      if (open.value) {
        e.stopPropagation()
        open.value = false
      }
      break
    case 'ArrowLeft':
      if (!localState.value) {
        ;(document.querySelector('.nc-picker-date.active .ant-picker-header-prev-btn') as HTMLButtonElement)?.click()
      } else {
        const prevEl = document.querySelector('.nc-picker-date.active .ant-picker-cell-selected')
          ?.previousElementSibling as HTMLButtonElement
        if (prevEl) {
          prevEl.click()
        } else {
          // get the last td from previous tr
          const prevRowLastEl = document
            .querySelector('.nc-picker-date.active .ant-picker-cell-selected')
            ?.closest('tr')
            ?.previousElementSibling?.querySelector('td:last-child') as HTMLButtonElement
          if (prevRowLastEl) {
            prevRowLastEl.click()
          } else {
            // go to the previous month
            ;(document.querySelector('.nc-picker-date.active .ant-picker-header-prev-btn') as HTMLButtonElement)?.click()
          }
        }
      }
      break
    case 'ArrowRight':
      if (!localState.value) {
        ;(document.querySelector('.nc-picker-date.active .ant-picker-header-next-btn') as HTMLButtonElement)?.click()
      } else {
        const nextEl = document.querySelector('.nc-picker-date.active .ant-picker-cell-selected')
          ?.nextElementSibling as HTMLButtonElement
        if (nextEl) {
          nextEl.click()
        } else {
          // get the last td from previous tr
          const nextRowFirstEl = document
            .querySelector('.nc-picker-date.active .ant-picker-cell-selected')
            ?.closest('tr')
            ?.nextElementSibling?.querySelector('td:first-child') as HTMLButtonElement
          if (nextRowFirstEl) {
            nextRowFirstEl.click()
          } else {
            // go to the next month
            ;(document.querySelector('.nc-picker-date.active .ant-picker-header-next-btn') as HTMLButtonElement)?.click()
          }
        }
      }
      break
    case 'ArrowUp':
      if (!localState.value)
        (document.querySelector('.nc-picker-date.active .ant-picker-header-super-prev-btn') as HTMLButtonElement)?.click()
      break
    case 'ArrowDown':
      if (!localState.value)
        (document.querySelector('.nc-picker-date.active .ant-picker-header-super-next-btn') as HTMLButtonElement)?.click()
      break
    case ';':
      localState.value = dayjs(new Date())
      break
  }
})

const isOpen = computed(() => {
  if (readOnly.value) return false

  return ((readOnly.value || (localState.value && isPk)) && !active.value && !editable.value) || isLockedMode.value
    ? false
    : open.value
})

// use the default date picker open sync only to close the picker
const updateOpen = (next: boolean) => {
  if (open.value && !next) {
    open.value = false
  }
}

const cellClickHook = inject(CellClickHookInj, null)
const cellClickHandler = () => {
  open.value = (active.value || editable.value) && !open.value
}
onMounted(() => {
  cellClickHook?.on(cellClickHandler)
})
onUnmounted(() => {
  cellClickHook?.on(cellClickHandler)
})

const clickHandler = () => {
  if (cellClickHook) {
    return
  }
  cellClickHandler()
}
</script>

<template>
  <a-date-picker
    v-model:value="localState"
    :bordered="false"
    class="!w-full !px-1 !border-none"
    :class="{ 'nc-null': modelValue === null && showNull }"
    :format="dateFormat"
    :placeholder="placeholder"
    :allow-clear="!readOnly && !localState && !isPk"
    :input-read-only="true"
    :dropdown-class-name="`${randomClass} nc-picker-date ${open ? 'active' : ''}`"
    :open="isOpen"
    @click="clickHandler"
    @update:open="updateOpen"
  >
    <template #suffixIcon></template>
  </a-date-picker>
</template>

<style scoped>
:deep(.ant-picker-input > input[disabled]) {
  @apply !text-current;
}
</style>
