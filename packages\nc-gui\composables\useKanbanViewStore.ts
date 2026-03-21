// Add to existing useKanbanViewStore composable:

const isCompact = computed(() => {
  return !!(kanbanMetaData.value as KanbanType & { meta?: { compact?: boolean } })?.meta?.compact
})

const updateCompact = async (val: boolean) => {
  if (!activeView.value?.id || isPublic.value) return
  
  const currentMeta = (kanbanMetaData.value as KanbanType & { meta?: Record<string, any> })?.meta || {}
  
  await updateKanbanMeta({
    meta: {
      ...currentMeta,
      compact: val,
    },
  })
}
