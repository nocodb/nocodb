<script lang="ts" setup>
import { iconMap } from '~/utils'

const { viewMetaProperties, updateCalendarMeta } = useCalendarViewStoreOrThrow()

const isMondayFirst = computed(() => {
  return viewMetaProperties.value?.monday_first !== false
})

const toggleFirstDayOfWeek = async () => {
  await updateCalendarMeta({
    meta: {
      ...viewMetaProperties.value,
      monday_first: !isMondayFirst.value,
    },
  })
}
</script>

<template>
  <div class="flex items-center">
    <NcTooltip>
      <template #title>{{ isMondayFirst ? 'Week starts on Monday' : 'Week starts on Sunday' }}</template>
      <NcButton
        class="!h-6 !rounded-lg !bg-gray-100 !border-0 !hover:bg-gray-200"
        size="small"
        type="secondary"
        data-testid="nc-calendar-first-day-toggle"
        @click="toggleFirstDayOfWeek"
      >
        <div class="flex items-center gap-1">
          <span class="text-xs font-medium">{{ isMondayFirst ? 'Mon' : 'Sun' }}</span>
          <component :is="iconMap.calendar" class="h-3.5 w-3.5" />
        </div>
      </NcButton>
    </NcTooltip>
  </div>
</template>
