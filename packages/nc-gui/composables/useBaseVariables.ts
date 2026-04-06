import type { BaseVariableReqType, BaseVariableType } from 'nocodb-sdk'

export const useBaseVariables = createSharedComposable(() => {
  const variables = ref<BaseVariableType[]>([])
  const isLoading = ref(false)

  const listVariables = async () => {}
  const createVariable = async (_body: BaseVariableReqType) => {}
  const updateVariable = async (_variableId: string, _body: Partial<BaseVariableReqType>) => {}
  const deleteVariable = async (_variableId: string) => {}
  const bulkUpdateValues = async (_baseId: string, _updates: { id: string; value: string }[], _workspaceId?: string) => {}

  return {
    variables,
    isLoading,
    listVariables,
    createVariable,
    updateVariable,
    deleteVariable,
    bulkUpdateValues,
  }
})
