<script lang="ts" setup>
interface Props {
  activeTab: string
  tabs: {
    title: string
    key: string
  }[]
  aiLoading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  aiLoading: false,
})

const emits = defineEmits(['update:activeTab', 'navigateToIntegrations'])

const activeTab = useVModel(props, 'activeTab', emits)

const { tabs } = toRefs(props)

const { aiIntegrationAvailable, aiLoading } = useNocoAi()

const handleChangeTab = (tab: string) => {
  if (aiLoading.value) return
  activeTab.value = tab
}
</script>

<template>
  <div class="nc-ai-wizard-card rounded-2xl overflow-hidden transition-colors">
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
      <div v-if="!aiIntegrationAvailable" class="py-2.5 pl-3 pr-2 flex items-center gap-3">
        <GeneralIcon icon="alertTriangleSolid" class="!text-nc-content-orange-medium w-4 h-4" />
        <div class="text-sm text-nc-content-gray-subtle flex-1">No AI Integrations available.</div>

        <NcButton size="small" type="text" class="!text-nc-content-brand" @click.stop="emits('navigateToIntegrations')">
          Create AI integration
        </NcButton>
      </div>
      <slot v-else name="tabContent"> </slot>
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
