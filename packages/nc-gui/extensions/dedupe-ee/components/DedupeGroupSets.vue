<script lang="ts" setup>
import { useDedupeOrThrow } from '../lib/useDedupe'

const { selectedField, isLoadingGroupSets, groupSets } = useDedupeOrThrow()

const getFieldValue = (group: Record<string, any>) => {
  // The field title (e.g., "fNumber") is used as the key in the group object
  const fieldTitle = selectedField?.value?.title
  if (!fieldTitle) return null
  return group[fieldTitle]
}

const getFieldTitle = () => {
  return selectedField?.value?.title || 'Field'
}

const formatValue = (value: any) => {
  if (value == null || value === '') {
    return '(blank)'
  }

  // Handle dates
  if (value instanceof Date) {
    return value.toLocaleString()
  }

  // Handle numbers
  if (typeof value === 'number') {
    return value.toLocaleString()
  }

  // Handle strings
  return String(value)
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-lg font-semibold">Duplicate Groups</h2>
        <p class="text-sm text-nc-content-gray-muted mt-2">Found {{ groupSets.length }} group(s) with duplicates</p>
      </div>
    </div>

    <div v-if="groupSets.length === 0 && !isLoadingGroupSets" class="text-center py-12">
      <a-empty description="No duplicate groups found" :image="Empty.PRESENTED_IMAGE_SIMPLE">
        <template #description>
          <span class="text-nc-content-gray-muted">Select a table, view, and field to find duplicates</span>
        </template>
      </a-empty>
    </div>

    <div v-else-if="groupSets.length > 0" class="space-y-2">
      <div
        v-for="(group, index) in groupSets"
        :key="index"
        class="flex items-center justify-between p-4 border border-nc-border-gray-medium rounded-lg hover:border-nc-border-gray-medium hover:shadow-sm transition-all cursor-pointer"
      >
        <div class="flex items-center gap-3 flex-1">
          <div class="flex-shrink-0">
            <div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <span class="text-blue-600 font-semibold">{{ group.count }}</span>
            </div>
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium text-nc-content-gray-extreme">
              <span>{{ getFieldTitle() }}:</span>
              <span class="text-nc-content-gray-subtle font-normal ml-1">
                {{ formatValue(getFieldValue(group)) }}
              </span>
            </div>
            <div class="text-xs text-nc-content-gray-muted mt-1">
              {{ group.count }} duplicate record{{ group.count > 1 ? 's' : '' }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
