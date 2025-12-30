<script setup lang="ts">
import { useDedupeOrThrow } from '../lib/useDedupe'
import DuplicateRecordCard from './DuplicateRecordCard.vue'
import MergePreview from './MergePreview.vue'

const dedupe = useDedupeOrThrow()

const skipSet = async () => {
  await dedupe.nextSet()
  if (dedupe.duplicateSets.value.length === 0 && !dedupe.hasMoreDuplicateSets.value) {
    dedupe.currentStep.value = 'config'
  }
}

const handleMergeAndDelete = async () => {
  const allResolved = await dedupe.mergeAndDelete()
  if (allResolved) {
    dedupe.currentStep.value = 'config'
  }
}

const handleBackToConfig = () => {
  dedupe.currentStep.value = 'config'
}

const scrollContainer = ref<HTMLElement>()

// Infinite scroll for loading more duplicate sets
useInfiniteScroll(
  scrollContainer,
  async () => {
    if (dedupe.hasMoreDuplicateSets.value && !dedupe.isLoadingMoreSets.value) {
      await dedupe.loadMoreDuplicateSets()
    }
  },
  { distance: 200 },
)
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="p-4 border-b">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-semibold">Resolve duplicate records</h2>
          <p class="text-bodyDefaultSm text-nc-content-gray-muted">
            For each set of duplicates, pick a primary record. All other records in the set will be deleted when you merge. Click
            a field to merge it into the primary record. If a record isn't a duplicate, exclude it from the set and it won't be
            deleted.
          </p>
        </div>
      </div>
    </div>

    <div v-if="!dedupe.currentDuplicateSet.value" class="flex-1 flex items-center justify-center">
      <a-empty description="No duplicate set selected" :image="Empty.PRESENTED_IMAGE_SIMPLE">
        <template #description>
          <span class="text-nc-content-gray-muted">Select a duplicate group to review</span>
        </template>
      </a-empty>
    </div>

    <div v-else ref="scrollContainer" class="flex-1 overflow-y-auto p-4 nc-scrollbar-thin">
      <div v-if="dedupe.isLoadingCurrentSetRecords.value" class="text-center py-8">
        <a-spin />
        <p class="text-gray-500 mt-2">Loading records for this duplicate set...</p>
      </div>

      <div v-else-if="dedupe.currentSetRecords.value.length === 0" class="text-center py-8 text-gray-500">
        All records in this set have been excluded.
      </div>

      <div v-else class="space-y-4">
        <!-- Record Cards -->
        <DuplicateRecordCard
          v-for="record of dedupe.currentSetRecords.value"
          :key="record.Id"
          :record="record"
          :record-id="record.Id"
          :fields="dedupe.availableFields.value"
          :is-primary="dedupe.mergeState.value.primaryRecordId === record.Id"
          :is-excluded="dedupe.mergeState.value.excludedRecordIds.has(record.Id)"
          :selected-fields="dedupe.mergeState.value.selectedFields"
          :get-field-value="dedupe.getFieldValue"
          @set-primary="dedupe.setPrimaryRecord"
          @exclude="dedupe.excludeRecord"
          @include="dedupe.includeRecord"
          @select-field="dedupe.selectFieldValue"
        />

        <!-- Merge Preview -->
        <MergePreview
          v-if="dedupe.mergeState.value.primaryRecordId"
          :fields="dedupe.availableFields.value"
          :primary-record-id="dedupe.mergeState.value.primaryRecordId"
          :selected-fields="dedupe.mergeState.value.selectedFields"
          :get-selected-field-value="dedupe.getSelectedFieldValue"
          :get-field-value="dedupe.getFieldValue"
        />
      </div>
    </div>
  </div>
</template>
