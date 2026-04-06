import type { BaseVariableReqType, BaseVariableType } from 'nocodb-sdk'

export const useBaseVariables = createSharedComposable(() => {
  const variables = ref<BaseVariableType[]>([])
  const isLoading = ref(false)

  const unconfiguredRequiredVars = computed<BaseVariableType[]>(() => [])
  const hasUnconfiguredVars = computed(() => false)

  const integrationVariables = computed<BaseVariableType[]>(() => [])
  const isIntegrationInheritable = (_integrationId: string) => false

  const listVariables = async () => {}
  const createVariable = async (_body: BaseVariableReqType) => {}
  const updateVariable = async (_variableId: string, _body: Partial<BaseVariableReqType>) => {}
  const deleteVariable = async (_variableId: string) => {}
  const revertToDefault = async (_variableId: string) => {}
  const bulkUpdateValues = async (_baseId: string, _updates: { id: string; value: string }[], _workspaceId?: string) => {}
  const makeInheritable = async (_integrationId: string, _key: string, _description?: string) => {}
  const removeInheritable = async (_integrationId: string) => {}

  return {
    variables,
    isLoading,
    unconfiguredRequiredVars,
    hasUnconfiguredVars,
    integrationVariables,
    isIntegrationInheritable,
    listVariables,
    createVariable,
    updateVariable,
    deleteVariable,
    revertToDefault,
    bulkUpdateValues,
    makeInheritable,
    removeInheritable,
  }
})
