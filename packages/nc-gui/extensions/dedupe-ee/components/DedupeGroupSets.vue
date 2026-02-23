<script lang="ts" setup>
import { type TableType } from 'nocodb-sdk'
import { useDedupeOrThrow } from '../lib/useDedupe'

const { selectedFields, groupSets, meta, loadMoreGroupSets, groupSetsPaginationData, scrollContainer } = useDedupeOrThrow()

provide(MetaInj, ref(meta.value as TableType))

const getFieldValue = (group: Record<string, any>, fieldTitle: string) => {
  return group[fieldTitle]
}

// Infinite scroll for loading more group sets
useInfiniteScroll(
  scrollContainer,
  async () => {
    if (groupSets.value.length <= 0) return

    if (!groupSetsPaginationData.value.isLastPage && !groupSetsPaginationData.value.isLoading) {
      await loadMoreGroupSets()
    }
  },
  { distance: 200, interval: 1000 },
)
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-lg font-semibold">Duplicate Groups</h2>
        <p class="text-sm text-nc-content-gray-muted mt-2">
          Found {{ groupSetsPaginationData.totalRows || groupSets.length }} group(s) with duplicates
        </p>
      </div>
    </div>

    <div v-if="groupSets.length === 0 && !groupSetsPaginationData.isLoading" class="text-center py-12">
      <a-empty description="No duplicate groups found" :image="Empty.PRESENTED_IMAGE_SIMPLE">
        <template #description>
          <span class="text-nc-content-gray-muted">Select a table, view, and field(s) to find duplicates</span>
        </template>
      </a-empty>
    </div>

    <div v-else-if="groupSets.length > 0" class="space-y-2">
      <div
        v-for="(group, index) in groupSets"
        :key="index"
        class="flex items-center justify-between px-3 py-2 border-1 border-nc-border-gray-medium rounded-lg hover:(border-nc-border-gray-dark shadow-hover) dark:hover:shadow-nc-bg-gray-light transition-all"
      >
        <div class="flex items-center gap-3 flex-1 justify-between min-w-0">
          <div class="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
            <template v-for="(field, fieldIndex) in selectedFields" :key="field.id">
              <span v-if="fieldIndex > 0" class="text-nc-content-gray-muted flex-none">&middot;</span>
              <NcTooltip class="truncate leading-[20px]" show-on-truncate-only>
                <template #title>
                  <SmartsheetPlainCell
                    :model-value="getFieldValue(group, field.title!)"
                    :column="field"
                    class="font-semibold leading-[20px]"
                  />
                </template>

                <SmartsheetPlainCell
                  :model-value="getFieldValue(group, field.title!)"
                  :column="field"
                  class="font-semibold text-nc-content-brand leading-[20px]"
                />
              </NcTooltip>
            </template>
          </div>

          <div class="text-bodyDefaultSm text-nc-content-gray-muted whitespace-nowrap">Count: {{ group.count }}</div>
        </div>
      </div>

      <!-- Loading indicator for infinite scroll -->
      <div v-if="groupSetsPaginationData.isLoading && groupSets.length > 0" class="flex justify-center py-4">
        <a-spin size="small" />
      </div>
    </div>
  </div>
</template>
