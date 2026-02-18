<script lang="ts" setup>
import { UITypes, ViewTypes } from 'nocodb-sdk'
import type { ColumnType } from 'nocodb-sdk'

const meta = inject(MetaInj, ref())
const activeView = inject(ActiveViewInj, ref())

const { timelineRange, loadTimelineData, timelineMetaData } = useTimelineViewStoreOrThrow()

const { $api } = useNuxtApp()

const isOpen = ref(false)

// Get available date columns
const dateColumns = computed<ColumnType[]>(() => {
  return (meta.value?.columns ?? [])
    .filter((col) => {
      return [UITypes.Date, UITypes.DateTime, UITypes.CreatedTime, UITypes.LastModifiedTime].includes(col.uidt as UITypes)
    })
    .sort((a, b) => {
      // Priority: DateTime > Date > CreatedTime > LastModifiedTime
      const priority: Record<string, number> = {
        [UITypes.DateTime]: 0,
        [UITypes.Date]: 1,
        [UITypes.CreatedTime]: 2,
        [UITypes.LastModifiedTime]: 3,
      }
      return (priority[a.uidt!] ?? 99) - (priority[b.uidt!] ?? 99)
    })
})

const selectedFromCol = ref<string | undefined>(timelineRange.value?.[0]?.fk_from_col?.id)
const selectedToCol = ref<string | undefined>(timelineRange.value?.[0]?.fk_to_col?.id)

watch(
  () => timelineRange.value,
  (val) => {
    if (val?.length) {
      selectedFromCol.value = val[0]?.fk_from_col?.id
      selectedToCol.value = val[0]?.fk_to_col?.id
    }
  },
  { immediate: true },
)

const saveRange = async () => {
  if (!selectedFromCol.value || !activeView.value?.id) return

  try {
    const range = [
      {
        fk_from_column_id: selectedFromCol.value,
        fk_to_column_id: selectedToCol.value || null,
      },
    ]

    await $api.dbView.update(activeView.value.id, {
      timeline_range: range,
    } as any)

    await loadTimelineData()
    isOpen.value = false
  } catch (e) {
    console.error('Error saving timeline range:', e)
  }
}
</script>

<template>
  <div class="relative">
    <button
      class="px-2 py-1 text-xs rounded border border-gray-300 hover:bg-gray-100 flex items-center gap-1"
      @click="isOpen = !isOpen"
    >
      <span class="i-mdi-calendar-range text-sm" />
      Date Range
    </button>

    <!-- Dropdown -->
    <div
      v-if="isOpen"
      class="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-50 min-w-[280px]"
    >
      <div class="text-xs font-semibold text-gray-500 uppercase mb-2">Date Range Configuration</div>

      <!-- From column -->
      <div class="mb-3">
        <label class="text-xs text-gray-500 mb-1 block">Start Date</label>
        <select
          v-model="selectedFromCol"
          class="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:border-blue-500 focus:outline-none"
        >
          <option value="">Select column...</option>
          <option v-for="col in dateColumns" :key="col.id" :value="col.id">
            {{ col.title }}
          </option>
        </select>
      </div>

      <!-- To column -->
      <div class="mb-3">
        <label class="text-xs text-gray-500 mb-1 block">End Date</label>
        <select
          v-model="selectedToCol"
          class="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:border-blue-500 focus:outline-none"
        >
          <option value="">Same as start date</option>
          <option v-for="col in dateColumns" :key="col.id" :value="col.id">
            {{ col.title }}
          </option>
        </select>
      </div>

      <div class="flex justify-end gap-2">
        <button class="px-3 py-1 text-xs rounded border border-gray-300 hover:bg-gray-100" @click="isOpen = false">
          Cancel
        </button>
        <button
          class="px-3 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          :disabled="!selectedFromCol"
          @click="saveRange"
        >
          Save
        </button>
      </div>
    </div>
  </div>
</template>
