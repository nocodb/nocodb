<script setup lang="ts">
import dayjs from 'dayjs'
import { storeToRefs } from 'pinia'
import {
  ActiveCellInj,
  ColumnInj,
  ReadonlyInj,
  dateFormats,
  inject,
  isDrawerOrModalExist,
  ref,
  timeFormats,
  useProject,
  useSelectedCellKeyupListener,
  watch,
} from '#imports'

interface Props {
  modelValue?: string | null
  isPk?: boolean
}

const { modelValue, isPk } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const { isMysql } = useProject()

const { showNull } = useGlobal()

const readOnly = inject(ReadonlyInj, ref(false))

const active = inject(ActiveCellInj, ref(false))

const editable = inject(EditModeInj, ref(false))

const column = inject(ColumnInj)!

let isDateInvalid = $ref(false)

const dateTimeFormat = $computed(() => {
  const dateFormat = column?.value?.meta?.date_format ?? dateFormats[0]
  const timeFormat = column?.value?.meta?.time_format ?? timeFormats[0]
  return `${dateFormat} ${timeFormat}`
})

let localState = $computed({
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
      emit('update:modelValue', val?.format(isMysql(column.value.base_id) ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD HH:mm:ssZ'))
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

const placeholder = computed(() => (modelValue === null && showNull.value ? 'NULL' : isDateInvalid ? 'Invalid date' : ''))

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
        // click Ok button to save the currently selected date
        ;(document.querySelector('.nc-picker-datetime.active .ant-picker-ok button') as HTMLButtonElement)?.click()
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
      if (!localState) {
        ;(document.querySelector('.nc-picker-datetime.active .ant-picker-header-prev-btn') as HTMLButtonElement)?.click()
      } else {
        const prevEl = document.querySelector('.nc-picker-datetime.active .ant-picker-cell-selected')
          ?.previousElementSibling as HTMLButtonElement
        if (prevEl) {
          prevEl.click()
        } else {
          // get the last td from previous tr
          const prevRowLastEl = document
            .querySelector('.nc-picker-datetime.active .ant-picker-cell-selected')
            ?.closest('tr')
            ?.previousElementSibling?.querySelector('td:last-child') as HTMLButtonElement
          if (prevRowLastEl) {
            prevRowLastEl.click()
          } else {
            // go to the previous month
            ;(document.querySelector('.nc-picker-datetime.active .ant-picker-header-prev-btn') as HTMLButtonElement)?.click()
          }
        }
      }
      break
    case 'ArrowRight':
      if (!localState) {
        ;(document.querySelector('.nc-picker-datetime.active .ant-picker-header-next-btn') as HTMLButtonElement)?.click()
      } else {
        const nextEl = document.querySelector('.nc-picker-datetime.active .ant-picker-cell-selected')
          ?.nextElementSibling as HTMLButtonElement
        if (nextEl) {
          nextEl.click()
        } else {
          // get the last td from previous tr
          const nextRowFirstEl = document
            .querySelector('.nc-picker-datetime.active .ant-picker-cell-selected')
            ?.closest('tr')
            ?.nextElementSibling?.querySelector('td:first-child') as HTMLButtonElement
          if (nextRowFirstEl) {
            nextRowFirstEl.click()
          } else {
            // go to the next month
            ;(document.querySelector('.nc-picker-datetime.active .ant-picker-header-next-btn') as HTMLButtonElement)?.click()
          }
        }
      }
      break
    case 'ArrowUp':
      if (!localState)
        (document.querySelector('.nc-picker-datetime.active .ant-picker-header-super-prev-btn') as HTMLButtonElement)?.click()
      break
    case 'ArrowDown':
      if (!localState)
        (document.querySelector('.nc-picker-datetime.active .ant-picker-header-super-next-btn') as HTMLButtonElement)?.click()
      break
    case ';':
      localState = dayjs(new Date())
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
    :class="{ 'nc-null': modelValue === null && showNull }"
    :format="dateTimeFormat"
    :placeholder="placeholder"
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
