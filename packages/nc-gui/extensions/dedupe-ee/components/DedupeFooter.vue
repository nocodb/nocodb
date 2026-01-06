<script lang="ts" setup>
import { useDedupeOrThrow } from '../lib/useDedupe'

const {
  currentStep,
  resetMergeState,
  nextSet,
  mergeAndDelete,
  currentDuplicateSet,
  currentSetRecords,
  mergeState,
  isMerging,
  duplicateSets,
  hasMoreDuplicateSets,
  currentSetIndex,
  groupSets,
  groupSetsPaginationData,
  currentGroup,
} = useDedupeOrThrow()

const { toggleFullScreen } = useExtensionHelperOrThrow()

const onCancel = () => {
  if (currentStep.value === 'review') {
    currentStep.value = 'config'
  } else {
    toggleFullScreen()
  }
}

// Computed for review step footer
const totalDuplicateRecords = computed(() => {
  if (!currentDuplicateSet.value) return 0
  return currentDuplicateSet.value.recordCount || currentSetRecords.value.length
})

const hasSelectedFieldsToMerge = computed(() => {
  return Object.keys(mergeState.value.selectedFields).length > 0
})

const hasPrimaryRecord = computed(() => {
  return mergeState.value.primaryRecordId !== null
})

const canMerge = computed(() => {
  return hasPrimaryRecord.value && currentSetRecords.value.length > 1 && !isMerging.value
})

const handleReset = () => {
  resetMergeState()
}

const handleSkip = async () => {
  await nextSet()
  if (duplicateSets.value.length === 0 && !hasMoreDuplicateSets.value) {
    currentStep.value = 'config'
  }
}

const handleMerge = async () => {
  const allResolved = await mergeAndDelete()
  if (allResolved) {
    currentStep.value = 'config'
  }
}

watchEffect(() => {
  console.log('group set', groupSets.value)
})
</script>

<template>
  <div class="w-full flex items-center justify-between gap-3 px-4 pt-[11px] pb-3 border-t-1 border-nc-border-gray-medium">
    <!-- Config step footer -->
    <template v-if="currentStep === 'config'">
      <div></div>
      <div class="flex items-center gap-2">
        <NcButton size="small" type="secondary" @click="onCancel">
          {{ $t('general.cancel') }}
        </NcButton>
        <NcButton size="small" :disabled="groupSetsPaginationData.isLoading || !groupSets.length" @click="currentStep = 'review'">
          Review {{ groupSetsPaginationData.totalRows ?? '' }} set{{ groupSetsPaginationData.totalRows !== 1 ? 's' : '' }} of
          duplicates
        </NcButton>
      </div>
    </template>

    <!-- Review step footer -->
    <template v-else>
      <!-- Left side: Review step -->
      <div class="flex items-center gap-3">
        <span class="text-sm text-nc-content-gray-muted">
          {{ currentGroup?.count || 0 }} duplicated record{{ currentGroup?.count !== 1 ? 's' : '' }}
        </span>
        <NcButton size="small" type="secondary" :disabled="!hasSelectedFieldsToMerge" @click="handleReset"> Reset </NcButton>
      </div>

      <!-- Right side: Review step -->
      <div class="flex items-center gap-2">
        <span class="text-sm text-nc-content-gray-muted">
          {{ currentSetIndex + 1 }} of {{ groupSetsPaginationData.totalRows }}
        </span>
        <NcButton size="small" type="secondary" @click="onCancel">
          {{ $t('general.cancel') }}
        </NcButton>
        <NcButton v-if="!canMerge" size="small" @click="handleSkip"> Skip </NcButton>
        <NcButton v-else size="small" type="primary" :loading="isMerging" :disabled="isMerging" @click="handleMerge">
          Merge Records
        </NcButton>
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped></style>
