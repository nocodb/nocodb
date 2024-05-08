<script lang="ts" setup>
const props = defineProps<{
  row: Row
}>()

const currentRow = toRef(props, 'row')

const { isNew, state } = useProvideSmartsheetRowStore(currentRow)

const reloadViewDataTrigger = inject(ReloadViewDataHookInj)!

// override reload trigger and use it to reload row
const reloadHook = createEventHook()

reloadHook.on((params) => {
  if (isNew.value) return
  reloadViewDataTrigger?.trigger({
    shouldShowLoading: (params?.shouldShowLoading as boolean) ?? false,
  })
})

provide(ReloadRowDataHookInj, reloadHook)
</script>

<template>
  <slot :state="state" />
</template>
