<script setup lang="ts">
interface Props {
  visible: boolean
  /** Remembers the last-used settings under this key. */
  storageKey: string
  loading?: boolean
  /** Used until the user prints once with their own choices. */
  defaults?: PrintSettings
  /** Records the print can choose from; null while counting. */
  recordCount?: number | null
  /** Cells one record prints with these settings; sets how many records fit in one print. */
  cellsPerRecord: (settings: PrintSettings) => number
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  defaults: () => DEFAULT_PRINT_SETTINGS,
  recordCount: null,
})

const emits = defineEmits<{
  'update:visible': [visible: boolean]
  'print': [settings: PrintSettings, range: PrintRange]
}>()

const { t } = useI18n()

const settings = ref<PrintSettings>(loadPrintSettings(props.storageKey, props.defaults))

const rangeStart = ref<number | null>(1)

const rangeEnd = ref<number | null>(1)

const isOpen = computed({
  get: () => props.visible,
  set: (value) => emits('update:visible', value),
})

const paperSizeOptions = computed(() =>
  (Object.keys(PRINT_PAPER_SIZES) as PrintPaperSize[]).map((value) => {
    const { width, height, unit } = PRINT_PAPER_SIZES[value]
    return {
      value,
      label: t('labels.printSettings.paperSizeOption', {
        name: t(`labels.printSettings.paperSizes.${value}`),
        width: `${width}${unit === 'in' ? '"' : unit}`,
        height: `${height}${unit === 'in' ? '"' : unit}`,
      }),
    }
  }),
)

const orientationOptions = computed(() => [
  { value: 'portrait', label: t('labels.printSettings.portrait') },
  { value: 'landscape', label: t('labels.printSettings.landscape') },
])

const fieldSizingOptions = computed(() => [
  { value: 'actualSize', label: t('labels.printSettings.actualSize') },
  { value: 'fitToWidth', label: t('labels.printSettings.fitToWidth') },
])

const fontSizeOptions = computed(() =>
  (Object.keys(PRINT_FONT_SIZES_PX) as PrintFontSize[]).map((value) => ({
    value,
    label: t(`labels.printSettings.fontSizes.${value}`),
  })),
)

const isCounting = computed(() => props.recordCount === null)

const recordLimit = computed(() => getPrintRecordLimit(props.cellsPerRecord(settings.value)))

const range = computed(() =>
  clampPrintRange(
    { start: rangeStart.value ?? undefined, end: rangeEnd.value ?? undefined },
    props.recordCount ?? 0,
    recordLimit.value,
  ),
)

// The range as last applied, so a new start can keep the batch size.
let appliedRange: PrintRange = { start: 1, end: 1 }

function setRange(next: PrintRange) {
  appliedRange = next
  rangeStart.value = next.start
  rangeEnd.value = next.end
}

function resetRange() {
  if (props.recordCount === null) return

  setRange(getDefaultPrintRange(props.recordCount, recordLimit.value, loadLastPrintedEnd(props.storageKey)))
}

function applyRange() {
  setRange(range.value)
}

function applyRangeStart() {
  if (rangeStart.value === null) return applyRange()

  setRange(
    movePrintRangeStart(
      { ...appliedRange, end: rangeEnd.value ?? appliedRange.end },
      rangeStart.value,
      props.recordCount ?? 0,
      recordLimit.value,
    ),
  )
}

function onPrint() {
  if (isCounting.value || !props.recordCount) return

  applyRange()
  savePrintSettings(props.storageKey, settings.value)
  emits('print', { ...settings.value }, { ...range.value })
}

watch(
  () => [props.visible, props.storageKey] as const,
  ([visible]) => {
    if (!visible) return

    settings.value = loadPrintSettings(props.storageKey, props.defaults)
    resetRange()
  },
)

watch(() => props.recordCount, resetRange, { immediate: true })

watch(recordLimit, (limit, prevLimit) => {
  if (isCounting.value) return

  const current = { start: rangeStart.value ?? appliedRange.start, end: rangeEnd.value ?? appliedRange.end }
  const isUnchanged = current.start === appliedRange.start && current.end === appliedRange.end

  // An edit not yet applied is only clamped.
  setRange(
    isUnchanged
      ? followPrintRangeLimit(appliedRange, prevLimit, limit, props.recordCount ?? 0)
      : clampPrintRange(current, props.recordCount ?? 0, limit),
  )
})
</script>

