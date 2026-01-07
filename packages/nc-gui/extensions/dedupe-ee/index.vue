<script setup lang="ts">
import { useProvideDedupe } from './lib/useDedupe'
import ReviewStep from './components/ReviewStep.vue'
import SidebarConfig from './components/SidebarConfig.vue'
import DedupeGroupSets from './components/DedupeGroupSets.vue'
import DedupeFooter from './components/DedupeFooter.vue'
import RecordCard from './components/RecordCard.vue'

// Provide dedupe instance to child components
const {
  loadSavedConfig,
  groupSetsPaginationData,
  scrollContainer,
  currentStep,
  currentGroup,
  currentGroupRecordsPaginationData,
  mergeState,
  findDuplicates,
  primaryRecordRowInfo,
} = useProvideDedupe()

const { fullscreen, toggleFullScreen } = useExtensionHelperOrThrow()

// Load saved configuration on mount
onMounted(async () => {
  await loadSavedConfig()
})

watch(currentStep, () => {
  if (currentStep.value === 'review') {
    findDuplicates()
  }
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
      <div v-if="currentStep === 'review'" class="p-4 border-b">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-semibold">Resolve duplicate records</h2>

            <NcTooltip show-on-truncate-only :line-clamp="2" class="text-bodyDefaultSm text-nc-content-gray-muted line-clamp-2">
              <template #title>
                For each set of duplicates, pick a primary record. All other records in the set will be deleted when you merge.
                Click a field to merge it into the primary record. If a record isn't a duplicate, exclude it from the set and it
                won't be deleted.
              </template>

              For each set of duplicates, pick a primary record. All other records in the set will be deleted when you merge.
              Click a field to merge it into the primary record. If a record isn't a duplicate, exclude it from the set and it
              won't be deleted.
            </NcTooltip>
          </div>
        </div>
      </div>

      <div
        class="w-full flex"
        :class="{
          'h-[calc(100%_-_164px)]': currentStep === 'review',
          'h-[calc(100%_-_56px)]': currentStep !== 'review',
        }"
      >
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

          <div class="flex-1 relative nc-scrollbar-thin h-full bg-nc-bg-gray-extralight">
            <div v-if="!currentGroup" class="flex-1 flex items-center justify-center">
              <a-empty description="No duplicate set selected" :image="Empty.PRESENTED_IMAGE_SIMPLE">
                <template #description>
                  <span class="text-nc-content-gray-muted">Select a duplicate group to review</span>
                </template>
              </a-empty>
            </div>

            <div v-else-if="currentGroupRecordsPaginationData.isLoading" class="text-center py-8 px-4"></div>

            <div
              v-else-if="currentGroup.count && mergeState.excludedRecordIds.size === currentGroup.count"
              class="text-center py-8 px-4 text-nc-content-gray-muted"
            >
              All records in this set have been excluded.
            </div>

            <ReviewStep v-else />

            <general-overlay :model-value="currentGroupRecordsPaginationData.isLoading" inline transition class="!bg-opacity-15">
              <div class="flex flex-col items-center justify-center h-full w-full !bg-nc-bg-default !bg-opacity-85 z-1000">
                <a-spin size="large" />
                <p class="text-nc-content-gray-muted mt-2">Loading records for this duplicate set...</p>
              </div>
            </general-overlay>
          </div>
          <div
            v-if="ncIsNumber(mergeState.primaryRecordIndex) && primaryRecordRowInfo"
            class="h-full min-w-xs border-l border-nc-border-gray-medium nc-scrollbar-thin bg-nc-bg-gray-extralight"
          >
            <div class="flex gap-4 children:flex-none p-4 nc-scollbar-thin relative">
              <RecordCard :record="primaryRecordRowInfo" is-merge-record />
            </div>
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
