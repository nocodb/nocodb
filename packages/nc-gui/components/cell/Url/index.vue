<script setup lang="ts">
import type { VNodeRef } from '@vue/runtime-core'

interface Props {
  modelValue?: string | null
}

const { modelValue: value } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const { t } = useI18n()

const { showNull } = useGlobal()

const column = inject(ColumnInj)!

const editEnabled = inject(EditModeInj, ref(false))

const isEditColumn = inject(EditColumnInj, ref(false))

const disableOverlay = inject(CellUrlDisableOverlayInj, ref(false))

const rowHeight = inject(RowHeightInj, ref(undefined))

const readOnly = inject(ReadonlyInj, ref(false))

const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))!

const isForm = inject(IsFormInj)!

const trim = (val: string) => val?.trim?.()

// Used in the logic of when to display error since we are not storing the url if it's not valid
const localState = ref(value)

const vModel = computed({
  get: () => value,
  set: (val) => {
    localState.value = val
    if (!parseProp(column.value.meta)?.validate || (val && isValidURL(trim(val))) || !val || isForm.value) {
      emit('update:modelValue', val)
    }
  },
})

const isValid = computed(() => value && isValidURL(trim(value)))

const url = computed(() => {
  if (!value || !isValidURL(trim(value))) return ''

  /** add url scheme if missing */
  if (/^https?:\/\//.test(trim(value))) return trim(value)

  return `https://${trim(value)}`
})

const { cellUrlOptions } = useCellUrlConfig(url)

const focus: VNodeRef = (el) =>
  !isExpandedFormOpen.value && !isEditColumn.value && !isForm.value && (el as HTMLInputElement)?.focus()

watch(
  () => editEnabled.value,
  () => {
    if (
      !isForm.value &&
      parseProp(column.value.meta)?.validate &&
      !editEnabled.value &&
      localState.value &&
      !isValidURL(trim(localState.value))
    ) {
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
    <!-- eslint-disable vue/use-v-on-exact -->
    <input
      v-if="!readOnly && editEnabled"
      :ref="focus"
      v-model="vModel"
      class="nc-cell-field outline-none w-full py-1 bg-transparent h-full"
      @blur="editEnabled = false"
      @keydown.down.stop
      @keydown.left.stop
      @keydown.right.stop
      @keydown.up.stop
      @keydown.delete.stop
      @keydown.alt.stop
      @selectstart.capture.stop
      @mousedown.stop
    />

    <span v-else-if="vModel === null && showNull" class="nc-cell-field nc-null uppercase"> {{ $t('general.null') }}</span>

    <nuxt-link
      v-else-if="isValid && !cellUrlOptions?.overlay"
      no-prefetch
      no-rel
      class="py-1 z-3 underline nc-cell-field-link max-w-full"
      :to="url"
      :target="cellUrlOptions?.behavior === 'replace' ? undefined : '_blank'"
      :tabindex="readOnly ? -1 : 0"
    >
      <LazyCellClampedText :value="value" :lines="rowHeight" class="nc-cell-field" />
    </nuxt-link>

    <nuxt-link
      v-else-if="isValid && !disableOverlay && cellUrlOptions?.overlay"
      no-prefetch
      no-rel
      class="py-1 z-3 w-full h-full text-center !no-underline nc-cell-field-link max-w-full"
      :to="url"
      :target="cellUrlOptions?.behavior === 'replace' ? undefined : '_blank'"
      :tabindex="readOnly ? -1 : 0"
    >
      <LazyCellClampedText :value="cellUrlOptions.overlay" :lines="rowHeight" class="nc-cell-field" />
    </nuxt-link>

    <span v-else class="w-9/10 overflow-ellipsis overflow-hidden"
      ><LazyCellClampedText :value="value" :lines="rowHeight" class="nc-cell-field"
    /></span>

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
