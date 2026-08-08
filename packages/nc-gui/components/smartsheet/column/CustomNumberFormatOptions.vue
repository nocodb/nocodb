<script setup lang="ts">
import { formatCustomNumber, isValidCustomNumberFormat } from 'nocodb-sdk'

const props = defineProps<{
  value: any
}>()

const emit = defineEmits(['update:value'])

const { t } = useI18n()

const vModel = useVModel(props, 'value', emit)

// Enabling this is opt-in: `meta.custom_format` is undefined by default,
// which keeps existing separator/precision-based formatting untouched.
const enabled = computed({
  get: () => !!vModel.value.meta?.custom_format,
  set: (val: boolean) => {
    if (!val) {
      vModel.value.meta.custom_format = undefined
    } else {
      draftFormat.value = vModel.value.meta.custom_format || '0'
      vModel.value.meta.custom_format = draftFormat.value
    }
  },
})

// `draftFormat` is what the input is bound to — it always reflects exactly
// what the user typed, including invalid, half-finished formats. It is
// intentionally decoupled from `vModel.meta.custom_format`, which must only
// ever contain a format string that has passed validation: that field gets
// persisted to the column, so it can never be allowed to hold something like
// an unmatched quote or an over-sectioned string just because the user
// hasn't finished typing yet or made a mistake.
const draftFormat = ref(vModel.value.meta?.custom_format ?? '0')

const validation = computed(() => isValidCustomNumberFormat(draftFormat.value))

watch(draftFormat, (val) => {
  if (isValidCustomNumberFormat(val).valid) {
    vModel.value.meta.custom_format = val
  }
  // if invalid, deliberately leave vModel.meta.custom_format untouched at
  // its last-known-valid value — the draft input still shows what the user
  // typed, and the inline error tells them why it wasn't saved yet.
})

const previewSamples = [1234.5, -1234.5, 0]

const previews = computed(() => {
  if (!validation.value.valid) return []
  return previewSamples.map((sample) => ({
    sample,
    formatted: formatCustomNumber(sample, draftFormat.value),
  }))
})
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-center justify-between">
      <span class="text-sm">{{ t('labels.customNumberFormat') || 'Custom format' }}</span>
      <a-switch v-model:checked="enabled" size="small" />
    </div>

    <template v-if="enabled">
      <a-form-item :validate-status="validation.valid ? '' : 'error'" :help="validation.valid ? '' : validation.error">
        <a-input
          v-model:value="draftFormat"
          placeholder='e.g. 0" ft"  or  #,##0.00" W"'
          dropdown-class-name="nc-dropdown-custom-number-format"
        />
      </a-form-item>

      <div v-if="!validation.valid" class="text-xs text-nc-content-red-dark">
        Not saved yet — fix the format above. Last valid format in use:
        <span class="font-mono">{{ vModel.meta.custom_format }}</span>
      </div>

      <div v-if="validation.valid" class="flex flex-col gap-1 text-xs text-nc-content-gray-muted">
        <div v-for="p in previews" :key="p.sample" class="flex justify-between">
          <span>{{ p.sample }}</span>
          <span>→ {{ p.formatted || '(empty)' }}</span>
        </div>
      </div>

      <NcTooltip class="text-xs text-nc-content-brand cursor-pointer">
        <template #title>
          Supports Excel/Google Sheets style tokens: 0 # ? , . % "literal text" and
          positive;negative;zero sections.
        </template>
        {{ t('labels.formatSyntaxHelp') || 'Format syntax help' }}
      </NcTooltip>
    </template>
  </div>
</template>
