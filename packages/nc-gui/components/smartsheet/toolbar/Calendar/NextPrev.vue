<script setup lang="ts">
const { activeCalendarView, paginateCalendarView } = useCalendarViewStoreOrThrow()
</script>

<template>
  <div class="flex items-center gap-2">
    <NcTooltip hide-on-click>
      <template #title> {{ $t('labels.previous') }}</template>

      <NcButton
        v-e="`['c:calendar:calendar-${activeCalendarView}-prev-btn']`"
        class="!w-7 !h-7 !rounded-lg prev-next-btn !hover:(text-nc-content-gray-subtle)"
        inner-class="flex items-center justify-center"
        data-testid="nc-calendar-prev-btn"
        size="xs"
        type="text"
        @click="paginateCalendarView('prev')"
      >
        <GeneralIcon icon="ncChevronLeft" class="h-4 !-ml-0.5 w-4" />
      </NcButton>
    </NcTooltip>
    <NcTooltip hide-on-click>
      <template #title> {{ $t('labels.next') }}</template>
      <NcButton
        v-e="`['c:calendar:calendar-${activeCalendarView}-next-btn']`"
        class="!w-7 !h-7 !rounded-lg !hover:(text-nc-content-gray-subtle) prev-next-btn"
        inner-class="flex items-center justify-center"
        data-testid="nc-calendar-next-btn"
        size="xs"
        type="text"
        @click="paginateCalendarView('next')"
      >
        <GeneralIcon icon="ncChevronRight" class="h-4 !-ml-0.2 w-4" />
      </NcButton>
    </NcTooltip>
  </div>
</template>
