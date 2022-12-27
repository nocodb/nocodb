<script setup lang="ts">
import type { ColumnType, TableType, ViewType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { ActiveViewInj, MetaInj, useGPTStoreOrThrow, useMetas, useProvideSmartsheetStore } from '#imports'

const { getMeta } = useMetas()

const { gptTable, gptGridView } = useGPTStoreOrThrow()

const fields = ref<ColumnType[]>([])

const reloadEventHook = createEventHook<void | boolean>()

const reloadViewMetaEventHook = createEventHook<void | boolean>()

const openNewRecordFormHook = createEventHook<void>()

const { isLocked } = useProvideSmartsheetStore(gptGridView as Ref<ViewType>, gptTable as Ref<TableType>)

provide(MetaInj, gptTable as Ref<TableType>)

provide(ActiveViewInj, gptGridView)

provide(IsLockedInj, isLocked)

provide(IsFormInj, ref(false))

provide(FieldsInj, fields)

provide(ReloadViewDataHookInj, reloadEventHook)

provide(ReloadViewMetaHookInj, reloadViewMetaEventHook)

provide(OpenNewRecordFormHookInj, openNewRecordFormHook)

onMounted(async () => await getMeta(gptTable.value?.id as string, true))
</script>

<template>
  <div class="nc-container flex h-full">
    <div class="flex flex-col h-full flex-1 min-w-0">
      <LazySmartsheetToolbar />
      <Transition name="layout" mode="out-in">
        <template v-if="gptTable">
          <div class="flex flex-1 min-h-0">
            <div v-if="gptGridView" class="h-full flex-1 min-w-0 min-h-0 bg-gray-50">
              <LazySmartsheetGrid />
            </div>
          </div>
        </template>
      </Transition>
    </div>
  </div>
</template>
