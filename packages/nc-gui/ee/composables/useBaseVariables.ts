import { BaseVariableInheritance } from 'nocodb-sdk'
import type { BaseVariableReqType, BaseVariableType } from 'nocodb-sdk'

export const useBaseVariables = createSharedComposable(() => {
  const { $api } = useNuxtApp()

  const { t } = useI18n()

  const { activeWorkspaceId } = storeToRefs(useWorkspace())

  const { activeProjectId } = storeToRefs(useBases())

  const variables = ref<BaseVariableType[]>([])

  const isLoading = ref(false)

  // Variables that need configuration (required with no value)
  const unconfiguredRequiredVars = computed(() =>
    variables.value.filter((v) => v.inheritance === BaseVariableInheritance.REQUIRED && (!v.value || v.value === '***')),
  )

  const hasUnconfiguredVars = computed(() => unconfiguredRequiredVars.value.length > 0)

  const listVariables = async () => {
    if (!activeWorkspaceId.value || !activeProjectId.value) return

    try {
      isLoading.value = true
      variables.value = []

      const response = await $api.internal.getOperation(activeWorkspaceId.value, activeProjectId.value, {
        operation: 'baseVariableList',
      })

      if (response && (response as any).list) {
        variables.value = (response as any).list
      }
    } catch (error: any) {
      message.error(await extractSdkResponseErrorMsg(error))
    } finally {
      isLoading.value = false
    }
  }

  const createVariable = async (body: BaseVariableReqType) => {
    if (!activeWorkspaceId.value || !activeProjectId.value) return

    try {
      const response = await $api.internal.postOperation(
        activeWorkspaceId.value,
        activeProjectId.value,
        { operation: 'baseVariableCreate' },
        body,
      )

      message.success(t('msg.success.variableCreated'))
      await listVariables()
      return response
    } catch (error: any) {
      message.error(await extractSdkResponseErrorMsg(error))
    }
  }

  const updateVariable = async (variableId: string, body: Partial<BaseVariableReqType>) => {
    if (!activeWorkspaceId.value || !activeProjectId.value) return

    try {
      const response = await $api.internal.postOperation(
        activeWorkspaceId.value,
        activeProjectId.value,
        { operation: 'baseVariableUpdate', variableId },
        body,
      )

      message.success(t('msg.success.variableUpdated'))
      await listVariables()
      return response
    } catch (error: any) {
      message.error(await extractSdkResponseErrorMsg(error))
    }
  }

  const deleteVariable = async (variableId: string) => {
    if (!activeWorkspaceId.value || !activeProjectId.value) return

    try {
      await $api.internal.postOperation(
        activeWorkspaceId.value,
        activeProjectId.value,
        { operation: 'baseVariableDelete', variableId },
        {},
      )

      message.success(t('msg.success.variableDeleted'))
      await listVariables()
    } catch (error: any) {
      message.error(await extractSdkResponseErrorMsg(error))
    }
  }

  const revertToDefault = async (variableId: string) => {
    if (!activeWorkspaceId.value || !activeProjectId.value) return

    try {
      const response = await $api.internal.postOperation(
        activeWorkspaceId.value,
        activeProjectId.value,
        { operation: 'baseVariableRevertToDefault', variableId },
        {},
      )

      message.success(t('msg.success.variableUpdated'))
      await listVariables()
      return response
    } catch (error: any) {
      message.error(await extractSdkResponseErrorMsg(error))
    }
  }

  const bulkUpdateValues = async (baseId: string, updates: { id: string; value: string }[], workspaceId?: string) => {
    const wsId = workspaceId || activeWorkspaceId.value
    if (!wsId) return

    try {
      const response = await $api.internal.postOperation(
        wsId,
        baseId,
        { operation: 'baseVariableBulkUpdate' },
        { variables: updates },
      )

      message.success(t('msg.success.variablesConfigured'))
      return response
    } catch (error: any) {
      message.error(await extractSdkResponseErrorMsg(error))
    }
  }

  return {
    variables,
    isLoading,
    listVariables,
    createVariable,
    updateVariable,
    deleteVariable,
    revertToDefault,
    bulkUpdateValues,
    unconfiguredRequiredVars,
    hasUnconfiguredVars,
  }
})
