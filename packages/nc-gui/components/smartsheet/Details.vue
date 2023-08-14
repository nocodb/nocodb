<script setup lang="ts">
const { openedViewsTab } = storeToRefs(useViewsStore())
const { onViewsTabChange } = useViewsStore()

const openedSubTab = computed<'webhooks' | 'apis' | 'views'>({
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
    <NcTabs v-model="openedSubTab" centered>
      <a-tab-pane key="webhooks">
        <template #tab>
          <div class="flex flex-row gap-x-1 pr-0.5">
            <GeneralIcon icon="webhook" class="tab-icon" :class="{}" />
            <div class="tab-title nc-tab">Webhooks</div>
          </div>
        </template>
        <SmartsheetDetailsWebhooks />
      </a-tab-pane>
      <a-tab-pane key="apis">
        <template #tab>
          <div class="flex flex-row gap-x-1 items-center pr-0.5">
            <GeneralIcon icon="code" class="tab-icon" :class="{}" />
            <div class="tab-title nc-tab">APIs</div>
          </div>
        </template>
        <SmartsheetDetailsApi
      /></a-tab-pane>
    </NcTabs>
  </div>
</template>
