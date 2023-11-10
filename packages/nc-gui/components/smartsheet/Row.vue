<script lang="ts" setup>
import type { Ref } from 'vue'
import type { TableType } from 'nocodb-sdk'
import type { Row } from '#imports'
import {
  ReloadRowDataHookInj,
  ReloadViewDataHookInj,
  createEventHook,
  inject,
  provide,
  toRef,
  useProvideSmartsheetRowStore,
  useSmartsheetStoreOrThrow,
} from '#imports'

const props = defineProps<{
  row: Row
}>()

const currentRow = toRef(props, 'row')

const { meta } = useSmartsheetStoreOrThrow()

const { isNew, state, syncLTARRefs, clearLTARCell, addLTARRef } = useProvideSmartsheetRowStore(meta as Ref<TableType>, currentRow)

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
  addLTARRef,
})
</script>

<template>
  <slot :state="state" />
</template>
