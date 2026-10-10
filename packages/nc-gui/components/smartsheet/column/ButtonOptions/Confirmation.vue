<script setup lang="ts">
import type { ButtonActionConfig, ButtonConfirmation } from 'nocodb-sdk'

const props = defineProps<{
  modelValue?: ButtonActionConfig | null
}>()

const emits = defineEmits<{
  'update:modelValue': [value: ButtonActionConfig]
}>()

const config = computed<ButtonActionConfig>(() => props.modelValue ?? {})

function setRequired(value: boolean) {
  emits('update:modelValue', { ...config.value, require_confirmation: value || undefined })
}

function setCopy(key: keyof ButtonConfirmation, value: string) {
  emits('update:modelValue', { ...config.value, confirmation: { ...config.value.confirmation, [key]: value || undefined } })
}
</script>

<template>
  <div class="nc-button-field-confirmation flex flex-col gap-2 mt-2">
    <div class="flex items-center justify-between">
      <span class="text-nc-content-gray text-[13px]">{{ $t('labels.interfaceRequireConfirmation') }}</span>
      <NcSwitch
        :checked="!!config.require_confirmation"
        size="small"
        data-testid="nc-button-field-require-confirmation"
        @change="setRequired"
      />
    </div>

    <template v-if="config.require_confirmation">
      <div class="flex flex-col gap-1">
        <span class="text-nc-content-gray-subtle text-[12px]">{{ $t('general.title') }}</span>
        <a-input
          :value="config.confirmation?.title"
          :placeholder="$t('placeholder.interfaceButtonConfirmTitle')"
          :maxlength="255"
          class="nc-input-sm !rounded-lg"
          data-testid="nc-button-field-confirmation-title"
          @update:value="(v: string) => setCopy('title', v)"
        />
      </div>
      <div class="flex flex-col gap-1">
        <span class="text-nc-content-gray-subtle text-[12px]">{{ $t('labels.message') }}</span>
        <a-textarea
          :value="config.confirmation?.message"
          :placeholder="$t('msg.info.interfaceButtonConfirmMessage')"
          :maxlength="255"
          :auto-size="{ minRows: 2, maxRows: 4 }"
          class="!rounded-lg nc-scrollbar-thin"
          data-testid="nc-button-field-confirmation-message"
          @update:value="(v: string) => setCopy('message', v)"
        />
      </div>
      <div class="flex flex-col gap-1">
        <span class="text-nc-content-gray-subtle text-[12px]">{{ $t('labels.buttonLabel') }}</span>
        <a-input
          :value="config.confirmation?.button_label"
          :placeholder="$t('placeholder.interfaceButtonConfirmButtonLabel')"
          :maxlength="255"
          class="nc-input-sm !rounded-lg"
          data-testid="nc-button-field-confirmation-button-label"
          @update:value="(v: string) => setCopy('button_label', v)"
        />
      </div>
    </template>
  </div>
</template>
