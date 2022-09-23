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
    message.error(await extractSdkResponseErrorMsg(e))
  }
}
</script>

<template>
  <div class="nc-container h-full mt-1.5 px-12">
    <div class="flex flex-col h-full flex-1 min-w-0">
      <SmartsheetToolbar />
      <div class="h-full flex-1 min-w-0 min-h-0 bg-gray-50">
        <SmartsheetKanban />
      </div>
    </div>
  </div>
</template>
