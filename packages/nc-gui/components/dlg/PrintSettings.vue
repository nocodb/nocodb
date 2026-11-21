<script setup lang="ts">
interface Props {
  visible: boolean
  /** Remembers the last-used settings under this key. */
  storageKey: string
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
})

const emits = defineEmits<{
  'update:visible': [visible: boolean]
  'print': [settings: PrintSettings]
}>()

const { t } = useI18n()

const settings = ref<PrintSettings>(loadPrintSettings(props.storageKey))

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

function onPrint() {
  savePrintSettings(props.storageKey, settings.value)
  emits('print', { ...settings.value })
}

watch(
  () => [props.visible, props.storageKey] as const,
  ([visible]) => {
    if (visible) settings.value = loadPrintSettings(props.storageKey)
  },
)
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
          :disabled="props.loading"
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
</style>
