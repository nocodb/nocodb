<script lang="ts" setup>
const props = defineProps<{
  value: any
  isVisibleDefaultValueInput: boolean
}>()
const emits = defineEmits(['update:value', 'update:isVisibleDefaultValueInput'])

provide(EditColumnInj, ref(true))

const vModel = useVModel(props, 'value', emits)

const isVisibleDefaultValueInput = useVModel(props, 'isVisibleDefaultValueInput', emits)

const { isAiModeFieldModal } = usePredictFields()

const { isSyncedField } = useColumnCreateStoreOrThrow()

const defaultValueWrapperRef = ref<HTMLDivElement>()

const cdfValue = computed({
  get: () => vModel.value.cdf,
  set: (value) => {
    if (value === '<br />' || value === '<br>') {
      vModel.value.cdf = null
    } else {
      vModel.value.cdf = value
    }
  },
})

const handleShowInput = () => {
  isVisibleDefaultValueInput.value = true

  // In playwright testing we first enable this default input and then start filling all fields
  // So it's imp to not to focus input
  if (ncIsPlaywright()) return

  nextTick(() => {
    ncDelay(300).then(() => {
      if (defaultValueWrapperRef.value) {
        focusInputEl('.nc-cell', defaultValueWrapperRef.value)
      }
    })
  })
}
</script>

<template>
  <div v-if="!isVisibleDefaultValueInput">
    <NcButton
      size="small"
      type="text"
      :disabled="isSyncedField"
      class="text-nc-content-gray-subtle"
      data-testid="nc-show-default-value-btn"
      @click.stop="handleShowInput"
    >
      <div class="flex items-center gap-2">
        <GeneralIcon icon="plus" class="flex-none h-4 w-4" />
        <span>{{ $t('general.set') }} {{ $t('placeholder.defaultValue').toLowerCase() }}</span>
      </div>
    </NcButton>
  </div>

  <div v-else>
    <div class="w-full flex items-center gap-2 mb-2">
      <div class="text-small leading-[18px] flex-1 text-nc-content-gray-subtle">{{ $t('placeholder.defaultValue') }}</div>
    </div>
    <div class="flex flex-row gap-2">
      <div
        ref="defaultValueWrapperRef"
        class="nc-default-value-wrapper nc-rich-long-text-default-value border-1 relative pt-7 flex items-center w-full px-0 border-nc-border-gray-dark rounded-md max-h-70 pb-1 focus-within:(border-nc-border-brand shadow-selected) transition-all duration-0.3s"
        :class="{
          'bg-nc-bg-default': isAiModeFieldModal,
        }"
      >
        <LazyCellRichText v-model:value="cdfValue" class="border-t-1 border-nc-border-gray-light !max-h-80 !min-h-30 text-nc-content-gray-subtle2" show-menu />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-rich-long-text-default-value {
  :deep(.nc-rich-text) {
    .bubble-menu.embed-mode.edit-column-mode {
      @apply gap-x-0 p-0 h-7 border-0;

      .nc-button {
        @apply !mt-0 h-7 p-1 min-w-7;

        svg {
          @apply h-4 w-4;
        }
      }
      .divider {
        @apply !m-0 !h-7 border-nc-border-gray-light;
      }
    }
  }
}
</style>
