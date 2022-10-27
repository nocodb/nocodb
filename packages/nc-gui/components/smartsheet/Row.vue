<script lang="ts" setup>
import type { Ref } from 'vue'
import type { TableType } from 'nocodb-sdk'
import type { Row } from '~/lib'
import {
  ReloadRowDataHookInj,
  ReloadViewDataHookInj,
  createEventHook,
  inject,
  provide,
  toRef,
  useProvideSmartsheetRowStore,
  useSmartsheetStoreOrThrow,
  watch,
} from '#imports'

const props = defineProps<{
  row: Row
}>()

const currentRow = toRef(props, 'row')

const { meta } = useSmartsheetStoreOrThrow()

const { isNew, state, syncLTARRefs, clearLTARCell } = useProvideSmartsheetRowStore(meta as Ref<TableType>, currentRow)

// on changing isNew(new record insert) status sync LTAR cell values
watch(isNew, async (nextVal, prevVal) => {
  if (prevVal && !nextVal) {
    await syncLTARRefs(currentRow.value.row)
    // update row values without invoking api
    currentRow.value.row = { ...currentRow.value.row, ...state.value }
    currentRow.value.oldRow = { ...currentRow.value.row, ...state.value }
  }
})

const reloadViewDataTrigger = inject(ReloadViewDataHookInj)!

// override reload trigger and use it to reload row
const reloadHook = createEventHook<boolean | void>()

reloadHook.on((shouldShowLoading) => {
  if (isNew.value) return
  reloadViewDataTrigger?.trigger(shouldShowLoading)
})

provide(ReloadRowDataHookInj, reloadHook)

defineExpose({
  syncLTARRefs,
  clearLTARCell,
})
</script>

<template>
  <slot :state="state" />
</template>
