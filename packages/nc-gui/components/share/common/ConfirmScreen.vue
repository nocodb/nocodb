<script lang="ts" setup>
import type { IconMapKey } from '~/utils/iconUtils'

interface Props {
  title: string
  description?: string
  okText: string
  cancelText?: string
  okLoading?: boolean
  okDanger?: boolean
  /**
   * Visual tone of the leading badge. `warning` (default) renders an amber
   * triangle, `destructive` renders a red one. Pass `none` to skip.
   */
  tone?: 'warning' | 'destructive' | 'none'
  icon?: IconMapKey
  testid?: string
  veKey?: string
}

const props = withDefaults(defineProps<Props>(), {
  description: undefined,
  cancelText: undefined,
  okLoading: false,
  okDanger: false,
  tone: 'warning',
  icon: 'ncAlertTriangle',
  testid: undefined,
  veKey: undefined,
})

const emits = defineEmits<{
  (e: 'cancel'): void
  (e: 'ok'): void
}>()

const { t } = useI18n()

const cancelBtnRef = ref<any>(null)

const badgeClass = computed(() => {
  if (props.tone === 'destructive') return 'bg-nc-bg-red-light text-nc-content-red-dark'
  if (props.tone === 'warning') return 'bg-nc-bg-orange-light text-nc-content-orange-dark'
  return ''
})

const onKey = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    e.stopPropagation()
    emits('cancel')
  }
}

onMounted(() => {
  // Move focus to the cancel button so destructive action is never the default.
  nextTick(() => {
    cancelBtnRef.value?.$el?.focus?.()
  })
})
</script>

<template>
  <div
    class="flex flex-col"
    role="alertdialog"
    aria-modal="true"
    :aria-labelledby="testid ? `${testid}-title` : undefined"
    :aria-describedby="testid && description ? `${testid}-desc` : undefined"
    tabindex="-1"
    @keydown="onKey"
  >
    <div class="flex items-start gap-3 px-4 pt-4 pb-3">
      <div
        v-if="tone !== 'none'"
        class="flex-none flex items-center justify-center h-9 w-9 rounded-lg"
        :class="badgeClass"
        aria-hidden="true"
      >
        <GeneralIcon :icon="icon" class="!w-4.5 !h-4.5" />
      </div>
      <div class="flex flex-col gap-1 flex-1 min-w-0">
        <div :id="testid ? `${testid}-title` : undefined" class="text-nc-content-gray-emphasis text-subHeading2">
          {{ title }}
        </div>
        <div
          v-if="description"
          :id="testid ? `${testid}-desc` : undefined"
          class="text-bodyDefaultSm text-nc-content-gray-subtle leading-snug"
        >
          {{ description }}
        </div>
      </div>
    </div>

    <div class="flex items-center justify-end gap-2 px-3 pb-3 pt-1">
      <NcButton
        ref="cancelBtnRef"
        type="secondary"
        size="small"
        :data-testid="testid ? `${testid}-cancel` : undefined"
        @click="emits('cancel')"
      >
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
