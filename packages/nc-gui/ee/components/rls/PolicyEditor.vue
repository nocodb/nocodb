<script lang="ts" setup>
import type { RlsPolicyType, RlsPolicySubjectType, RlsDefaultBehavior } from 'nocodb-sdk'
import type { BaseType } from 'nocodb-sdk'

const props = defineProps<{
  policyId: string
  tableId: string
  base: BaseType
}>()

const emit = defineEmits<{
  close: []
}>()

const { $api } = useNuxtApp()
const { t } = useI18n()

const base = computed(() => props.base)
const tableId = computed(() => props.tableId)

const { policies, updatePolicy, setSubjects, deleteFilter, loadPolicies, isSaving } = useRlsPolicies(
  base as Ref<BaseType>,
  tableId,
)

const policy = computed(() => policies.value.find((p) => p.id === props.policyId))

const policyTitle = ref('')
const policyEnabled = ref(true)
const defaultBehavior = ref<RlsDefaultBehavior>('show_all')
const subjects = ref<RlsPolicySubjectType[]>([])

const newSubjectType = ref<'role' | 'user' | 'team'>('role')
const newSubjectId = ref('')

// Initialize from policy data
watch(
  () => policy.value,
  (p) => {
    if (p) {
      policyTitle.value = p.title || ''
      policyEnabled.value = p.enabled ?? true
      defaultBehavior.value = p.default_behavior || 'show_all'
      subjects.value = [...(p.subjects || [])]
    }
  },
  { immediate: true },
)

const handleSave = async () => {
  if (!policy.value?.id) return

  try {
    await updatePolicy({
      id: policy.value.id,
      title: policyTitle.value,
      enabled: policyEnabled.value,
      default_behavior: policy.value.is_default ? defaultBehavior.value : undefined,
    })

    // Update subjects for scoped policies
    if (!policy.value.is_default) {
      await setSubjects(policy.value.id, subjects.value)
    }

    message.success('Policy saved')
  } catch (e: any) {
    message.error(e.message || 'Failed to save policy')
  }
}

const handleAddSubject = () => {
  if (!newSubjectId.value.trim()) return

  const exists = subjects.value.some((s) => s.type === newSubjectType.value && s.id === newSubjectId.value)
  if (exists) {
    message.warning('Subject already added')
    return
  }

  subjects.value.push({
    type: newSubjectType.value,
    id: newSubjectId.value.trim(),
  })
  newSubjectId.value = ''
}

const handleRemoveSubject = (index: number) => {
  subjects.value.splice(index, 1)
}

const roleOptions = [
  { label: 'Viewer', value: 'viewer' },
  { label: 'Editor', value: 'editor' },
  { label: 'Creator', value: 'creator' },
  { label: 'Owner', value: 'owner' },
]

const defaultBehaviorOptions = [
  { label: 'Show All Rows', value: 'show_all' },
  { label: 'Deny All Rows', value: 'deny_all' },
  { label: 'Apply Condition', value: 'condition' },
]
</script>

