<script lang="ts" setup>
interface Props {
  isDisabled?: boolean
  activeTab: string
  tabs: {
    title: string
    key: string
  }[]
  aiLoading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isDisabled: false,
  aiLoading: false,
})

const emits = defineEmits(['update:isDisabled', 'update:activeTab'])

const vIsDisabled = useVModel(props, 'isDisabled', emits)

const activeTab = useVModel(props, 'activeTab', emits)

const { tabs, aiLoading } = toRefs(props)

const workspaceStore = useWorkspace()

const { activeWorkspaceId } = storeToRefs(workspaceStore)

const { aiIntegrationAvailable } = useNocoAi()

const handleEnable = () => {
  if (!vIsDisabled.value) return

  vIsDisabled.value = false
}

const handleChangeTab = (tab: string) => {
  if (aiLoading.value) return
  activeTab.value = tab
}
</script>

<template>
  <div
    class="nc-ai-wizard-card rounded-2xl overflow-hidden transition-colors"
    :class="{
      'is-disabled': vIsDisabled,
    }"
    @click="handleEnable"
  >
    <div class="nc-ai-wizard-card-tab-header">
      <div class="flex nc-ai-wizard-card-tab-wrapper">
        <div
          v-for="tab of tabs"
          :key="tab.key"
          class="nc-ai-wizard-card-tab"
          :class="{
            'active-tab': activeTab === tab.key,
            '!cursor-wait': aiLoading,
          }"
          @click="handleChangeTab(tab.key)"
        >
          {{ tab.title }}
        </div>
      </div>
      <div class="nc-ai-wizard-card-tab-extra-right">
        <slot name="tabExtraRight"></slot>
      </div>
    </div>
    <div class="nc-ai-wizard-card-tab-content">
      <slot name="tabContent"> </slot>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-ai-wizard-card {
  @apply border-1 border-purple-200 rounded-lg;

  .nc-ai-wizard-card-tab-header {
    @apply bg-nc-bg-purple-light flex justify-between h-10 -mt-[1px] -ml-[1px] border-b-1 border-purple-200;

    .nc-ai-wizard-card-tab {
      @apply relative px-4 py-2 text-sm cursor-pointer rounded-t-lg border-t-1 border-x-1;

      &.active-tab {
        @apply text-nc-content-purple-dark bg-white border-purple-200 font-semibold;

        &::after {
          @apply absolute content-[''] -bottom-[1px] left-0 right-0 border-b-1 border-white;
        }
      }
      &:not(.active-tab) {
        @apply text-nc-content-purple-light border-transparent font-weight-500;
      }
    }

    .nc-ai-wizard-card-tab-extra-right {
      @apply flex items-center gap-2 pr-2 text-nc-content-purple-dark;
    }
  }

  .nc-ai-wizard-card-tab-content {
    @apply bg-white;
  }
}
</style>
