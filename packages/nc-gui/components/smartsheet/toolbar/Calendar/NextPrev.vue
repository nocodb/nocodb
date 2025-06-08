<script setup lang="ts">
const { activeCalendarView, paginateCalendarView } = useCalendarViewStoreOrThrow()
</script>

<template>
  <div class="flex items-center gap-2">
    <NcTooltip hide-on-click>
      <template #title> {{ $t('labels.previous') }}</template>

      <a-button
        v-e="`['c:calendar:calendar-${activeCalendarView}-prev-btn']`"
        class="!w-7 !h-7 prev-next-btn !hover:text-gray-700 transition-all !rounded-lg flex items-center justify-center !border-0"
        data-testid="nc-calendar-prev-btn"
        size="small"
        @click="paginateCalendarView('prev')"
      >
        <component :is="iconMap.ncChevronLeft" class="h-4 !mb-0.9 !-ml-0.5 w-4" />
      </a-button>
    </NcTooltip>
    <NcTooltip hide-on-click>
      <template #title> {{ $t('labels.next') }}</template>
      <a-button
        v-e="`['c:calendar:calendar-${activeCalendarView}-next-btn']`"
        class="!w-7 !h-7 !rounded-lg flex items-center !hover:text-gray-700 prev-next-btn !border-0 justify-center"
        data-testid="nc-calendar-next-btn"
        size="small"
        @click="paginateCalendarView('next')"
      >
        <component :is="iconMap.ncChevronRight" class="h-4 !mb-0.8 !-ml-0.2 w-4" />
      </a-button>
    </NcTooltip>
  </div>
</template>

<style scoped lang="scss"></style>
