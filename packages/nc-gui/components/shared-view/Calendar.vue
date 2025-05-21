<script lang="ts" setup>
const { sharedView, meta, nestedFilters } = useSharedView()

const reloadEventHook = createEventHook()

provide(ReloadViewDataHookInj, reloadEventHook)

provide(ReadonlyInj, ref(true))

provide(MetaInj, meta)

provide(ActiveViewInj, sharedView)

provide(IsPublicInj, ref(true))

useProvideViewColumns(sharedView, meta, () => reloadEventHook?.trigger(), true)

useProvideSmartsheetLtarHelpers(meta)

useProvideSmartsheetStore(sharedView, meta, true, ref([]), nestedFilters)

useProvideKanbanViewStore(meta, sharedView)

useProvideCalendarViewStore(meta, sharedView, true, nestedFilters)
</script>

<template>
  <div class="nc-container h-full">
    <div class="flex flex-col h-full flex-1 min-w-0">
      <LazySmartsheetToolbar />
      <div class="h-full flex-1 min-w-0 min-h-0">
        <LazySmartsheetCalendar />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
