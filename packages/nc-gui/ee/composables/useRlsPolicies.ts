import type { BaseType, RlsDefaultBehavior, RlsPolicySubjectType, RlsPolicyType } from 'nocodb-sdk'
import { useMetas } from '~/composables/useMetas'

export interface RlsPolicyState {
  policies: RlsPolicyType[]
  isLoading: boolean
}

export const useRlsPolicies = (base: Ref<BaseType | null>, tableId: Ref<string>) => {
  const { $api } = useNuxtApp()
  const { getMeta } = useMetas()
  const { baseTables } = storeToRefs(useTablesStore())

  const policies = ref<RlsPolicyType[]>([])
  const isLoading = ref(false)
  const isSaving = ref(false)

  const refreshTableMeta = () => {
    const baseId = base.value?.id
    if (!baseId || !tableId.value) return

    getMeta(baseId, tableId.value, true).then((updatedMeta) => {
      if (!updatedMeta) return

      const tables = baseTables.value.get(baseId)
      if (tables) {
        const index = tables.findIndex((t) => t.id === tableId.value)
        if (index !== -1) {
          tables[index] = { ...tables[index], meta: updatedMeta.meta }
          baseTables.value.set(baseId, tables)
        }
      }
    })
  }

  const loadPolicies = async ({ silent = false } = {}) => {
    if (!base.value?.fk_workspace_id || !base.value?.id || !tableId.value) return

    if (!silent) isLoading.value = true
    try {
      const result = await $api.internal.getOperation(base.value.fk_workspace_id, base.value.id, {
        operation: 'rlsPolicyList',
        tableId: tableId.value,
      })
      policies.value = (result as any)?.list ?? result ?? []
    } catch (e: any) {
      policies.value = []
    } finally {
      if (!silent) isLoading.value = false
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
      refreshTableMeta()
      return result
    } finally {
      isSaving.value = false
    }
  }

  const updatePolicy = async (
    body: {
      id: string
      title?: string
      enabled?: boolean
      default_behavior?: RlsDefaultBehavior
      order?: number
    },
    { silent = false } = {},
  ) => {
    if (!base.value?.fk_workspace_id || !base.value?.id) return null

    if (!silent) isSaving.value = true
    try {
      const result = await $api.internal.postOperation(
        base.value.fk_workspace_id,
        base.value.id,
        { operation: 'rlsPolicyUpdate' },
        body,
      )
      await loadPolicies({ silent })
      refreshTableMeta()
      return result
    } finally {
      if (!silent) isSaving.value = false
    }
  }

  const deletePolicy = async (policyId: string) => {
    if (!base.value?.fk_workspace_id || !base.value?.id) return

    isSaving.value = true
    try {
      await $api.internal.postOperation(base.value.fk_workspace_id, base.value.id, { operation: 'rlsPolicyDelete' }, { policyId })
      await loadPolicies()
      refreshTableMeta()
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

    // Optimistically update local state
    const idx = policies.value.findIndex((p) => p.id === policy.id)
    if (idx !== -1) {
      policies.value[idx] = { ...policies.value[idx], enabled: !policy.enabled }
    }

    try {
      await updatePolicy({ id: policy.id, enabled: !policy.enabled }, { silent: true })
    } catch {
      // Revert on failure
      if (idx !== -1) {
        policies.value[idx] = { ...policies.value[idx], enabled: policy.enabled }
      }
    }
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
