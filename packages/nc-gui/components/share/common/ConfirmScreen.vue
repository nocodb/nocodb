<script lang="ts" setup>
interface Props {
  title: string
  description?: string
  okText: string
  cancelText?: string
  okLoading?: boolean
  okDanger?: boolean
  testid?: string
  veKey?: string
}

const props = withDefaults(defineProps<Props>(), {
  description: undefined,
  cancelText: undefined,
  okLoading: false,
  okDanger: false,
  testid: undefined,
  veKey: undefined,
})

const emits = defineEmits<{
  (e: 'cancel'): void
  (e: 'ok'): void
}>()

const { t } = useI18n()
</script>

<template>
  <div class="flex flex-col">
    <div class="px-4 pt-3 pb-2">
      <div class="text-nc-content-gray-emphasis font-semibold text-base">{{ title }}</div>
    </div>

    <NcDivider class="!my-0" />

    <div v-if="description" class="px-4 py-3 text-bodyDefaultSm text-nc-content-gray-subtle leading-snug">
      {{ description }}
    </div>

    <div class="flex items-center justify-end gap-2 px-3 py-3">
      <NcButton type="secondary" size="small" :data-testid="testid ? `${testid}-cancel` : undefined" @click="emits('cancel')">
        {{ cancelText || t('general.cancel') }}
      </NcButton>
      <NcButton
        v-e="props.veKey ? [props.veKey] : undefined"
        :type="okDanger ? 'danger' : 'primary'"
        size="small"
        :loading="okLoading"
        :data-testid="testid ? `${testid}-ok` : undefined"
        @click="emits('ok')"
      >
        {{ okText }}
      </NcButton>
    </div>
  </div>
</template>
