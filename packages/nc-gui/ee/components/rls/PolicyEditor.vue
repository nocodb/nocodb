<script lang="ts" setup>
import type { BaseType, RlsDefaultBehavior, RlsPolicySubjectType, RlsPolicyType } from 'nocodb-sdk'

const props = defineProps<{
  policy: RlsPolicyType
  tableId: string
  base: BaseType
}>()

const emit = defineEmits<{
  close: []
}>()

const base = computed(() => props.base)
const tableId = computed(() => props.tableId)

const { updatePolicy, setSubjects, isSaving } = useRlsPolicies(base as Ref<BaseType>, tableId)

const { getMeta } = useMetas()

const basesStore = useBases()
const { basesUser, basesTeams } = storeToRefs(basesStore)

const { isTeamsEnabled } = storeToRefs(useWorkspace())

const policy = computed(() => props.policy)

// Local form state
const policyTitle = ref(props.policy.title || '')
const policyEnabled = ref(props.policy.enabled ?? true)
const defaultBehavior = ref<RlsDefaultBehavior>(props.policy.default_behavior || 'show_all')
const subjects = ref<RlsPolicySubjectType[]>([...(props.policy.subjects || [])])

// Provide MetaInj for the ColumnFilter component
const tableMeta = ref()

provide(MetaInj, tableMeta)
provide(ActiveViewInj, ref())
provide(IsPublicInj, ref(false))
provide(IsLockedInj, ref(false))
provide(AllFiltersInj, ref({}))
provide(ReloadViewDataHookInj, createEventHook())

// Subject selector state
const newSubjectType = ref<'role' | 'user' | 'team'>('role')
const newSubjectId = ref('')
const subjectSearchText = ref('')

// Filter ref for add filter button
const filterRef = ref()

// Load table meta — ColumnFilter loads its own filters on mount via rlsPolicyId prop
onMounted(async () => {
  if (props.base?.id && props.tableId) {
    try {
      const meta = await getMeta(props.base.id, props.tableId)
      if (meta) {
        // Enrich meta with workspace ID for useViewFilters API calls
        ;(meta as any).fk_workspace_id = props.base.fk_workspace_id
      }
      tableMeta.value = meta
    } catch (e) {
      console.error('Failed to load table columns:', e)
    }

    // Load base users and teams for subject selectors
    await basesStore.getBaseUsers({ baseId: props.base.id })
    if (isTeamsEnabled.value) {
      await basesStore.getBaseTeams({ baseId: props.base.id })
    }
  }
})

const baseUsers = computed(() => basesUser.value.get(props.base?.id || '') || [])
const baseTeams = computed(() => basesTeams.value.get(props.base?.id || '') || [])

const filteredUsers = computed(() => {
  const search = subjectSearchText.value.toLowerCase()
  if (!search) return baseUsers.value
  return baseUsers.value.filter(
    (u: any) => u.email?.toLowerCase().includes(search) || u.display_name?.toLowerCase().includes(search),
  )
})

const filteredTeams = computed(() => {
  const search = subjectSearchText.value.toLowerCase()
  if (!search) return baseTeams.value
  return baseTeams.value.filter((t: any) => t.team_title?.toLowerCase().includes(search))
})

const roleOptions = [
  { label: 'Viewer', value: 'viewer' },
  { label: 'Commenter', value: 'commenter' },
  { label: 'Editor', value: 'editor' },
  { label: 'Creator', value: 'creator' },
]

const defaultBehaviorOptions = [
  { label: 'Show All Rows', value: 'show_all', description: 'All rows are visible when no scoped policy matches.' },
  { label: 'Deny All Rows', value: 'deny_all', description: 'No rows are visible when no scoped policy matches.' },
  { label: 'Apply Condition', value: 'condition', description: 'Apply filter conditions as the fallback.' },
]

const handleSave = async () => {
  if (!policy.value?.id) return

  try {
    // Save filter changes first
    if (filterRef.value) {
      await filterRef.value.applyChanges(policy.value.id)
    }

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
    emit('close')
  } catch (e: any) {
    message.error(e.message || 'Failed to save policy')
  }
}

