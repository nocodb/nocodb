<script lang="ts" setup>
const { pageMode, IntegrationsPageMode, activeIntegration, activeIntegrationItem, categories, activeCategory } =
  useIntegrationStore()
</script>

<template>
  <div class="flex flex-col nc-workspace-settings-integrations-new">
    <div class="flex flex-col">
      <div class="flex items-center p-6">
        <div class="cursor-pointer text-primary mr-4" @click="pageMode = IntegrationsPageMode.LIST">
          <GeneralIcon icon="arrowLeft" />
          Back
        </div>
        <WorkspaceIntegrationsIcon :integration-item="activeIntegrationItem" size="sm" />
        <div class="text-md font-bold">New {{ activeIntegration.title }}</div>
      </div>
      <div class="border-b-1 border-gray-200 mx-4"></div>
    </div>
    <div class="panel-view">
      <div class="panel-indices">
        <div v-for="ct of categories" :key="ct.label" class="panel-index">
          <div class="flex items-center gap-2" :class="{ 'text-primary': activeCategory?.label === ct.label }">
            <div class="logo-wrapper">
              <GeneralIcon :icon="ct.icon" />
            </div>
            <div class="text-sm">{{ ct.label }}</div>
          </div>
        </div>
      </div>
      <div v-if="activeIntegration" class="panel">
        <WorkspaceIntegrationsFormsEditDatabase />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.logo-wrapper {
  @apply bg-gray-200 p-2 mr-2 rounded-lg flex items-center justify-center;
  width: 32px;
  height: 32px;
  font-size: 2rem;
}

.panel-view {
  @apply flex gap-2 mx-4 mt-6;
  max-width: 1024px;

  .panel {
    @apply w-3/4;
  }

  .panel-indices {
    @apply mr-4 flex flex-col cursor-default;

    .panel-index {
      @apply p-2 rounded-lg;
    }
  }
}
</style>
