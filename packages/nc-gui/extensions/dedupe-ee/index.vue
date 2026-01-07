<script setup lang="ts">
import { useProvideDedupe } from './lib/useDedupe'
import ReviewStep from './components/ReviewStep.vue'
import SidebarConfig from './components/SidebarConfig.vue'
import DedupeGroupSets from './components/DedupeGroupSets.vue'
import DedupeFooter from './components/DedupeFooter.vue'
import MergePreview from './components/MergePreview.vue'

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

const topSectionRef = ref<HTMLElement>()

const { height } = useElementSize(topSectionRef)

// Load saved configuration on mount
onMounted(async () => {
  await loadSavedConfig()
})

watch(currentStep, () => {
  if (currentStep.value === 'review') {
    findDuplicates()
  }
})

watchEffect(() => {
  console.log('height', height.value)
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

    <div v-else class="h-full relative">
      <div v-if="currentStep === 'review'" ref="topSectionRef" class="border-b">
        <div class="flex items-center justify-between p-4">
          <div>
            <h2 class="text-lg font-semibold">Resolve duplicate records</h2>

            <NcTooltip
              show-on-truncate-only
              :line-clamp="2"
              class="text-bodyDefaultSm text-nc-content-gray-muted line-clamp-2 max-w-[80%]"
            >
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
        :style="{
          height: currentStep === 'review' ? `calc(100% - ${height ? 56 + height + 2 : 164}px)` : 'calc(100% - 56px)',
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
          <ReviewStep />

          <MergePreview />
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
