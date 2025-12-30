<script setup lang="ts">
import { useDedupeOrThrow } from '../lib/useDedupe'
import DuplicateRecordCard from './DuplicateRecordCard.vue'
import MergePreview from './MergePreview.vue'

const {
  currentStep,
  currentDuplicateSet,
  currentSetRecords,
  isLoadingCurrentSetRecords,
  availableFields,
  mergeState,
  duplicateSets,
  hasMoreDuplicateSets,
  isLoadingMoreSets,
  nextSet,
  previousSet,
  mergeAndDelete,
  loadMoreDuplicateSets,
  getFieldValue,
  getSelectedFieldValue,
  setPrimaryRecord,
  excludeRecord,
  includeRecord,
  selectFieldValue,
  hasMoreSets,
  hasPreviousSets,
} = useDedupeOrThrow()

const skipSet = async () => {
  await nextSet()
  if (duplicateSets.value.length === 0 && !hasMoreDuplicateSets.value) {
    currentStep.value = 'config'
  }
}

const handleBackToConfig = () => {
  currentStep.value = 'config'
}

const scrollContainer = ref<HTMLElement>()

// Infinite scroll for loading more duplicate sets
useInfiniteScroll(
  scrollContainer,
  async () => {
    if (hasMoreDuplicateSets.value && !isLoadingMoreSets.value) {
      await loadMoreDuplicateSets()
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
        <div class="flex gap-2">
          <NcButton size="small" :disabled="!hasPreviousSets" @click="previousSet">
            Previous
          </NcButton>
          <NcButton size="small" :disabled="!hasMoreSets" @click="nextSet"> Next </NcButton>
        </div>
      </div>
    </div>

    <div v-if="!currentDuplicateSet" class="flex-1 flex items-center justify-center">
      <a-empty description="No duplicate set selected" :image="Empty.PRESENTED_IMAGE_SIMPLE">
        <template #description>
          <span class="text-nc-content-gray-muted">Select a duplicate group to review</span>
        </template>
      </a-empty>
    </div>

    <div v-else ref="scrollContainer" class="flex-1 overflow-y-auto p-4 nc-scrollbar-thin">
      <div v-if="isLoadingCurrentSetRecords" class="text-center py-8">
        <a-spin />
        <p class="text-gray-500 mt-2">Loading records for this duplicate set...</p>
      </div>

      <div v-else-if="currentSetRecords.length === 0" class="text-center py-8 text-gray-500">
        All records in this set have been excluded.
      </div>

      <div v-else class="space-y-4">
        <!-- Record Cards -->
        <DuplicateRecordCard
          v-for="record of currentSetRecords"
          :key="record.Id"
          :record="record"
          :record-id="record.Id"
          :fields="availableFields"
          :is-primary="mergeState.primaryRecordId === record.Id"
          :is-excluded="mergeState.excludedRecordIds.has(record.Id)"
          :selected-fields="mergeState.selectedFields"
          :get-field-value="getFieldValue"
          @set-primary="setPrimaryRecord"
          @exclude="excludeRecord"
          @include="includeRecord"
          @select-field="selectFieldValue"
        />

        <!-- Merge Preview -->
        <MergePreview
          v-if="mergeState.primaryRecordId"
          :fields="availableFields"
          :primary-record-id="mergeState.primaryRecordId"
          :selected-fields="mergeState.selectedFields"
          :get-selected-field-value="getSelectedFieldValue"
          :get-field-value="getFieldValue"
        />
      </div>
    </div>
  </div>
</template>
