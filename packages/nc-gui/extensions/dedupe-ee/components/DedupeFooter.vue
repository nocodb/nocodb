<script lang="ts" setup>
import { useDedupeOrThrow } from '../lib/useDedupe'

const {
  currentStep,
  resetMergeState,
  nextSet,
  mergeAndDelete,
  mergeState,
  isMerging,
  groupSets,
  groupSetsPaginationData,
  currentGroup,
  currentGroupIndex,
  totalRows,
} = useDedupeOrThrow()

const { toggleFullScreen } = useExtensionHelperOrThrow()

const { showInfoModal } = useNcConfirmModal()

const confirmingMerge = ref(false)

const onCancel = () => {
  if (currentStep.value === 'review') {
    currentStep.value = 'config'
  } else {
    toggleFullScreen()
  }
}

const hasPrimaryRecord = computed(() => {
  return ncIsNumber(mergeState.value.primaryRecordIndex)
})

const canMerge = computed(() => {
  return hasPrimaryRecord.value
})

const handleReset = async () => {
  showInfoModal({
    title: 'Are you sure you want to reset your changes for this set set of duplicates?',
    content: 'Any records excluded from the set will be restored and all field selections will be reverted.',
    showCancelBtn: true,
    showIcon: false,
    okProps: {
      type: 'danger',
    },
    okText: 'Reset',
    okCallback: async () => {
      resetMergeState()
    },
  })
}

const handleSkip = async () => {
  await nextSet()
}

const duplicateRecordCount = computed(() => {
  return Math.max((currentGroup.value?.count ?? totalRows.value ?? 0) - mergeState.value.excludedRecordIndexes.size, 0)
})

const deleteRecordCount = computed(() => {
  return Math.max(duplicateRecordCount.value - 1, 0)
})

const handleMergeConfirm = async () => {
  confirmingMerge.value = false
  const allResolved = await mergeAndDelete()
  if (allResolved) {
    currentStep.value = 'config'
  }
}

// Reset confirm state when switching groups
watch(currentGroupIndex, () => {
  confirmingMerge.value = false
})

const handleReview = async () => {
  currentGroupIndex.value = 0
  currentStep.value = 'review'
}
</script>

<template>
  <div
    class="w-full sticky bottom-0 bg-nc-bg-default flex items-center justify-between gap-3 px-4 pt-[11px] pb-3 border-t-1 border-nc-border-gray-medium"
  >
    <!-- Config step footer -->
    <template v-if="currentStep === 'config'">
      <div></div>
      <div class="flex items-center gap-2">
        <NcButton size="small" type="secondary" @click="onCancel">
          {{ $t('general.cancel') }}
        </NcButton>
        <NcButton size="small" :disabled="groupSetsPaginationData.isLoading || !groupSets.length" @click="handleReview">
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
          {{ duplicateRecordCount }} duplicated record{{ duplicateRecordCount !== 1 ? 's' : '' }}
        </span>
        <NcButton
          size="small"
          type="secondary"
          :disabled="!hasPrimaryRecord && !mergeState.excludedRecordIndexes.size"
          @click="handleReset"
        >
          Reset
        </NcButton>
      </div>

      <!-- Right side: Review step -->
      <div class="flex items-center gap-2">
        <span class="text-sm text-nc-content-gray-muted">
          {{ currentGroupIndex + 1 }} of {{ groupSetsPaginationData.totalRows }}
        </span>
        <NcButton size="small" type="secondary" @click="onCancel">
          {{ $t('general.cancel') }}
        </NcButton>
        <NcButton v-if="!canMerge" size="small" @click="handleSkip"> Skip record </NcButton>
        <NcDropdown v-else v-model:visible="confirmingMerge" placement="topRight">
          <NcButton size="small" type="danger" :loading="isMerging">
            {{
              ncIsNumber(mergeState.primaryRecordIndex)
                ? `Merge and delete ${deleteRecordCount} record${deleteRecordCount !== 1 ? 's' : ''}`
                : 'Merge records'
            }}
          </NcButton>
          <template #overlay>
            <div class="p-3 flex flex-col gap-2 w-full max-w-md">
              <p class="text-bodyBold m-0">Are you sure?</p>
              <p class="text-bodyDefaultSm text-nc-content-gray-muted m-0">
                {{ deleteRecordCount }} record{{ deleteRecordCount !== 1 ? 's' : '' }} will be permanently deleted.
              </p>
              <div class="flex items-center justify-end gap-2 mt-1">
                <NcButton size="xs" type="secondary" @click="confirmingMerge = false"> Cancel </NcButton>
                <NcButton size="xs" type="danger" :loading="isMerging" @click="handleMergeConfirm"> Confirm </NcButton>
              </div>
            </div>
          </template>
        </NcDropdown>
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped></style>
