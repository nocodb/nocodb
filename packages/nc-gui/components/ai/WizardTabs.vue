<script lang="ts" setup>
import { AiWizardTabsType } from '#imports'

interface Props {
  activeTab: AiWizardTabsType
  showCloseBtn?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  activeTab: AiWizardTabsType.AUTO_SUGGESTIONS,
  showCloseBtn: false,
})

const emits = defineEmits(['update:activeTab', 'close'])

const activeTab = useVModel(props, 'activeTab', emits)

const { aiLoading } = useNocoAi()
</script>

<template>
  <NcTabs
    v-model:activeKey="activeTab"
    theme="ai"
    class="nc-ai-wizard-tabs"
    :class="{
      'nc-ai-loading': aiLoading,
    }"
  >
    <template #leftExtra>
      <div class="w-0"></div>
    </template>
    <template #rightExtra>
      <div>
        <NcButton v-if="showCloseBtn" size="small" type="text" @click.stop="emits('close')">
          <GeneralIcon icon="close" class="text-gray-600" />
        </NcButton>
      </div>
    </template>
    <a-tab-pane :key="AiWizardTabsType.AUTO_SUGGESTIONS" class="w-full" :disabled="aiLoading">
      <template #tab>
        <div
          class="tab-title"
          :class="{
            '!cursor-wait': aiLoading,
          }"
        >
          Auto Suggested
        </div>
      </template>
      <div>
        <slot name="AutoSuggestedContent"></slot>
      </div>
    </a-tab-pane>

    <a-tab-pane :key="AiWizardTabsType.PROMPT" class="w-full" disabled>
      <template #tab>
        <NcTooltip class="flex">
          <template #title> {{ $t('msg.toast.futureRelease') }}</template>
          <div class="tab-title">Use Prompt</div>
        </NcTooltip>
      </template>
      <div>
        <slot name="PromptContent"></slot>
      </div>
    </a-tab-pane>
  </NcTabs>
</template>

<style lang="scss" scoped>
.nc-ai-wizard-tabs {
  :deep(.ant-tabs-nav) {
    @apply !pl-0 mx-5;
  }
  :deep(.ant-tabs-tab) {
    @apply px-0 pt-1 pb-2;

    &.ant-tabs-tab-active {
      @apply font-medium;
    }
  }

  &.nc-ai-loading {
    :deep(.ant-tabs-tab) {
      @apply !cursor-wait;
    }
  }

  :deep(.ant-tabs-tab + .ant-tabs-tab) {
    @apply ml-4;
  }

  .tab-title {
    @apply text-xs leading-[24px] px-2 rounded hover:bg-gray-100 transition-colors;
  }

  :deep(.ant-tabs-tab-disabled) {
    .tab-title {
      @apply text-nc-content-gray-muted hover:bg-transparent;
    }
  }
}
</style>
