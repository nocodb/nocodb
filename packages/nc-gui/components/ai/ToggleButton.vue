<script lang="ts" setup>
interface Props {
  aiMode: boolean
  aiLoading: boolean
  showWrapperLoading?: boolean
  onClick: () => void
  offTooltip?: string
  onTooltip?: string
}

const props = withDefaults(defineProps<Props>(), {
  aiMode: false,
  aiLoading: false,
  showWrapperLoading: true,
  onClick: () => undefined,
  offTooltip: '',
})

const { t } = useI18n()

const { aiLoading, aiMode, offTooltip } = toRefs(props)

const onTooltip = computed(() => (ncIsUndefined(props.onTooltip) ? t('labels.disableNocoAI') : props.onTooltip))

const disableTooltip = computed(() => {
  if (aiLoading.value) return true

  if (aiMode.value && !onTooltip.value) return true

  if (!aiMode.value && !offTooltip.value) return true

  return !onTooltip.value && !offTooltip.value
})
</script>

<template>
  <NcTooltip
    class="flex"
    :class="{
      'cursor-wait': aiLoading && showWrapperLoading,
    }"
    :title="aiMode ? onTooltip : offTooltip"
    :disabled="disableTooltip"
    hide-on-click
  >
    <NcButton
      type="text"
      size="small"
      class="-my-1 !text-nc-content-purple-dark hover:text-nc-content-purple-dark flex-none"
      :class="{
        '!pointer-events-none !cursor-not-allowed': aiLoading,
        '!bg-nc-bg-purple-dark hover:!bg-gray-100': aiMode,
      }"
      @click.stop="props.onClick"
    >
      <div class="flex items-center justify-center">
        <slot name="icon">
          <GeneralIcon icon="ncAutoAwesome" />
        </slot>
        <span
          class="overflow-hidden trasition-all ease duration-200"
          :class="{ 'w-[0px] invisible': aiMode, 'ml-1 w-[78px]': !aiMode }"
        >
          <slot name="text"> {{ t('labels.useNocoAI') }} </slot>
        </span>
      </div>
    </NcButton>
  </NcTooltip>
</template>
