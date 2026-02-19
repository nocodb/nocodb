import type { RlsDefaultBehavior, RlsPolicySubjectType, RlsPolicyType, FilterType } from 'nocodb-sdk'
import type { BaseType } from 'nocodb-sdk'

export interface RlsPolicyState {
  policies: RlsPolicyType[]
  isLoading: boolean
  error: string | null
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
      console.error('Failed to load RLS policies:', e)
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
    filters?: FilterType[]
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
    } catch (e: any) {
      console.error('Failed to create RLS policy:', e)
      throw e
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
    } catch (e: any) {
      console.error('Failed to update RLS policy:', e)
      throw e
    } finally {
      isSaving.value = false
    }
  }

  const deletePolicy = async (policyId: string) => {
    if (!base.value?.fk_workspace_id || !base.value?.id) return

    isSaving.value = true
    try {
      await $api.internal.postOperation(
        base.value.fk_workspace_id,
        base.value.id,
        { operation: 'rlsPolicyDelete' },
        { policyId },
      )
      await loadPolicies()
    } catch (e: any) {
      console.error('Failed to delete RLS policy:', e)
      throw e
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
    } catch (e: any) {
      console.error('Failed to set RLS subjects:', e)
      throw e
    } finally {
      isSaving.value = false
    }
  }

  const createFilter = async (body: {
    fk_rls_policy_id: string
    fk_column_id?: string
    comparison_op?: string
    comparison_sub_op?: string
    value?: string
    is_group?: boolean
    logical_op?: string
    fk_parent_id?: string
  }) => {
    if (!base.value?.fk_workspace_id || !base.value?.id) return null

    try {
      const result = await $api.internal.postOperation(
        base.value.fk_workspace_id,
        base.value.id,
        { operation: 'rlsFilterCreate' },
        body,
      )
      return result
    } catch (e: any) {
      console.error('Failed to create RLS filter:', e)
      throw e
    }
  }

  const updateFilter = async (body: {
    id: string
    fk_column_id?: string
    comparison_op?: string
    comparison_sub_op?: string
    value?: string
    logical_op?: string
  }) => {
    if (!base.value?.fk_workspace_id || !base.value?.id) return null

    try {
      const result = await $api.internal.postOperation(
        base.value.fk_workspace_id,
        base.value.id,
        { operation: 'rlsFilterUpdate' },
        body,
      )
      return result
    } catch (e: any) {
      console.error('Failed to update RLS filter:', e)
      throw e
    }
  }

  const deleteFilter = async (filterId: string) => {
    if (!base.value?.fk_workspace_id || !base.value?.id) return

    try {
      await $api.internal.postOperation(
        base.value.fk_workspace_id,
        base.value.id,
        { operation: 'rlsFilterDelete' },
        { filterId },
      )
    } catch (e: any) {
      console.error('Failed to delete RLS filter:', e)
      throw e
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
    createFilter,
    updateFilter,
    deleteFilter,
    togglePolicy,
  }
}
