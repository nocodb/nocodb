<script setup lang="ts">
import type { Ref } from 'vue'
import type { TableType } from 'nocodb-sdk/build/main'

import { ActiveViewInj, FieldsInj, IsPublicInj, MetaInj, ReadonlyInj, ReloadViewDataHookInj } from '~/context'

import { useRoute } from '#imports'
definePageMeta({
  requiresAuth: false,
})

const route = useRoute()

const reloadEventHook = createEventHook<void>()
const { sharedView, loadSharedView, meta, columns } = useSharedView()

await loadSharedView(route.params.viewId as string)

provide(ReloadViewDataHookInj, reloadEventHook)
provide(MetaInj, meta)
provide(ActiveViewInj, sharedView)
provide(FieldsInj, columns)
provide(IsPublicInj, ref(true))
provide(ReadonlyInj, ref(true))

const { isGrid } = useProvideSmartsheetStore(sharedView as Ref<TableType>, meta)
</script>

<template>
  <NuxtLayout id="content" class="flex">
    <div class="nc-container flex flex-col h-full mt-2 px-6">
      <SmartsheetToolbar />
      <SmartsheetGrid :is-public-view="true" />
    </div>
  </NuxtLayout>
</template>

<style scoped>
.nc-container {
  height: calc(100% - var(--header-height));
  flex: 1 1 100%;
}
</style>
