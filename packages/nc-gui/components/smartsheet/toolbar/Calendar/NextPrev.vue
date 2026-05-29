<script setup lang="ts">
const { activeCalendarView, paginateCalendarView } = useCalendarViewStoreOrThrow()

// In Month view, holding Shift while clicking prev/next steps by 1 week instead
// of 1 month — useful for planning workflows that span month boundaries.
const supportsWeekStep = computed(() => activeCalendarView.value === 'month' || activeCalendarView.value === 'day')

const onNavigate = (action: 'next' | 'prev', event: MouseEvent) => {
  paginateCalendarView(action, event.shiftKey && supportsWeekStep.value ? 'week' : undefined)
}
</script>

<template>
  <div class="flex items-center gap-2">
    <NcTooltip hide-on-click>
      <template #title>
        {{ $t('labels.previous') }}
        <div v-if="supportsWeekStep" class="text-xs text-nc-content-gray-muted">{{ $t('tooltip.shiftClickWeekStep') }}</div>
      </template>

      <NcButton
        v-e="`['c:calendar:calendar-${activeCalendarView}-prev-btn']`"
        class="!w-7 !h-7 !rounded-lg prev-next-btn !hover:(text-nc-content-gray-subtle)"
        inner-class="flex items-center justify-center"
        data-testid="nc-calendar-prev-btn"
        size="xs"
        type="text"
        @click="onNavigate('prev', $event)"
      >
        <GeneralIcon icon="ncChevronLeft" class="h-4 !-ml-0.5 w-4" />
      </NcButton>
    </NcTooltip>
    <NcTooltip hide-on-click>
      <template #title>
        {{ $t('labels.next') }}
        <div v-if="supportsWeekStep" class="text-xs text-nc-content-gray-muted">{{ $t('tooltip.shiftClickWeekStep') }}</div>
      </template>
      <NcButton
        v-e="`['c:calendar:calendar-${activeCalendarView}-next-btn']`"
        class="!w-7 !h-7 !rounded-lg !hover:(text-nc-content-gray-subtle) prev-next-btn"
        inner-class="flex items-center justify-center"
        data-testid="nc-calendar-next-btn"
        size="xs"
        type="text"
        @click="onNavigate('next', $event)"
      >
        <GeneralIcon icon="ncChevronRight" class="h-4 !-ml-0.2 w-4" />
      </NcButton>
    </NcTooltip>
  </div>
</template>
