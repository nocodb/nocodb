<script lang="ts" setup>
import type { Row } from '~/composables'
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

const { isNew, state, syncLTARRefs } = useProvideSmartsheetRowStore(meta, currentRow)

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
const reloadHook = createEventHook()

reloadHook.on(() => {
  if (isNew.value) return
  reloadViewDataTrigger?.trigger()
})

provide(ReloadRowDataHookInj, reloadHook)

defineExpose({
  syncLTARRefs,
})
</script>

<template>
  <slot :state="state" />
</template>
