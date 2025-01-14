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
    shouldShowLoading: (params?.shouldShowLoading as boolean) ?? false,
  })
})

const { eventBus: scriptEventBus } = useScriptExecutor()

scriptEventBus.on(async (event, payload) => {
  if (event === SmartsheetScriptActions.RELOAD_ROW) {
    // eslint-disable-next-line eqeqeq
    if (payload.rowId == pk.value) {
      await loadRow()
    }
  }
})

provide(ReloadRowDataHookInj, reloadHook)
</script>

<template>
  <slot :state="state" />
</template>
