import type { BaseType, RlsDefaultBehavior, RlsPolicySubjectType, RlsPolicyType } from 'nocodb-sdk'

export interface RlsPolicyState {
  policies: RlsPolicyType[]
  isLoading: boolean
}

export const useRlsPolicies = (base: Ref<BaseType | null>, tableId: Ref<string>) => {
  const { $api } = useNuxtApp()

  const policies = ref<RlsPolicyType[]>([])
  const isLoading = ref(false)
  const isSaving = ref(false)

  const loadPolicies = async () => {
    if (!base.value?.fk_workspace_id || !base.value?.id || !tableId.value) return

    isLoading.value = true
    try {
      const result = await $api.internal.getOperation(base.value.fk_workspace_id, base.value.id, {
        operation: 'rlsPolicyList',
        tableId: tableId.value,
      })
      policies.value = (result as any)?.list ?? result ?? []
    } catch (e: any) {
      policies.value = []
    } finally {
      isLoading.value = false
    }
  }

  const createPolicy = async (body: {
    fk_model_id: string
    title?: string
    is_default?: boolean
    default_behavior?: RlsDefaultBehavior
    subjects?: RlsPolicySubjectType[]
  }) => {
    if (!base.value?.fk_workspace_id || !base.value?.id) return null

    isSaving.value = true
    try {
      const result = await $api.internal.postOperation(
        base.value.fk_workspace_id,
        base.value.id,
        { operation: 'rlsPolicyCreate' },
        body,
      )
      await loadPolicies()
      return result
    } finally {
      isSaving.value = false
    }
  }

  const updatePolicy = async (body: {
    id: string
    title?: string
    enabled?: boolean
    default_behavior?: RlsDefaultBehavior
    order?: number
  }) => {
    if (!base.value?.fk_workspace_id || !base.value?.id) return null

    isSaving.value = true
    try {
      const result = await $api.internal.postOperation(
        base.value.fk_workspace_id,
        base.value.id,
        { operation: 'rlsPolicyUpdate' },
        body,
      )
      await loadPolicies()
      return result
    } finally {
      isSaving.value = false
    }
  }

  const deletePolicy = async (policyId: string) => {
    if (!base.value?.fk_workspace_id || !base.value?.id) return

    isSaving.value = true
    try {
      await $api.internal.postOperation(base.value.fk_workspace_id, base.value.id, { operation: 'rlsPolicyDelete' }, { policyId })
      await loadPolicies()
    } finally {
      isSaving.value = false
    }
  }

  const setSubjects = async (policyId: string, subjects: RlsPolicySubjectType[]) => {
    if (!base.value?.fk_workspace_id || !base.value?.id) return null

    isSaving.value = true
    try {
      const result = await $api.internal.postOperation(
        base.value.fk_workspace_id,
        base.value.id,
        { operation: 'rlsPolicySetSubjects' },
        { policyId, subjects },
      )
      await loadPolicies()
      return result
    } finally {
      isSaving.value = false
    }
  }

  const togglePolicy = async (policy: RlsPolicyType) => {
    if (!policy.id) return
    await updatePolicy({
      id: policy.id,
      enabled: !policy.enabled,
    })
  }

  return {
    policies,
    isLoading,
    isSaving,
    loadPolicies,
    createPolicy,
    updatePolicy,
    deletePolicy,
    setSubjects,
    togglePolicy,
  }
}
