<script setup lang="ts">
import type { Ref } from 'vue'
import type { TableType } from 'nocodb-sdk'

import { ActiveViewInj, FieldsInj, IsPublicInj, MetaInj, ReadonlyInj, ReloadViewDataHookInj } from '~/context'

const { sharedView, meta } = useSharedView()

const reloadEventHook = createEventHook<void>()
provide(ReloadViewDataHookInj, reloadEventHook)
provide(ReadonlyInj, true)
provide(MetaInj, meta)
provide(ActiveViewInj, sharedView)
provide(FieldsInj, ref(meta.value.columns as any[]))
provide(IsPublicInj, ref(true))

useProvideSmartsheetStore(sharedView as Ref<TableType>, meta)
</script>

<template>
  <div class="nc-container flex flex-col h-full mt-4 px-6">
    <SmartsheetToolbar />
    <SmartsheetGrid class="px-3" />
  </div>
</template>

<style scoped>
.nc-container {
  height: calc(100% - var(--header-height));
  flex: 1 1 100%;
}
</style>
