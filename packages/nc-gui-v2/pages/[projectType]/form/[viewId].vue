<script setup lang="ts">
import type { Ref } from 'vue'
import type { TableType } from 'nocodb-sdk/build/main'
import { useProvideSharedFormStore } from '~/composables/useSharedFormViewStore'
import { IsFormInj, IsPublicInj, MetaInj, ReloadViewDataHookInj } from '~/context'
import { createEventHook, definePageMeta, provide, ref, useProvideSmartsheetStore, useRoute } from '#imports'

definePageMeta({
  public: true,
})

const route = useRoute()

const reloadEventHook = createEventHook<void>()

const { loadSharedView, sharedView, meta, notFound } = useProvideSharedFormStore(route.params.viewId as string)

await loadSharedView()
if (!notFound.value) {
  provide(ReloadViewDataHookInj, reloadEventHook)
  provide(MetaInj, meta)
  provide(IsPublicInj, ref(true))
  provide(IsFormInj, ref(true))

  useProvideSmartsheetStore(sharedView as Ref<TableType>, meta as Ref<TableType>)
}
</script>

<template>
  <SharedViewForm />
</template>
