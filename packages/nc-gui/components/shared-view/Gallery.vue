<script setup lang="ts">
import { ActiveViewInj, FieldsInj, IsPublicInj, MetaInj, ReadonlyInj, ReloadViewDataHookInj } from '#imports'

const { sharedView, meta, nestedFilters } = useSharedView()

const reloadEventHook = createEventHook()

provide(ReloadViewDataHookInj, reloadEventHook)

provide(ReadonlyInj, ref(true))

provide(MetaInj, meta)

provide(ActiveViewInj, sharedView)

provide(FieldsInj, ref(meta.value?.columns || []))

provide(IsPublicInj, ref(true))

useProvideViewColumns(sharedView, meta, () => reloadEventHook?.trigger(), true)

useProvideSmartsheetStore(sharedView, meta, true, ref([]), nestedFilters)
</script>

<template>
  <div class="nc-container h-full mt-1.5 px-12">
    <div class="flex flex-col h-full flex-1 min-w-0">
      <LazySmartsheetToolbar />
      <div class="h-full flex-1 min-w-0 min-h-0 bg-gray-50">
        <LazySmartsheetGallery />
      </div>
    </div>
  </div>
</template>
