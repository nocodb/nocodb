// CE stub — no-op for Row-Level Security
// EE override at ee/composables/useRlsPolicies.ts provides full implementation

import type { BaseType, RlsDefaultBehavior, RlsPolicySubjectType, RlsPolicyType } from 'nocodb-sdk'

export const useRlsPolicies = (_base: Ref<BaseType | null>, _tableId: Ref<string>) => {
  const policies = ref<RlsPolicyType[]>([])
  const isLoading = ref(false)
  const isSaving = ref(false)

  const loadPolicies = async () => {}
  const createPolicy = async (_body: {
    fk_model_id: string
    title?: string
    is_default?: boolean
    default_behavior?: RlsDefaultBehavior
    subjects?: RlsPolicySubjectType[]
  }) => null
  const updatePolicy = async (_body: {
    id: string
    title?: string
    enabled?: boolean
    default_behavior?: RlsDefaultBehavior
    order?: number
  }) => null
  const deletePolicy = async (_policyId: string) => {}
  const setSubjects = async (_policyId: string, _subjects: RlsPolicySubjectType[]) => null
  const togglePolicy = async (_policy: RlsPolicyType) => {}

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
