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

const { t } = useI18n()

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
const isSubjectDropdownOpen = ref(false)

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
      // silently handle — columns will remain empty
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

    message.success(t('msg.success.rlsPolicySaved'))
    emit('close')
  } catch (e: any) {
    message.error(t('msg.error.rlsPolicyUpdateFailed'))
  }
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

const subjectTypeIcons: Record<string, string> = {
  role: 'ncRole',
  user: 'ncUser',
  team: 'ncUsers',
}

const subjectGroupOrder = computed(() => {
  const groups = ['Roles', 'Members']
  if (isTeamsEnabled.value) groups.push('Teams')
  return groups
})

// Build a unified list of all selectable subjects for NcList
const subjectListOptions = computed<NcListItemType[]>(() => {
  const options: NcListItemType[] = []

  // Roles
  for (const role of roleOptions) {
    options.push({
      value: `role:${role.value}`,
      label: role.label,
      subjectType: 'role',
      subjectId: role.value,
      roleValue: role.value,
      ncGroupHeaderLabel: 'Roles',
    })
  }

  // Users
  for (const user of baseUsers.value) {
    options.push({
      ...(user as any),
      value: `user:${(user as any).id}`,
      label: (user as any).display_name || (user as any).email,
      email: (user as any).email,
      display_name: (user as any).display_name,
      subjectType: 'user',
      subjectId: (user as any).id,
      ncGroupHeaderLabel: 'Members',
    })
  }

  // Teams
  if (isTeamsEnabled.value) {
    for (const team of baseTeams.value) {
      options.push({
        ...(team as any),
        value: `team:${(team as any).team_id}`,
        label: (team as any).team_title,
        title: (team as any).team_title,
        subjectType: 'team',
        subjectId: (team as any).team_id,
        description: `${(team as any).members_count || 0} members`,
        ncGroupHeaderLabel: 'Teams',
      })
    }
  }

  return options
})

// Derive selected IDs in the `type:id` format for NcList binding
const selectedSubjectIds = computed(() => {
  return subjects.value.map((s) => `${s.type}:${s.id}`)
})

const filterSubjectOption = (input: string, option: NcListItemType) => {
  const search = input.toLowerCase()
  if (option.label?.toLowerCase().includes(search)) return true
  if (option.email?.toLowerCase().includes(search)) return true
  if (option.display_name?.toLowerCase().includes(search)) return true
  return false
}

const handleSubjectToggle = (option: NcListItemType) => {
  const type = option.subjectType as 'role' | 'user' | 'team'
  const id = option.subjectId as string

  const existingIdx = subjects.value.findIndex((s) => s.type === type && s.id === id)
  if (existingIdx >= 0) {
    subjects.value.splice(existingIdx, 1)
  } else {
    subjects.value.push({ type, id })
  }
}

const toggleTeamHierarchyScope = (index: number) => {
  const subject = subjects.value[index]
  if (subject?.type !== 'team') return

  const current = subject.hierarchy_scope || 'self_and_descendants'
  subjects.value[index] = {
    ...subject,
    hierarchy_scope: current === 'self_and_descendants' ? 'self_only' : 'self_and_descendants',
  }
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
        <a-input v-model:value="policyTitle" placeholder="Enter policy name" class="nc-input-sm nc-input-shadow" />
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

        <NcListDropdown v-model:isOpen="isSubjectDropdownOpen" default-slot-wrapper-class="w-full !min-h-8 !h-auto">
          <!-- Trigger: show selected subjects as colored chips -->
          <div class="w-[calc(100%_-_24px)] flex items-center gap-1.5 flex-wrap">
            <template v-if="subjects.length">
              <div
                v-for="(subject, idx) in subjects"
                :key="`${subject.type}-${subject.id}`"
                class="flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-lg border text-xs"
                :class="subjectTypeColors[subject.type]"
              >
                <GeneralIcon :icon="(subjectTypeIcons[subject.type] as any)" class="w-3 h-3 flex-none" />
                <span class="truncate max-w-32">{{ getSubjectDisplayLabel(subject) }}</span>
                <NcTooltip v-if="subject.type === 'team'">
                  <template #title>
                    {{
                      subject.hierarchy_scope === 'self_only'
                        ? 'This team only — click to include sub-teams'
                        : 'Includes sub-teams — click to match this team only'
                    }}
                  </template>
                  <NcButton
                    type="text"
                    size="xs"
                    class="!h-4 !w-4 !min-w-0"
                    @click.stop="toggleTeamHierarchyScope(idx)"
                  >
                    <GeneralIcon
                      :icon="subject.hierarchy_scope === 'self_only' ? 'ncUser' : 'ncUsers'"
                      class="w-2.5 h-2.5"
                    />
                  </NcButton>
                </NcTooltip>
                <NcButton
                  type="text"
                  size="xs"
                  class="!h-4 !w-4 !min-w-0"
                  @click.stop="handleRemoveSubject(idx)"
                >
                  <GeneralIcon icon="close" class="w-2.5 h-2.5" />
                </NcButton>
              </div>
            </template>
            <span v-else class="text-nc-content-gray-muted text-sm"> Select roles, users, or teams... </span>
          </div>
          <GeneralIcon
            icon="chevronDown"
            class="flex-none h-4 w-4 text-nc-content-gray-muted transition-transform"
            :class="{ 'transform rotate-180': isSubjectDropdownOpen }"
          />

          <!-- Dropdown overlay -->
          <template #overlay="{ onEsc }">
            <NcList
              v-model:open="isSubjectDropdownOpen"
              class="!w-full"
              :value="selectedSubjectIds"
              :list="subjectListOptions"
              :group-order="subjectGroupOrder"
              option-value-key="value"
              option-label-key="label"
              :item-height="44"
              is-multi-select
              :close-on-select="false"
              search-input-placeholder="Search roles, users, or teams..."
              :filter-option="filterSubjectOption"
              :show-selected-option="false"
              empty-description="No matches found"
              wrapper-class-name="!h-auto max-h-64"
              @change="handleSubjectToggle($event)"
              @escape="onEsc"
            >
              <template #listItemExtraLeft="{ isSelected }">
                <NcCheckbox :checked="isSelected" />
              </template>

              <template #listItemContent="{ option }">
                <!-- Role item -->
                <div v-if="option.subjectType === 'role'" class="flex items-center gap-2">
                  <RolesBadge :border="false" :role="option.roleValue" icon-only nc-badge-class="!px-1" />
                  <span class="text-sm">{{ option.label }}</span>
                </div>
                <!-- User item -->
                <NcUserInfo v-else-if="option.subjectType === 'user'" :user="option" class="w-full max-w-[calc(100%_-_24px)]" />
                <!-- Team item -->
                <GeneralTeamInfo v-else-if="option.subjectType === 'team'" :team="option" class="max-w-[calc(100%_-_24px)]" />
              </template>

              <template #listItemExtraRight="{ option }">
                <RolesBadge
                  v-if="option.subjectType === 'user' && option.roles"
                  :border="false"
                  :role="option.roles"
                  icon-only
                  nc-badge-class="!px-1"
                  show-tooltip
                />
              </template>

              <template #listItemSelectedIcon> </template>
            </NcList>
          </template>
        </NcListDropdown>
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
          :show-dynamic-condition="false"
          action-btn-type="secondary"
        />
      </div>
    </div>
  </div>
</template>
