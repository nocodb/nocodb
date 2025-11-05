import type { WorkflowType } from 'nocodb-sdk'

const [useProvideWorkflowStore, useWorkflowStore] = useInjectionState((_workflow: WorkflowType) => {
  const automationStore = useAutomationStore()
  const { updateAutomation } = automationStore
  const { activeAutomation, isSettingsOpen } = storeToRefs(automationStore)
  const { activeProjectId } = storeToRefs(useBases())
  // const { isUIAllowed } = useRoles()
  // const { $e } = useNuxtApp()

  const debouncedSave = useDebounceFn(async () => {
    if (!activeProjectId.value || !activeAutomation.value?.id) return
    await updateWorkflow({
      workflow: activeAutomation.value.workflow,
    })
  }, 500)

  return {
    activeAutomation,
    debouncedSave,
  }
})

export { useProvideWorkflowStore }

export function useWorkflowStoreOrThrow() {
  const state = useWorkflowStore()

  if (!state) {
    throw new Error('useWorkflowStoreOrThrow must be used within a WorkflowStoreProvider')
  }

  return state
}