<template>
  <NcModal
    v-model:visible="isOpen"
    size="xs"
    height="auto"
    :show-separator="false"
    wrap-class-name="nc-print-settings-modal"
    @keydown.esc="isOpen = false"
  >
    <div class="flex flex-col gap-5" data-testid="nc-print-settings">
      <div class="flex items-center justify-between">
        <div class="text-base font-bold text-nc-content-gray-emphasis">
          {{ $t('labels.printSettings.title') }}
        </div>
        <NcButton type="text" size="xsmall" :aria-label="$t('general.close')" @click="isOpen = false">
          <GeneralIcon icon="close" class="text-nc-content-gray-subtle" />
        </NcButton>
      </div>

      <div class="flex flex-col gap-4">
        <label class="nc-print-settings-field">
          <span>{{ $t('labels.printSettings.paperSize') }}</span>
          <NcSelect
            v-model:value="settings.paperSize"
            :options="paperSizeOptions"
            class="nc-select-shadow w-full"
            data-testid="nc-print-settings-paper-size"
          />
        </label>

        <label class="nc-print-settings-field">
          <span>{{ $t('labels.layout') }}</span>
          <NcSelect
            v-model:value="settings.orientation"
            :options="orientationOptions"
            class="nc-select-shadow w-full"
            data-testid="nc-print-settings-orientation"
          />
        </label>

        <div class="grid grid-cols-2 gap-3">
          <label class="nc-print-settings-field">
            <span>{{ $t('labels.printSettings.fieldSizing') }}</span>
            <NcSelect
              v-model:value="settings.fieldSizing"
              :options="fieldSizingOptions"
              class="nc-select-shadow w-full"
              data-testid="nc-print-settings-field-sizing"
            />
          </label>

          <label class="nc-print-settings-field">
            <span>{{ $t('labels.printSettings.fontSize') }}</span>
            <NcSelect
              v-model:value="settings.fontSize"
              :options="fontSizeOptions"
              class="nc-select-shadow w-full"
              data-testid="nc-print-settings-font-size"
            />
          </label>
        </div>

        <div class="nc-print-settings-field" data-testid="nc-print-settings-records">
          <span>{{ $t('labels.printSettings.records') }}</span>
          <div class="flex items-center gap-2">
            <a-input-number
              v-model:value="rangeStart"
              :min="1"
              :max="Math.max(props.recordCount ?? 1, 1)"
              :precision="0"
              :controls="false"
              :disabled="isCounting"
              class="nc-print-settings-range-input"
              :aria-label="$t('labels.printSettings.rangeFrom')"
              data-testid="nc-print-settings-range-start"
              @blur="applyRangeStart"
              @press-enter="applyRangeStart"
            />
            <span class="text-nc-content-gray-subtle">{{ $t('labels.to') }}</span>
            <a-input-number
              v-model:value="rangeEnd"
              :min="1"
              :max="Math.max(props.recordCount ?? 1, 1)"
              :precision="0"
              :controls="false"
              :disabled="isCounting"
              class="nc-print-settings-range-input"
              :aria-label="$t('labels.printSettings.rangeTo')"
              data-testid="nc-print-settings-range-end"
              @blur="applyRange"
              @press-enter="applyRange"
            />
          </div>
          <span class="text-bodySm text-nc-content-gray-muted" data-testid="nc-print-settings-range-hint">
            <template v-if="isCounting">{{ $t('labels.printSettings.countingRecords') }}</template>
            <template v-else>
              {{
                $t(
                  'labels.printSettings.rangeHint',
                  {
                    total: (props.recordCount ?? 0).toLocaleString(),
                    limit: recordLimit.toLocaleString(),
                  },
                  props.recordCount ?? 0,
                )
              }}
            </template>
          </span>
        </div>

        <div class="flex flex-col gap-3">
          <div class="flex items-center">
            <NcSwitch v-model:checked="settings.showTitle" size="small" data-testid="nc-print-settings-show-title">
              <span class="text-bodyDefaultSm text-nc-content-gray">{{ $t('labels.printSettings.showTitle') }}</span>
            </NcSwitch>
          </div>
          <div class="flex items-center">
            <NcSwitch v-model:checked="settings.showRowNumbers" size="small" data-testid="nc-print-settings-row-numbers">
              <span class="text-bodyDefaultSm text-nc-content-gray">{{ $t('labels.printSettings.showRowNumbers') }}</span>
            </NcSwitch>
          </div>
          <div class="flex items-center">
            <NcSwitch v-model:checked="settings.wrapText" size="small" data-testid="nc-print-settings-wrap-text">
              <span class="text-bodyDefaultSm text-nc-content-gray">{{ $t('labels.printSettings.wrapText') }}</span>
            </NcSwitch>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-end gap-2">
        <NcButton type="secondary" size="small" data-testid="nc-print-settings-cancel" @click="isOpen = false">
          {{ $t('general.cancel') }}
        </NcButton>
        <NcButton
          v-e="['c:view:print']"
          type="primary"
          size="small"
          :loading="props.loading"
          :disabled="props.loading || isCounting || !props.recordCount"
          data-testid="nc-print-settings-print"
          @click="onPrint"
        >
          {{ $t('labels.print') }}
        </NcButton>
      </div>
    </div>
  </NcModal>
</template>

<style lang="scss" scoped>
.nc-print-settings-field {
  @apply flex flex-col gap-2 text-bodyDefaultSm text-nc-content-gray min-w-0;
}

.nc-print-settings-range-input {
  @apply flex-1 min-w-0 rounded-lg;
}
</style>
