<script setup lang="ts">
import type { Ref } from 'vue'
import type { TableType } from 'nocodb-sdk/build/main'
import { ActiveViewInj, FieldsInj, IsPublicInj, MetaInj, ReloadViewDataHookInj } from '~/context'

definePageMeta({
  requiresAuth: false,
})

const route = useRoute()

const reloadEventHook = createEventHook<void>()
const { sharedView, loadSharedView, meta, columns } = useSharedView(route.params.viewId as string)

await loadSharedView()

provide(ReloadViewDataHookInj, reloadEventHook)
provide(MetaInj, meta)
provide(ActiveViewInj, sharedView)
provide(FieldsInj, ref(columns))
provide(IsPublicInj, ref(true))

const { isGrid } = useProvideSmartsheetStore(sharedView as Ref<TableType>, meta)
</script>

<template>
  <NuxtLayout id="content" class="flex">
    <SmartsheetGrid :is-public-view="true" />
  </NuxtLayout>
</template>
