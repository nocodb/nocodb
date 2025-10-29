<script lang="ts" setup>
const {
  formState,
  syncConfigEditForm,
  integrationConfigs,
  selectedIntegrationIndex,
  addIntegrationConfig,
  removeIntegrationConfig,
  switchToIntegrationConfig,
  editModeModified,
  editMode,
} = useSyncStoreOrThrow()

const configs = computed(() => {
  return integrationConfigs.value.map((config, i) => {
    if (i === selectedIntegrationIndex.value) {
      return formState.value
    }

    return config
  })
})
</script>

<template>
  <div class="nc-integration-tabs">
    <div class="nc-tabs-container">
      <div
        v-for="(config, index) in configs"
        :key="index"
        class="nc-tab"
        :class="{
          'nc-tab-active': selectedIntegrationIndex === index,
        }"
        @click="switchToIntegrationConfig(index)"
      >
        <div class="nc-tab-content">
          <GeneralIntegrationIcon v-if="config.sub_type" :type="config.sub_type" class="h-5 w-5" />
          <span class="nc-tab-label capitalize">
            {{ config?.title || config?.sub_type || 'New Source' }}
          </span>
          <NcButton
            v-if="integrationConfigs.length > 1 && !editMode"
            type="text"
            size="xxsmall"
            class="nc-tab-close"
            @click.stop="removeIntegrationConfig(index)"
          >
            <GeneralIcon icon="close" class="h-3 w-3" />
          </NcButton>
        </div>
      </div>
      <NcButton
        v-if="(!editMode || !editModeModified) && syncConfigEditForm?.sync_category !== 'custom'"
        type="text"
        size="small"
        class="nc-add-source-btn"
        @click="addIntegrationConfig"
      >
        <GeneralIcon icon="plus" class="h-4 w-4" />
        <span>Add Source</span>
      </NcButton>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-integration-tabs {
  @apply mb-4;
}

.nc-tabs-container {
  @apply flex items-center gap-1 border-b border-gray-200 flex-wrap;
}

.nc-tab {
  @apply px-4 py-2.5 cursor-pointer transition-all duration-200 relative;
  @apply border-b-2 border-transparent;
  @apply hover:bg-gray-50;

  &.nc-tab-active {
    @apply border-brand-500;

    .nc-tab-content {
      @apply text-brand-600;
    }
  }
}

.nc-tab-content {
  @apply flex items-center gap-2 text-gray-600;
}

.nc-tab-number {
  @apply h-5 w-5 flex items-center justify-center bg-gray-100 rounded-full text-xs font-medium;
}

.nc-tab-label {
  @apply text-sm font-medium;
}

.nc-tab-close {
  @apply !p-0 !min-w-0 !h-auto text-gray-400;
  @apply hover:!text-red-500 transition-colors;
}

.nc-add-source-btn {
  @apply ml-2 !px-3 !py-1.5 flex items-center gap-1.5;
}
</style>
