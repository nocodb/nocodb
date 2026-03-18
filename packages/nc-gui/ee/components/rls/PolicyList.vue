<script lang="ts" setup>
import type { BaseType, RlsPolicyType } from 'nocodb-sdk'

const props = defineProps<{
  tableId: string
  base: BaseType
  tableName?: string
}>()

const { $e } = useNuxtApp()
const { t } = useI18n()
const { showInfoModal } = useNcConfirmModal()

const base = computed(() => props.base)
const tableId = computed(() => props.tableId)

const { showUpgradeToUseRls } = useEeConfig()

const { policies, isLoading, loadPolicies, createPolicy, deletePolicy, togglePolicy } = useRlsPolicies(
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
      title: t('objects.permissions.rlsPolicy.newPolicy'),
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
      title: t('objects.permissions.rlsPolicy.defaultPolicy'),
      is_default: true,
      default_behavior: 'show_all',
    })
    $e('a:rls:default-policy-create')
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const performDeletePolicy = async (policyId: string) => {
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

const handleDeletePolicy = (policyId: string) => {
  showInfoModal({
    title: t('objects.permissions.rlsPolicy.confirmDeleteTitle'),
    content: t('objects.permissions.rlsPolicy.confirmDeleteContent'),
    showCancelBtn: true,
    showIcon: false,
    okProps: {
      type: 'danger',
    },
    okText: t('general.delete'),
    okCallback: () => performDeletePolicy(policyId),
  })
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

const getSubjectLabel = (policy: RlsPolicyType) => {
  if (!policy.subjects?.length) return t('objects.permissions.rlsPolicy.noSubjects')

  const roles = policy.subjects.filter((s) => s.type === 'role').map((s) => t(`objects.roleType.${s.id}`, s.id))
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
  if (roles.length) parts.push(`${t('objects.roles')}: ${roles.join(', ')}`)
  if (users.length) parts.push(`${t('objects.users')}: ${users.join(', ')}`)
  if (teams.length) parts.push(`${t('objects.permissions.rlsPolicy.groupTeams')}: ${teams.join(', ')}`)
  return parts.join(' · ')
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-nc-border-gray-medium">
      <div class="flex items-center gap-2 text-nc-content-gray-emphasis">
        <GeneralIcon icon="ncShield" class="w-5 h-5 flex-none" />
        <div class="text-subHeading2">{{ $t('objects.permissions.rlsPolicy.rowLevelSecurity') }}</div>
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
            {{ $t('objects.permissions.rlsPolicy.addDefaultPolicy') }}
          </div>
        </NcButton>
        <NcButton type="primary" size="small" @click="handleCreatePolicy">
          <div class="flex items-center gap-1">
            <GeneralIcon icon="plus" />
            {{ $t('objects.permissions.rlsPolicy.addPolicy') }}
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
        <p class="text-sm font-semibold">{{ $t('objects.permissions.rlsPolicy.noPoliciesConfigured') }}</p>
        <p class="text-xs mt-1">{{ $t('objects.permissions.rlsPolicy.noPoliciesDescription') }}</p>
      </div>
      <div class="flex flex-col items-center gap-2 mt-2">
        <NcButton type="primary" size="small" @click="handleCreatePolicy">
          <div class="flex items-center gap-1">
            <GeneralIcon icon="plus" />
            {{ $t('objects.permissions.rlsPolicy.addPolicy') }}
          </div>
        </NcButton>
        <NcButton v-if="!defaultPolicy" type="text" size="xs" class="!text-nc-content-brand" @click="handleCreateDefaultPolicy">
          <div class="flex items-center gap-1">
            <GeneralIcon icon="plus" />
            {{ $t('objects.permissions.rlsPolicy.addDefaultPolicy') }}
          </div>
        </NcButton>
      </div>
    </div>

    <!-- Policy list -->
    <div v-else class="flex-1 overflow-auto">
      <!-- Default Policy -->
      <div v-if="defaultPolicy" class="px-4 py-3 border-b border-nc-border-gray-medium bg-nc-bg-gray-extralight">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <NcSwitch :checked="!!defaultPolicy.enabled" size="small" @update:checked="handleTogglePolicy(defaultPolicy)" />
            <div class="text-sm font-medium">{{ $t('objects.permissions.rlsPolicy.defaultPolicy') }}</div>
            <div class="text-xs text-nc-content-gray-subtle px-2 py-0.5 bg-nc-bg-gray-medium rounded">
              {{
                defaultPolicy.default_behavior === 'show_all'
                  ? $t('objects.permissions.rlsPolicy.showAll')
                  : defaultPolicy.default_behavior === 'deny_all'
                  ? $t('objects.permissions.rlsPolicy.denyAll')
                  : $t('general.condition')
              }}
            </div>
          </div>
          <div class="flex items-center gap-1">
            <NcButton type="text" size="xs" class="!px-0" icon-only @click="handleEditPolicy(defaultPolicy)">
              <template #icon>
                <GeneralIcon icon="edit" class="w-4 h-4" />
              </template>
            </NcButton>
            <NcButton
              type="text"
              size="xs"
              class="!text-nc-content-red-dark !px-0"
              icon-only
              @click="handleDeletePolicy(defaultPolicy.id!)"
            >
              <template #icon>
                <GeneralIcon icon="delete" class="w-4 h-4" />
              </template>
            </NcButton>
          </div>
        </div>
        <div class="text-xs text-nc-content-gray-subtle mt-1">{{ $t('objects.permissions.rlsPolicy.appliedWhenNoMatch') }}</div>
      </div>

      <!-- Scoped Policies -->
      <div class="px-4 py-2">
        <div class="text-xs font-semibold text-nc-content-gray-subtle uppercase mb-2">
          {{ $t('objects.permissions.rlsPolicy.scopedPolicies') }}
        </div>
        <div v-if="!scopedPolicies.length" class="text-xs text-nc-content-gray-muted py-2">
          {{ $t('objects.permissions.rlsPolicy.noScopedPolicies') }}
        </div>
        <div
          v-for="policy in scopedPolicies"
          :key="policy.id"
          class="flex items-center justify-between py-2 border-b border-nc-border-gray-light last:border-0"
        >
          <div class="flex items-center gap-2 flex-1 min-w-0">
            <NcSwitch :checked="!!policy.enabled" size="small" @update:checked="handleTogglePolicy(policy)" />
            <div class="flex flex-col min-w-0">
              <div class="text-sm font-medium truncate">{{ policy.title }}</div>
              <div class="text-xs text-nc-content-gray-subtle truncate">
                {{ getSubjectLabel(policy) }}
              </div>
            </div>
          </div>
          <div class="flex items-center gap-1 flex-none">
            <div v-if="policy.filters?.length" class="text-xs text-nc-content-gray-subtle mr-2">
              {{ $t('objects.permissions.rlsPolicy.filterCount', { count: policy.filters.length }, policy.filters.length) }}
            </div>
            <NcButton type="text" size="xs" class="!px-0" icon-only @click="handleEditPolicy(policy)">
              <template #icon>
                <GeneralIcon icon="edit" class="w-4 h-4" />
              </template>
            </NcButton>
            <NcButton
              type="text"
              size="xs"
              class="!text-nc-content-red-dark !px-0"
              icon-only
              @click="handleDeletePolicy(policy.id!)"
            >
              <template #icon>
                <GeneralIcon icon="delete" class="w-4 h-4" />
              </template>
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
