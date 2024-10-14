<script lang="ts" setup>
import { AiWizardTabsType } from '#imports'

interface Props {
  activeTab: AiWizardTabsType
}

const props = withDefaults(defineProps<Props>(), {
  activeTab: AiWizardTabsType.AUTO_SUGGESTIONS,
})

const emits = defineEmits(['update:activeTab'])

const activeTab = useModel(props, 'activeTab', emits)

const {} = toRefs(props)
</script>

<template>
  <NcTabs v-model:activeKey="activeTab" theme="ai" class="nc-ai-wizard-tabs">
    <template #leftExtra>
      <div class="w-0"></div>
    </template>
    <a-tab-pane :key="AiWizardTabsType.AUTO_SUGGESTIONS" class="w-full">
      <template #tab>
        <div class="tab-title">Auto Suggested</div>
      </template>
      <div>
        <slot name="AutoSuggestedContent"></slot>
      </div>
    </a-tab-pane>

    <a-tab-pane :key="AiWizardTabsType.PROMPT" class="w-full">
      <template #tab>
        <div class="tab-title">Prompt AI</div>
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

  :deep(.ant-tabs-tab + .ant-tabs-tab) {
    @apply ml-4;
  }

  .tab-title {
    @apply text-xs leading-[24px] px-2 rounded hover:bg-gray-100 transition-colors;
  }
}
</style>