const handleAddSubject = (type: 'role' | 'user' | 'team', id: string) => {
  if (!id.trim()) return

  const exists = subjects.value.some((s) => s.type === type && s.id === id)
  if (exists) {
    message.warning('Subject already added')
    return
  }

  subjects.value.push({ type, id: id.trim() })
  newSubjectId.value = ''
  subjectSearchText.value = ''
}

const handleAddSubjectFromSelector = () => {
  if (!newSubjectId.value.trim()) return
  handleAddSubject(newSubjectType.value, newSubjectId.value)
}

const handleRemoveSubject = (index: number) => {
  subjects.value.splice(index, 1)
}

const getSubjectDisplayLabel = (subject: RlsPolicySubjectType) => {
  if (subject.type === 'role') {
    return roleOptions.find((r) => r.value === subject.id)?.label || subject.id
  }
  if (subject.type === 'user') {
    const user = baseUsers.value.find((u: any) => u.id === subject.id)
    return (user as any)?.display_name || (user as any)?.email || subject.id
  }
  if (subject.type === 'team') {
    const team = baseTeams.value.find((t: any) => t.team_id === subject.id)
    return (team as any)?.team_title || subject.id
  }
  return subject.id
}

const subjectTypeColors: Record<string, string> = {
  role: 'bg-nc-bg-blue-light text-nc-content-blue-dark border-nc-border-blue',
  user: 'bg-nc-bg-green-light text-nc-content-green-dark border-nc-border-green',
  team: 'bg-nc-bg-purple-light text-nc-content-purple-dark border-nc-border-purple',
}

const showFilterSection = computed(() => {
  if (!policy.value?.is_default) return true
  return defaultBehavior.value === 'condition'
})
</script>

