<script lang="ts" setup>
import type { BaseType, RlsPolicyType } from 'nocodb-sdk'

const props = defineProps<{
  tableId: string
  base: BaseType
  tableName?: string
}>()

const { $e } = useNuxtApp()
const { t } = useI18n()

const base = computed(() => props.base)
const tableId = computed(() => props.tableId)

const { showUpgradeToUseRls } = useEeConfig()

const { policies, isLoading, isSaving, loadPolicies, createPolicy, deletePolicy, togglePolicy } = useRlsPolicies(
  base as Ref<BaseType>,
  tableId,
)

const basesStore = useBases()
const { basesUser, basesTeams } = storeToRefs(basesStore)

const baseUsers = computed(() => basesUser.value.get(props.base?.id || '') || [])
const baseTeams = computed(() => basesTeams.value.get(props.base?.id || '') || [])

const editingPolicyId = ref<string | null>(null)
const showEditor = ref(false)

onMounted(async () => {
  loadPolicies()
  if (props.base?.id) {
    await basesStore.getBaseUsers({ baseId: props.base.id })
  }
})

const handleCreatePolicy = async () => {
  if (showUpgradeToUseRls()) return

  try {
    const result = await createPolicy({
      fk_model_id: props.tableId,
      title: 'New Policy',
    })
    if (result) {
      editingPolicyId.value = (result as any).id
      showEditor.value = true
    }
    $e('a:rls:policy-create')
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const handleCreateDefaultPolicy = async () => {
  if (showUpgradeToUseRls()) return

  try {
    await createPolicy({
      fk_model_id: props.tableId,
      title: 'Default Policy',
      is_default: true,
      default_behavior: 'show_all',
    })
    $e('a:rls:default-policy-create')
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const handleDeletePolicy = async (policyId: string) => {
  try {
    await deletePolicy(policyId)
    if (editingPolicyId.value === policyId) {
      editingPolicyId.value = null
      showEditor.value = false
    }
    $e('a:rls:policy-delete')
  } catch (e: any) {
    message.error(t('msg.error.rlsPolicyDeleteFailed'))
  }
}

const handleTogglePolicy = async (policy: RlsPolicyType) => {
  try {
    await togglePolicy(policy)
    $e('a:rls:policy-toggle')
  } catch (e: any) {
    message.error(t('msg.error.rlsPolicyUpdateFailed'))
  }
}

const handleEditPolicy = (policy: RlsPolicyType) => {
  editingPolicyId.value = policy.id ?? null
  showEditor.value = true
}

const handleEditorClose = () => {
  editingPolicyId.value = null
  showEditor.value = false
  loadPolicies()
}

const editingPolicy = computed(() =>
  editingPolicyId.value ? policies.value.find((p) => p.id === editingPolicyId.value) : undefined,
)
const defaultPolicy = computed(() => policies.value.find((p) => p.is_default))
const scopedPolicies = computed(() => policies.value.filter((p) => !p.is_default))

const roleLabels: Record<string, string> = {
  viewer: 'Viewer',
  commenter: 'Commenter',
  editor: 'Editor',
  creator: 'Creator',
}

const getSubjectLabel = (policy: RlsPolicyType) => {
  if (!policy.subjects?.length) return 'No subjects'

  const roles = policy.subjects.filter((s) => s.type === 'role').map((s) => roleLabels[s.id] || s.id)
  const users = policy.subjects
    .filter((s) => s.type === 'user')
    .map((s) => {
      const user = baseUsers.value.find((u: any) => u.id === s.id)
      return (user as any)?.display_name || (user as any)?.email || s.id
    })
  const teams = policy.subjects
    .filter((s) => s.type === 'team')
    .map((s) => {
      const team = baseTeams.value.find((t: any) => t.team_id === s.id)
      return (team as any)?.team_title || s.id
    })

  const parts: string[] = []
  if (roles.length) parts.push(`Roles: ${roles.join(', ')}`)
  if (users.length) parts.push(`Users: ${users.join(', ')}`)
  if (teams.length) parts.push(`Teams: ${teams.join(', ')}`)
  return parts.join(' · ')
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-nc-border-gray-medium">
      <div class="flex items-center gap-2 text-nc-content-gray-emphasis">
        <GeneralIcon icon="ncShield" class="w-5 h-5 flex-none" />
        <div class="text-subHeading2">Row-Level Security</div>
        <div
          v-if="tableName"
          class="flex items-center bg-nc-bg-gray-medium px-1 gap-1 rounded-md text-caption text-nc-content-gray-subtle"
        >
          <div>{{ tableName }}</div>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <NcButton v-if="!defaultPolicy" type="text" size="xs" class="!text-nc-content-brand" @click="handleCreateDefaultPolicy">
          <div class="flex items-center gap-1">
            <GeneralIcon icon="plus" />
            Add default policy
          </div>
        </NcButton>
        <NcButton type="primary" size="small" :loading="isSaving" @click="handleCreatePolicy">
          <div class="flex items-center gap-1">
            <GeneralIcon icon="plus" />
            Add Policy
          </div>
        </NcButton>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="flex-1 flex items-center justify-center p-8">
      <a-spin />
    </div>

    <!-- Empty state -->
    <div v-else-if="!policies.length" class="flex-1 flex flex-col items-center justify-center gap-3 p-8">
      <GeneralIcon icon="ncShield" class="w-12 h-12 text-nc-content-gray-muted" />
      <div class="text-nc-content-gray-subtle text-center">
        <p class="text-sm font-semibold">No RLS policies configured</p>
        <p class="text-xs mt-1">Row-Level Security controls which rows users can see and modify.</p>
      </div>
      <div class="flex gap-2 mt-2">
        <NcButton type="primary" size="small" @click="handleCreatePolicy">Add Scoped Policy</NcButton>
        <NcButton v-if="!defaultPolicy" type="secondary" size="small" @click="handleCreateDefaultPolicy">
          Add Default Policy
        </NcButton>
      </div>
    </div>

    <!-- Policy list -->
    <div v-else class="flex-1 overflow-auto">
      <!-- Default Policy -->
      <div v-if="defaultPolicy" class="px-4 py-3 border-b border-nc-border-gray-medium bg-nc-bg-gray-light">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <a-switch :checked="defaultPolicy.enabled" size="small" @update:checked="handleTogglePolicy(defaultPolicy)" />
            <div class="text-sm font-medium">Default Policy</div>
            <div class="text-xs text-nc-content-gray-subtle px-2 py-0.5 bg-nc-bg-gray-medium rounded">
              {{
                defaultPolicy.default_behavior === 'show_all'
                  ? 'Show All'
                  : defaultPolicy.default_behavior === 'deny_all'
                  ? 'Deny All'
                  : 'Condition'
              }}
            </div>
          </div>
          <div class="flex items-center gap-1">
            <NcButton type="text" size="xs" @click="handleEditPolicy(defaultPolicy)">
              <GeneralIcon icon="edit" class="w-4 h-4" />
            </NcButton>
            <NcButton type="text" size="xs" class="!text-nc-content-red-dark" @click="handleDeletePolicy(defaultPolicy.id!)">
              <GeneralIcon icon="delete" class="w-4 h-4" />
            </NcButton>
          </div>
        </div>
        <div class="text-xs text-nc-content-gray-subtle mt-1">Applied when no scoped policy matches the user.</div>
      </div>

      <!-- Scoped Policies -->
      <div class="px-4 py-2">
        <div class="text-xs font-semibold text-nc-content-gray-subtle uppercase mb-2">Scoped Policies</div>
        <div v-if="!scopedPolicies.length" class="text-xs text-nc-content-gray-muted py-2">
          No scoped policies. Add a policy to restrict row access for specific roles, teams, or users.
        </div>
        <div
          v-for="policy in scopedPolicies"
          :key="policy.id"
          class="flex items-center justify-between py-2 border-b border-nc-border-gray-light last:border-0"
        >
          <div class="flex items-center gap-2 flex-1 min-w-0">
            <a-switch :checked="policy.enabled" size="small" @update:checked="handleTogglePolicy(policy)" />
            <div class="flex flex-col min-w-0">
              <div class="text-sm font-medium truncate">{{ policy.title }}</div>
              <div class="text-xs text-nc-content-gray-subtle truncate">
                {{ getSubjectLabel(policy) }}
              </div>
            </div>
          </div>
          <div class="flex items-center gap-1 flex-none">
            <div v-if="policy.filters?.length" class="text-xs text-nc-content-gray-subtle mr-2">
              {{ policy.filters.length }} filter{{ policy.filters.length > 1 ? 's' : '' }}
            </div>
            <NcButton type="text" size="xs" @click="handleEditPolicy(policy)">
              <GeneralIcon icon="edit" class="w-4 h-4" />
            </NcButton>
            <NcButton type="text" size="xs" class="!text-nc-content-red-dark" @click="handleDeletePolicy(policy.id!)">
              <GeneralIcon icon="delete" class="w-4 h-4" />
            </NcButton>
          </div>
        </div>
      </div>
    </div>

    <!-- Editor overlay -->
    <RlsPolicyEditor
      v-if="showEditor && editingPolicy"
      :policy="editingPolicy"
      :table-id="tableId"
      :base="base"
      @close="handleEditorClose"
    />
  </div>
</template>
