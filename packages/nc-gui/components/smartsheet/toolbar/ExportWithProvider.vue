<script lang="ts" setup>
const { sharedView, meta, nestedFilters } = useSharedView()

const { isLocked, xWhere } = useProvideSmartsheetStore(sharedView, meta, true, ref([]), nestedFilters)

const reloadEventHook = createEventHook()

provide(ReloadViewDataHookInj, reloadEventHook)

provide(ReadonlyInj, ref(true))

provide(MetaInj, meta)

provide(ActiveViewInj, sharedView)

provide(IsPublicInj, ref(true))

provide(IsLockedInj, isLocked)

useProvideViewColumns(sharedView, meta, () => reloadEventHook?.trigger(), true)

useProvideViewGroupBy(sharedView, meta, xWhere, true)

useProvideSmartsheetLtarHelpers(meta)

useProvideKanbanViewStore(meta, sharedView)

useProvideCalendarViewStore(meta, sharedView, true, xWhere)
</script>

<template>
  <SmartsheetToolbarExport />
</template>
