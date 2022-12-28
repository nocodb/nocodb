<script setup lang="ts">
import type { ColumnType, TableType, ViewType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { ActiveViewInj, MetaInj, useCowriterStoreOrThrow, useMetas, useProvideSmartsheetStore } from '#imports'

const { getMeta } = useMetas()

const { cowriterTable, cowriterGridView } = useCowriterStoreOrThrow()

const fields = ref<ColumnType[]>([])

const reloadEventHook = createEventHook<void | boolean>()

const reloadViewMetaEventHook = createEventHook<void | boolean>()

const openNewRecordFormHook = createEventHook<void>()

const { isLocked } = useProvideSmartsheetStore(cowriterGridView as Ref<ViewType>, cowriterTable as Ref<TableType>)

provide(MetaInj, cowriterTable as Ref<TableType>)

provide(ActiveViewInj, cowriterGridView)

provide(IsLockedInj, isLocked)

provide(IsFormInj, ref(false))

provide(FieldsInj, fields)

provide(ReloadViewDataHookInj, reloadEventHook)

provide(ReloadViewMetaHookInj, reloadViewMetaEventHook)

provide(OpenNewRecordFormHookInj, openNewRecordFormHook)

onMounted(async () => await getMeta(cowriterTable.value?.id as string, true))
</script>

<template>
  <div class="nc-container flex h-full">
    <div class="flex flex-col h-full flex-1 min-w-0">
      <LazySmartsheetToolbar />
      <Transition name="layout" mode="out-in">
        <template v-if="cowriterTable">
          <div class="flex flex-1 min-h-0">
            <div v-if="cowriterGridView" class="h-full flex-1 min-w-0 min-h-0 bg-gray-50">
              <LazySmartsheetGrid />
            </div>
          </div>
        </template>
      </Transition>
    </div>
  </div>
</template>
