<script setup lang="ts">
interface Props {
  modelValue?: string | null
}

const { modelValue: value } = defineProps<Props>()

const { t } = useI18n()

const column = inject(ColumnInj)!

const disableOverlay = inject(CellUrlDisableOverlayInj, ref(false))

const rowHeight = inject(RowHeightInj, ref(undefined))

const readOnly = inject(ReadonlyInj, ref(false))

const trim = (val: string) => val?.trim?.()

const isValid = computed(() => value && isValidURL(trim(value)))

const url = computed(() => {
  if (!value || !isValidURL(trim(value))) return ''

  /** add url scheme if missing */
  if (/^https?:\/\//.test(trim(value))) return trim(value)

  return `https://${trim(value)}`
})

const { cellUrlOptions } = useCellUrlConfig(url)
</script>

<template>
  <div class="flex flex-row items-center justify-between w-full h-full">
    <nuxt-link
      v-if="isValid && !cellUrlOptions?.overlay"
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

    <span v-else class="w-9/10 overflow-ellipsis overflow-hidden">
      <LazyCellClampedText :value="value" :lines="rowHeight" class="nc-cell-field" />
    </span>

    <div v-if="column.meta?.validate && !isValid && value?.length" class="mr-1 w-4">
      <NcTooltip class="flex items-center">
        <template #title> {{ t('msg.error.invalidURL') }} </template>

        <GeneralIcon icon="info" class="text-red-400 h-4 w-4 flex-none relative z-3" />
      </NcTooltip>
    </div>
  </div>
</template>
