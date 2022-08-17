<script setup lang="ts">
import type { Ref } from 'vue'
import type { TableType } from 'nocodb-sdk/build/main'
import { useProvideSharedFormStore } from '~/composables/useSharedFormViewStore'
import { ActiveViewInj, FieldsInj, IsFormInj, IsPublicInj, MetaInj, ReloadViewDataHookInj } from '~/context'
import { createEventHook, definePageMeta, provide, ref, useProvideSmartsheetStore, useRoute } from '#imports'

definePageMeta({
  public: true,
})

const route = useRoute()

const reloadEventHook = createEventHook<void>()

const { loadSharedView, sharedView, meta, notFound, formColumns } = useProvideSharedFormStore(route.params.viewId)

await loadSharedView()
if (!notFound.value) {
  provide(ReloadViewDataHookInj, reloadEventHook)
  provide(MetaInj, meta)
  provide(ActiveViewInj, sharedView)
  provide(FieldsInj, formColumns)
  provide(IsPublicInj, ref(true))
  provide(IsFormInj, ref(true))

  useProvideSmartsheetStore(sharedView as Ref<TableType>, meta as Ref<TableType>)
}
</script>

<template>
  <!--  <NuxtLayout name="empty"> -->
  <SharedViewForm />
  <!--  </NuxtLayout> -->
</template>

<style scoped>
:global(.ant-layout-header) {
  @apply !hidden;
}
:global(.nc-main-container) {
  @apply !h-auto;
}
</style>
