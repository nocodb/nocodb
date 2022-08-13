<script setup lang="ts">
import type { Ref } from 'vue'
import type { TableType } from 'nocodb-sdk/build/main'

import { ActiveViewInj, FieldsInj, IsPublicInj, MetaInj, ReloadViewDataHookInj } from '~/context'

import { useRoute } from '#imports'
definePageMeta({
  requiresAuth: false,
})

const route = useRoute()

const reloadEventHook = createEventHook<void>()
const { sharedView, loadSharedView, meta, formColumns } = useSharedView()
console.log(sharedView)
await loadSharedView(route.params.viewId as string)

provide(ReloadViewDataHookInj, reloadEventHook)
provide(MetaInj, meta)
provide(ActiveViewInj, sharedView)
provide(FieldsInj, formColumns)
provide(IsPublicInj, ref(true))

useProvideSmartsheetStore(sharedView as Ref<TableType>, meta)
// useSmartsheetRowStore()
</script>

<template>
  <NuxtLayout id="content" class="flex">
    <div class="nc-container flex flex-col h-full mt-2 px-6">
      <SharedViewForm />
    </div>
  </NuxtLayout>
</template>

<style scoped>
.nc-container {
  height: calc(100% - var(--header-height));
  flex: 1 1 100%;
}
</style>