<template>
  <div class="absolute inset-0 bg-nc-bg-default z-10 flex flex-col">
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
    <div class="flex-1 overflow-auto p-4 flex flex-col gap-5">
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
      <div v-if="policy?.is_default" class="flex flex-col gap-2">
        <label class="text-xs font-semibold text-nc-content-gray-subtle">Default Behavior</label>
        <p class="text-xs text-nc-content-gray-muted">Applied when no scoped policy matches the current user.</p>
        <a-radio-group v-model:value="defaultBehavior" class="flex flex-col gap-1 mt-1">
          <a-radio v-for="opt in defaultBehaviorOptions" :key="opt.value" :value="opt.value" class="!flex items-start gap-1">
            <div class="flex flex-col">
              <span class="text-sm">{{ opt.label }}</span>
              <span class="text-[11px] text-nc-content-gray-muted">{{ opt.description }}</span>
            </div>
          </a-radio>
        </a-radio-group>
      </div>

      <!-- Subjects (for scoped policies) -->
      <div v-if="!policy?.is_default" class="flex flex-col gap-2">
        <label class="text-xs font-semibold text-nc-content-gray-subtle">Apply To (Subjects)</label>
        <p class="text-xs text-nc-content-gray-muted">Choose which roles, teams, or users this policy applies to.</p>

        <!-- Add subject controls -->
        <div class="flex items-center gap-2">
          <NcSelect v-model:value="newSubjectType" size="small" class="w-24 flex-none" dropdown-class-name="!rounded-lg">
            <a-select-option value="role">Role</a-select-option>
            <a-select-option value="user">User</a-select-option>
            <a-select-option v-if="isTeamsEnabled" value="team">Team</a-select-option>
          </NcSelect>

          <!-- Role selector -->
          <NcSelect
            v-if="newSubjectType === 'role'"
            v-model:value="newSubjectId"
            size="small"
            class="flex-1"
            placeholder="Select role"
            dropdown-class-name="!rounded-lg"
          >
            <a-select-option
              v-for="role in roleOptions"
              :key="role.value"
              :value="role.value"
              :disabled="subjects.some((s) => s.type === 'role' && s.id === role.value)"
            >
              <span class="text-xs">{{ role.label }}</span>
            </a-select-option>
          </NcSelect>

          <!-- User selector -->
          <NcSelect
            v-else-if="newSubjectType === 'user'"
            v-model:value="newSubjectId"
            size="small"
            class="flex-1"
            placeholder="Search users..."
            show-search
            :filter-option="false"
            dropdown-class-name="!rounded-lg"
            @search="(val: string) => (subjectSearchText = val)"
          >
            <a-select-option
              v-for="user in filteredUsers"
              :key="(user as any).id"
              :value="(user as any).id"
              :disabled="subjects.some((s) => s.type === 'user' && s.id === (user as any).id)"
            >
              <div class="flex items-center gap-2 text-xs">
                <GeneralIcon icon="ncUser" class="w-3 h-3 flex-none text-nc-content-gray-muted" />
                <span class="truncate">{{ (user as any).display_name || (user as any).email }}</span>
                <span v-if="(user as any).display_name" class="text-nc-content-gray-muted truncate">{{
                  (user as any).email
                }}</span>
              </div>
            </a-select-option>
          </NcSelect>

          <!-- Team selector -->
          <NcSelect
            v-else-if="newSubjectType === 'team'"
            v-model:value="newSubjectId"
            size="small"
            class="flex-1"
            placeholder="Search teams..."
            show-search
            :filter-option="false"
            dropdown-class-name="!rounded-lg"
            @search="(val: string) => (subjectSearchText = val)"
          >
            <a-select-option
              v-for="team in filteredTeams"
              :key="(team as any).team_id"
              :value="(team as any).team_id"
              :disabled="subjects.some((s) => s.type === 'team' && s.id === (team as any).team_id)"
            >
              <div class="flex items-center gap-2 text-xs">
                <GeneralIcon icon="ncUsers" class="w-3 h-3 flex-none text-nc-content-gray-muted" />
                <span class="truncate">{{ (team as any).team_title }}</span>
              </div>
            </a-select-option>
          </NcSelect>

          <NcButton type="secondary" size="xs" :disabled="!newSubjectId" @click="handleAddSubjectFromSelector">
            <GeneralIcon icon="plus" class="w-4 h-4" />
          </NcButton>
        </div>

        <!-- Existing subjects as chips -->
        <div v-if="subjects.length" class="flex flex-wrap gap-1.5 mt-1">
          <div
            v-for="(subject, idx) in subjects"
            :key="`${subject.type}-${subject.id}`"
            class="flex items-center gap-1.5 pl-2 pr-1 py-0.5 rounded-full border text-xs"
            :class="subjectTypeColors[subject.type]"
          >
            <span class="capitalize font-medium text-[10px]">{{ subject.type }}:</span>
            <span>{{ getSubjectDisplayLabel(subject) }}</span>
            <NcButton type="text" size="xs" class="!h-4 !w-4 !min-w-0" @click="handleRemoveSubject(idx)">
              <GeneralIcon icon="close" class="w-2.5 h-2.5" />
            </NcButton>
          </div>
        </div>
      </div>

      <!-- Divider -->
      <div class="border-t border-nc-border-gray-medium" />

      <!-- Filter Conditions -->
      <div v-if="showFilterSection && policy?.id" class="flex flex-col gap-2">
        <div class="w-full flex items-center justify-between">
          <label class="text-xs font-semibold text-nc-content-gray-subtle">Filter Conditions</label>
          <NcButton size="xs" type="secondary" @click.stop="filterRef?.addFilter()">
            <div class="flex items-center gap-1">
              <component :is="iconMap.plus" />
              {{ $t('activity.addFilter') }}
            </div>
          </NcButton>
        </div>

        <LazySmartsheetToolbarColumnFilter
          v-if="tableMeta"
          ref="filterRef"
          :hidden-add-new-filter="true"
          class="w-full !py-0"
          :auto-save="false"
          :show-loading="false"
          :rls-policy-id="policy.id"
          :web-hook="true"
          :show-dynamic-condition="false"
          action-btn-type="secondary"
        />
      </div>
    </div>
  </div>
</template>
