<script lang="ts" setup>
const { sharedView, meta, nestedFilters } = useSharedView()

const { signedIn } = useGlobal()

const { loadProject } = useBase()

const { isLocked, xWhere } = useProvideSmartsheetStore(sharedView, meta, true, ref([]), nestedFilters)

useProvideKanbanViewStore(meta, sharedView)
useProvideCalendarViewStore(meta, sharedView)

const reloadEventHook = createEventHook()

const columns = ref(meta.value?.columns || [])

provide(ReloadViewDataHookInj, reloadEventHook)
provide(ReadonlyInj, ref(true))
provide(MetaInj, meta)
provide(ActiveViewInj, sharedView)
provide(IsPublicInj, ref(true))
provide(IsLockedInj, isLocked)

provide(ReloadAggregateHookInj, createEventHook())

useProvideViewColumns(sharedView, meta, () => reloadEventHook?.trigger(), true)
useProvideViewGroupBy(sharedView, meta, xWhere, true)

useProvideSmartsheetLtarHelpers(meta)

if (signedIn.value) {
  try {
    await loadProject()
  } catch (e: any) {
    console.error(e)
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

watch(
  () => meta.value?.columns,
  () => (columns.value = meta.value?.columns || []),
  {
    immediate: true,
  },
)
</script>

<template>
  <div class="nc-container flex flex-col h-full">
    <LazySmartsheetToolbar />
    <LazySmartsheetGrid />
  </div>
</template>

<style scoped>
.nc-container {
  height: 100%;
  padding-bottom: 0.5rem;
  flex: 1 1 100%;
}
</style>
