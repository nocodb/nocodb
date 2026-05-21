import { acceptHMRUpdate, defineStore } from 'pinia'
import type { RlsDefaultBehavior, RlsPolicySubjectType, RlsPolicyType } from 'nocodb-sdk'

export const useRlsStore = defineStore('rls', () => {
  const { $api } = useNuxtApp()

  const { activeWorkspaceId } = storeToRefs(useWorkspace())

  const { base } = storeToRefs(useBase())

  const { activeTableId, baseTables } = storeToRefs(useTablesStore())

  const policies = ref<Map<string, RlsPolicyType[]>>(new Map())

  const isLoading = ref(false)
  const isSaving = ref(false)

  const activePolicies = computed<RlsPolicyType[]>(() => {
    if (!activeTableId.value) return []
    return policies.value.get(activeTableId.value) ?? []
  })

  const syncRlsEnabledMeta = (tableId: string | undefined) => {
    const baseId = base.value?.id
    if (!baseId || !tableId) return

    const tables = baseTables.value.get(baseId)
    if (!tables) return
    const idx = tables.findIndex((t) => t.id === tableId)
    if (idx === -1) return

    const list = policies.value.get(tableId) ?? []
    const hasEnabled = list.some((p) => p.enabled)
    const meta = { ...((tables[idx].meta ?? {}) as Record<string, unknown>) }
    if (hasEnabled) meta.is_rls_enabled = true
    else delete meta.is_rls_enabled

    tables[idx] = { ...tables[idx], meta }
    baseTables.value.set(baseId, tables)
  }

  const setPoliciesFor = (tableId: string, list: RlsPolicyType[]) => {
    policies.value.set(tableId, list)
    syncRlsEnabledMeta(tableId)
  }

  const loadPolicies = async (tableId: string, { silent = false } = {}) => {
    if (!activeWorkspaceId.value || !base.value?.id || !tableId) return

    if (!silent) isLoading.value = true
    try {
      const result = await $api.internal.getOperation(activeWorkspaceId.value, base.value.id, {
        operation: 'rlsPolicyList',
        tableId,
      })
      setPoliciesFor(tableId, ((result as any)?.list ?? result ?? []) as RlsPolicyType[])
    } catch (e: any) {
      setPoliciesFor(tableId, [])
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
    if (!activeWorkspaceId.value || !base.value?.id) return null

    isSaving.value = true
    try {
      const created = (await $api.internal.postOperation(
        activeWorkspaceId.value,
        base.value.id,
        { operation: 'rlsPolicyCreate' },
        body,
      )) as RlsPolicyType

      const tableId = created?.fk_model_id ?? body.fk_model_id
      if (tableId && created?.id) {
        const list = policies.value.get(tableId) ?? []
        if (!list.some((p) => p.id === created.id)) list.push(created)
        setPoliciesFor(tableId, list)
      }

      return created
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
    if (!activeWorkspaceId.value || !base.value?.id) return null

    if (!silent) isSaving.value = true
    try {
      const updated = (await $api.internal.postOperation(
        activeWorkspaceId.value,
        base.value.id,
        { operation: 'rlsPolicyUpdate' },
        body,
      )) as RlsPolicyType

      const tableId = updated?.fk_model_id
      if (tableId) {
        const list = policies.value.get(tableId) ?? []
        const idx = list.findIndex((p) => p.id === updated.id)
        if (idx !== -1) {
          list[idx] = updated
          setPoliciesFor(tableId, list)
        }
      }

      return updated
    } finally {
      if (!silent) isSaving.value = false
    }
  }

  const deletePolicy = async (policyId: string) => {
    if (!activeWorkspaceId.value || !base.value?.id) return

    // Capture the parent table before the row is gone.
    let tableId: string | undefined
    for (const [t, list] of policies.value) {
      if (list.some((p) => p.id === policyId)) {
        tableId = t
        break
      }
    }

    isSaving.value = true
    try {
      await $api.internal.postOperation(activeWorkspaceId.value, base.value.id, { operation: 'rlsPolicyDelete' }, { policyId })

      if (tableId) {
        const list = policies.value.get(tableId) ?? []
        const filtered = list.filter((p) => p.id !== policyId)
        setPoliciesFor(tableId, filtered)
      }
    } finally {
      isSaving.value = false
    }
  }

  const setSubjects = async (policyId: string, subjects: RlsPolicySubjectType[]) => {
    if (!activeWorkspaceId.value || !base.value?.id) return null

    isSaving.value = true
    try {
      const updated = (await $api.internal.postOperation(
        activeWorkspaceId.value,
        base.value.id,
        { operation: 'rlsPolicySetSubjects' },
        { policyId, subjects },
      )) as RlsPolicyType

      const tableId = updated?.fk_model_id
      if (tableId) {
        const list = policies.value.get(tableId) ?? []
        const idx = list.findIndex((p) => p.id === updated.id)
        if (idx !== -1) {
          list[idx] = updated
          setPoliciesFor(tableId, list)
        }
      }

      return updated
    } finally {
      isSaving.value = false
    }
  }

  const togglePolicy = async (policy: RlsPolicyType) => {
    if (!policy.id || !policy.fk_model_id) return

    // Optimistic flip
    const list = policies.value.get(policy.fk_model_id) ?? []
    const idx = list.findIndex((p) => p.id === policy.id)
    if (idx !== -1) {
      list[idx] = { ...list[idx], enabled: !policy.enabled }
      setPoliciesFor(policy.fk_model_id, list)
    }

    try {
      await updatePolicy({ id: policy.id, enabled: !policy.enabled }, { silent: true })
    } catch {
      // Revert
      if (idx !== -1) {
        const reverted = policies.value.get(policy.fk_model_id) ?? []
        const ridx = reverted.findIndex((p) => p.id === policy.id)
        if (ridx !== -1) {
          reverted[ridx] = { ...reverted[ridx], enabled: policy.enabled }
          setPoliciesFor(policy.fk_model_id, reverted)
        }
      }
    }
  }

  return {
    // State
    policies,
    isLoading,
    isSaving,

    // Getters
    activePolicies,

    // Actions
    loadPolicies,
    createPolicy,
    updatePolicy,
    deletePolicy,
    setSubjects,
    togglePolicy,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useRlsStore, import.meta.hot))
}