<template>
  <div class="absolute inset-0 bg-white z-10 flex flex-col">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-nc-border-gray-medium">
      <div class="flex items-center gap-2">
        <NcButton type="text" size="xs" @click="emit('close')">
          <GeneralIcon icon="arrowLeft" class="w-4 h-4" />
        </NcButton>
        <div class="text-subHeading2 text-nc-content-gray-emphasis">
          {{ policy?.is_default ? 'Edit Default Policy' : 'Edit Policy' }}
        </div>
      </div>
      <div class="flex items-center gap-2">
        <NcButton type="secondary" size="small" @click="emit('close')">Cancel</NcButton>
        <NcButton type="primary" size="small" :loading="isSaving" @click="handleSave">Save</NcButton>
      </div>
    </div>

    <!-- Form -->
    <div class="flex-1 overflow-auto p-4 flex flex-col gap-4">
      <!-- Policy Name -->
      <div class="flex flex-col gap-1">
        <label class="text-xs font-semibold text-nc-content-gray-subtle">Policy Name</label>
        <a-input v-model:value="policyTitle" placeholder="Enter policy name" size="small" />
      </div>

      <!-- Enabled -->
      <div class="flex items-center gap-2">
        <a-switch v-model:checked="policyEnabled" size="small" />
        <span class="text-sm">{{ policyEnabled ? 'Enabled' : 'Disabled' }}</span>
      </div>

      <!-- Default Behavior (only for default policy) -->
      <div v-if="policy?.is_default" class="flex flex-col gap-1">
        <label class="text-xs font-semibold text-nc-content-gray-subtle">Default Behavior</label>
        <p class="text-xs text-nc-content-gray-muted">
          Applied when no scoped policy matches the current user.
        </p>
        <a-radio-group v-model:value="defaultBehavior" class="flex flex-col gap-2 mt-1">
          <a-radio
            v-for="opt in defaultBehaviorOptions"
            :key="opt.value"
            :value="opt.value"
            class="text-sm"
          >
            {{ opt.label }}
          </a-radio>
        </a-radio-group>
      </div>

      <!-- Subjects (for scoped policies) -->
      <div v-if="!policy?.is_default" class="flex flex-col gap-2">
        <label class="text-xs font-semibold text-nc-content-gray-subtle">Apply To (Subjects)</label>
        <p class="text-xs text-nc-content-gray-muted">
          Choose which roles, teams, or users this policy applies to.
        </p>

        <!-- Existing subjects -->
        <div v-for="(subject, idx) in subjects" :key="`${subject.type}-${subject.id}`" class="flex items-center gap-2 py-1">
          <div class="text-xs px-2 py-0.5 bg-nc-bg-gray-medium rounded capitalize">{{ subject.type }}</div>
          <div class="text-sm flex-1">{{ subject.id }}</div>
          <NcButton type="text" size="xs" class="!text-nc-content-red-dark" @click="handleRemoveSubject(idx)">
            <GeneralIcon icon="close" class="w-3 h-3" />
          </NcButton>
        </div>

        <!-- Add subject -->
        <div class="flex items-center gap-2 mt-1">
          <a-select v-model:value="newSubjectType" size="small" class="w-24">
            <a-select-option value="role">Role</a-select-option>
            <a-select-option value="user">User</a-select-option>
            <a-select-option value="team">Team</a-select-option>
          </a-select>
          <a-select
            v-if="newSubjectType === 'role'"
            v-model:value="newSubjectId"
            size="small"
            class="flex-1"
            placeholder="Select role"
          >
            <a-select-option v-for="role in roleOptions" :key="role.value" :value="role.value">
              {{ role.label }}
            </a-select-option>
          </a-select>
          <a-input
            v-else
            v-model:value="newSubjectId"
            size="small"
            class="flex-1"
            :placeholder="newSubjectType === 'user' ? 'User ID' : 'Team ID'"
          />
          <NcButton type="secondary" size="xs" @click="handleAddSubject">
            <GeneralIcon icon="plus" class="w-4 h-4" />
          </NcButton>
        </div>
      </div>

      <!-- Filters info -->
      <div class="flex flex-col gap-1">
        <label class="text-xs font-semibold text-nc-content-gray-subtle">Filter Conditions</label>
        <p class="text-xs text-nc-content-gray-muted">
          Define conditions that determine which rows are visible. Filters are managed via the filter API.
        </p>
        <div v-if="policy?.filters?.length" class="mt-1">
          <div class="text-sm text-nc-content-gray-emphasis">
            {{ policy.filters.length }} filter{{ policy.filters.length > 1 ? 's' : '' }} configured
          </div>
        </div>
        <div v-else class="text-xs text-nc-content-gray-muted mt-1 italic">
          No filters configured yet. Use the filter API to add conditions.
        </div>
      </div>

      <!-- Dynamic Values Help -->
      <div class="flex flex-col gap-1 bg-nc-bg-gray-light rounded p-3 mt-2">
        <div class="text-xs font-semibold text-nc-content-gray-subtle">Dynamic Value Placeholders</div>
        <p class="text-xs text-nc-content-gray-muted">
          Use these in filter values to reference the current user's context:
        </p>
        <div class="flex flex-col gap-0.5 mt-1">
          <code class="text-xs bg-nc-bg-gray-medium px-1 rounded">{currentUser.id}</code>
          <code class="text-xs bg-nc-bg-gray-medium px-1 rounded">{currentUser.email}</code>
          <code class="text-xs bg-nc-bg-gray-medium px-1 rounded">{currentUser.roles}</code>
          <code class="text-xs bg-nc-bg-gray-medium px-1 rounded">{currentUser.teams}</code>
        </div>
      </div>
    </div>
  </div>
</template>
