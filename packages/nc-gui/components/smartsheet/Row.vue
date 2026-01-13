<script lang="ts" setup>
const props = defineProps<{
  row: Row
}>()

const currentRow = toRef(props, 'row')

const { isNew, state, loadRow, pk } = useProvideSmartsheetRowStore(currentRow)

const reloadViewDataTrigger = inject(ReloadViewDataHookInj)!

// override reload trigger and use it to reload row
const reloadHook = createEventHook()

reloadHook.on((params) => {
  if (isNew.value) return
  reloadViewDataTrigger?.trigger({
    ...params,
    shouldShowLoading: (params?.shouldShowLoading as boolean) ?? false,
  })
})

const { eventBus } = useScriptExecutor()

const eventHandler = async (event: SmartsheetScriptActions, payload: any) => {
  if (event === SmartsheetScriptActions.RELOAD_ROW) {
    // eslint-disable-next-line eqeqeq
    if (payload.rowId == pk.value) {
      await loadRow()
    }
  }
}

eventBus.on(eventHandler)

onBeforeUnmount(() => {
  eventBus.off(eventHandler)
})

provide(ReloadRowDataHookInj, reloadHook)
</script>

<template>
  <slot :state="state" />
</template>
