<script setup lang="ts">
import { useDedupeOrThrow } from '../lib/useDedupe'
import DuplicateRecordCard from './DuplicateRecordCard.vue'
import MergePreview from './MergePreview.vue'

const dedupe = useDedupeOrThrow()

const emit = defineEmits<{
  backToConfig: []
  allDuplicatesResolved: []
}>()

const skipSet = async () => {
  await dedupe.nextSet()
  if (dedupe.duplicateSets.value.length === 0 && !dedupe.hasMoreDuplicateSets.value) {
    emit('allDuplicatesResolved')
  }
}

const handleMergeAndDelete = async () => {
  const allResolved = await dedupe.mergeAndDelete()
  if (allResolved) {
    emit('allDuplicatesResolved')
  }
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
          <h2 class="text-lg font-semibold">Review Duplicates</h2>
          <p class="text-sm text-gray-600">
            Set {{ dedupe.currentSetIndex.value + 1 }} of
            {{ dedupe.totalDuplicateSets.value || dedupe.duplicateSets.value.length }}
            {{ dedupe.hasMoreDuplicateSets.value ? '+' : '' }}
          </p>
        </div>
        <div class="flex gap-2">
          <NcButton size="small" :disabled="!dedupe.hasPreviousSets.value" @click="() => dedupe.previousSet()">
            Previous
          </NcButton>
          <NcButton size="small" :disabled="!dedupe.hasMoreSets.value" @click="() => dedupe.nextSet()"> Next </NcButton>
          <NcButton size="small" @click="skipSet"> Skip </NcButton>
          <NcButton size="small" @click="emit('backToConfig')"> Back to Config </NcButton>
        </div>
      </div>
    </div>

    <div v-if="dedupe.currentDuplicateSet.value" class="flex-1 overflow-y-auto p-4">
      <div class="mb-4 flex items-center justify-between">
        <NcButton size="small" @click="dedupe.resetMergeState"> Reset </NcButton>
        <div v-if="dedupe.isLoadingCurrentSetRecords.value" class="text-sm text-gray-500">
          Loading records...
        </div>
      </div>

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

        <!-- Actions -->
        <div class="flex gap-2 pt-4">
          <NcButton
            type="primary"
            :disabled="!dedupe.mergeState.value.primaryRecordId || dedupe.currentSetRecords.value.length <= 1 || dedupe.isMerging.value"
            :loading="dedupe.isMerging.value"
            @click="handleMergeAndDelete"
          >
            Merge and Delete {{ dedupe.currentSetRecords.value.length - 1 }} Record(s)
          </NcButton>
        </div>
      </div>
    </div>
  </div>
</template>
