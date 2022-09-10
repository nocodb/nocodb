<script setup lang="ts">
import type { Ref } from 'vue'
import type { TableType } from 'nocodb-sdk'
import {
  IsFormInj,
  IsPublicInj,
  MetaInj,
  ReloadViewDataHookInj,
  createEventHook,
  definePageMeta,
  provide,
  ref,
  useProvideSharedFormStore,
  useProvideSmartsheetStore,
  useRoute,
  useSidebar,
} from '#imports'

definePageMeta({
  public: true,
})

useSidebar({ hasSidebar: false })

const route = useRoute()

const { loadSharedView, sharedView, meta, notFound } = useProvideSharedFormStore(route.params.viewId as string)

await loadSharedView()

if (!notFound.value) {
  provide(ReloadViewDataHookInj, createEventHook())
  provide(MetaInj, meta)
  provide(IsPublicInj, ref(true))
  provide(IsFormInj, ref(true))

  useProvideSmartsheetStore(sharedView as Ref<TableType>, meta as Ref<TableType>, true)
}
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
