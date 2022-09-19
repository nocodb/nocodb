<script setup lang="ts">
import { message } from 'ant-design-vue'
import { ActiveViewInj, FieldsInj, IsPublicInj, MetaInj, ReadonlyInj, ReloadViewDataHookInj } from '#imports'

const { sharedView, meta, sorts, nestedFilters } = useSharedView()
const { signedIn } = useGlobal()
const { loadProject } = useProject(meta.value?.project_id)

const reloadEventHook = createEventHook<void>()

provide(ReloadViewDataHookInj, reloadEventHook)
provide(ReadonlyInj, true)
provide(MetaInj, meta)
provide(ActiveViewInj, sharedView)
provide(FieldsInj, ref(meta.value?.columns || []))
provide(IsPublicInj, ref(true))

useProvideSmartsheetStore(sharedView, meta, true, sorts, nestedFilters)

if (signedIn.value) {
  try {
    await loadProject()
  } catch (e: any) {
    console.error(e)
    message.error(await extractSdkResponseErrorMsg(e))
  }
}
</script>

<template>
  <div class="nc-container flex flex-col h-full mt-1.5 px-12">
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
