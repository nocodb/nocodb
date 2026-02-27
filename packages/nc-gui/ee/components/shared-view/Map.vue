<script setup lang="ts">
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

useProvideMapViewStore(meta, sharedView, true)

useViewRowColorProvider({ shared: true })
</script>

<template>
  <div class="nc-container h-full">
    <div class="flex flex-col h-full flex-1 min-w-0">
      <LazySmartsheetToolbar show-full-screen-toggle />
      <div class="nc-shared-map-container">
        <LazySmartsheetMap />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.nc-shared-map-container {
  @apply h-full flex-1 min-w-0 min-h-0 bg-nc-bg-gray-extralight overflow-hidden;
}
</style>

<style lang="scss">
.nc-lang-btn-wrapper {
  z-index: 5000;
}
</style>
