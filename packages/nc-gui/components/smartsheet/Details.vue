<script setup lang="ts">
const { openedViewsTab } = storeToRefs(useViewsStore())
const { onViewsTabChange } = useViewsStore()

const openedSubTab = computed({
  get() {
    return openedViewsTab.value
  },
  set(val) {
    onViewsTabChange(val)
  },
})
</script>

<template>
  <div class="flex flex-col h-full w-full">
    <NcTabs v-model="openedSubTab">
      <a-tab-pane key="fields">
        <template #tab>
          <div class="tab">
            <GeneralIcon icon="list" class="tab-icon" :class="{}" />
            <div>Fields</div>
          </div>
        </template>
      </a-tab-pane>
      <a-tab-pane key="relations">
        <template #tab>
          <div class="tab">
            <GeneralIcon icon="erd" class="tab-icon" :class="{}" />
            <div>Relations</div>
          </div>
        </template>
        <SmartsheetDetailsErd />
      </a-tab-pane>

      <a-tab-pane key="apis">
        <template #tab>
          <div class="tab">
            <GeneralIcon icon="code" class="tab-icon" :class="{}" />
            <div>APIs</div>
          </div>
        </template>
        <SmartsheetDetailsApi />
      </a-tab-pane>

      <a-tab-pane key="webhooks">
        <template #tab>
          <div class="tab">
            <GeneralIcon icon="webhook" class="tab-icon" :class="{}" />
            <div>Webhooks</div>
          </div>
        </template>
        <SmartsheetDetailsWebhooks />
      </a-tab-pane>
    </NcTabs>
  </div>
</template>

<style lang="scss" scoped>
.tab {
  @apply flex flex-row items-center gap-x-1.5 pr-0.5;
}
</style>
