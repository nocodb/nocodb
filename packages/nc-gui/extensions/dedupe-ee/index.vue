<script setup lang="ts">
import { useProvideDedupe } from './lib/useDedupe'
import ReviewStep from './components/ReviewStep.vue'
import SidebarConfig from './components/SidebarConfig.vue'
import DedupeGroupSets from './components/DedupeGroupSets.vue'
import DedupeFooter from './components/DedupeFooter.vue'

// Provide dedupe instance to child components
const { loadSavedConfig, groupSetsPaginationData, scrollContainer, currentStep } = useProvideDedupe()

const { fullscreen, toggleFullScreen } = useExtensionHelperOrThrow()

// Load saved configuration on mount
onMounted(async () => {
  await loadSavedConfig()
})
</script>

<template>
  <ExtensionsExtensionWrapper>
    <div v-if="!fullscreen" class="h-full flex items-center justify-center">
      <div class="text-center flex flex-col gap-4 items-center">
        <div class="text-caption text-nc-content-gray-muted">Use fullscreen to configure the extension.</div>

        <NcButton size="small" @click="toggleFullScreen"> Use Fullscreen </NcButton>
      </div>
    </div>

    <div v-else class="h-full">
      <div class="h-[calc(100%_-_56px)] w-full flex">
        <template v-if="currentStep === 'config'">
          <div class="h-full min-w-xs border-r border-nc-border-gray-medium nc-scrollbar-thin px-4">
            <SidebarConfig />
          </div>
          <div ref="scrollContainer" class="flex-1 p-6 nc-scrollbar-thin relative">
            <div class="max-w-[768px] mx-auto">
              <DedupeGroupSets />
            </div>

            <general-overlay :model-value="groupSetsPaginationData.isLoading" inline transition class="!bg-opacity-15">
              <div class="flex items-center justify-center h-full w-full !bg-nc-bg-default !bg-opacity-85 z-1000">
                <a-spin size="large" />
              </div>
            </general-overlay>
          </div>
        </template>
        <template v-else>
          <!-- Review step - full width, no sidebar -->
          <div class="flex-1 w-full h-full">
            <ReviewStep />
          </div>
        </template>
      </div>
      <DedupeFooter />
    </div>
  </ExtensionsExtensionWrapper>
</template>

<style lang="scss" scoped>
.nc-dedupe-ee {
  .extension-content {
    &:not(.fullscreen) {
      @apply p-3;
    }
  }
}
</style>
