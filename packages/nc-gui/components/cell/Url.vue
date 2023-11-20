<script setup lang="ts">
import type { VNodeRef } from '@vue/runtime-core'
import {
  CellUrlDisableOverlayInj,
  ColumnInj,
  EditColumnInj,
  EditModeInj,
  IsExpandedFormOpenInj,
  IsSurveyFormInj,
  computed,
  inject,
  isValidURL,
  message,
  parseProp,
  ref,
  useCellUrlConfig,
  useI18n,
  watch,
} from '#imports'

interface Props {
  modelValue?: string | null
}

const { modelValue: value } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const { t } = useI18n()

const { showNull } = useGlobal()

const column = inject(ColumnInj)!

const editEnabled = inject(EditModeInj)!

const isEditColumn = inject(EditColumnInj, ref(false))

const disableOverlay = inject(CellUrlDisableOverlayInj, ref(false))

// Used in the logic of when to display error since we are not storing the url if it's not valid
const localState = ref(value)

const rowHeight = inject(RowHeightInj, ref(undefined))

const isSurveyForm = inject(IsSurveyFormInj, ref(false))

const vModel = computed({
  get: () => value,
  set: (val) => {
    localState.value = val
    if (!parseProp(column.value.meta)?.validate || (val && isValidURL(val)) || !val || isSurveyForm.value) {
      emit('update:modelValue', val)
    }
  },
})

const isValid = computed(() => value && isValidURL(value))

const url = computed(() => {
  if (!value || !isValidURL(value)) return ''

  /** add url scheme if missing */
  if (/^https?:\/\//.test(value)) return value

  return `https://${value}`
})

const { cellUrlOptions } = useCellUrlConfig(url)

const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))!

const focus: VNodeRef = (el) => !isExpandedFormOpen.value && !isEditColumn.value && (el as HTMLInputElement)?.focus()

watch(
  () => editEnabled.value,
  () => {
    if (parseProp(column.value.meta)?.validate && !editEnabled.value && localState.value && !isValidURL(localState.value)) {
      message.error(t('msg.error.invalidURL'))
      localState.value = undefined
      return
    }
    localState.value = value
  },
)
</script>

<template>
  <div class="flex flex-row items-center justify-between w-full h-full">
    <input
      v-if="editEnabled"
      :ref="focus"
      v-model="vModel"
      :placeholder="isEditColumn ? $t('labels.enterDefaultUrlOptional') : ''"
      class="outline-none text-sm w-full px-2 py-2 bg-transparent h-full"
      @blur="editEnabled = false"
      @keydown.down.stop
      @keydown.left.stop
      @keydown.right.stop
      @keydown.up.stop
      @keydown.delete.stop
      @selectstart.capture.stop
      @mousedown.stop
    />

    <span v-else-if="vModel === null && showNull" class="nc-null uppercase"> $t('general.null')</span>

    <nuxt-link
      v-else-if="isValid && !cellUrlOptions?.overlay"
      no-prefetch
      no-rel
      class="z-3 text-sm underline hover:opacity-75"
      :to="url"
      :target="cellUrlOptions?.behavior === 'replace' ? undefined : '_blank'"
    >
      <LazyCellClampedText :value="value" :lines="rowHeight" />
    </nuxt-link>

    <nuxt-link
      v-else-if="isValid && !disableOverlay && cellUrlOptions?.overlay"
      no-prefetch
      no-rel
      class="z-3 w-full h-full text-center !no-underline hover:opacity-75"
      :to="url"
      :target="cellUrlOptions?.behavior === 'replace' ? undefined : '_blank'"
    >
      <LazyCellClampedText :value="cellUrlOptions.overlay" :lines="rowHeight" />
    </nuxt-link>

    <span v-else class="w-9/10 overflow-ellipsis overflow-hidden"><LazyCellClampedText :value="value" :lines="rowHeight" /></span>

    <div v-if="column.meta?.validate && !isValid && value?.length && !editEnabled" class="mr-1 w-1/10">
      <a-tooltip placement="top">
        <template #title> {{ t('msg.error.invalidURL') }} </template>
        <div class="flex flex-row items-center">
          <MiCircleWarning class="text-red-400 h-4" />
        </div>
      </a-tooltip>
    </div>
  </div>
</template>
