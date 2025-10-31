<script lang="ts" setup>
import type { PermissionKey, WorkspaceUserRoles } from 'nocodb-sdk'
import { PermissionMeta, PermissionRoleMap, PermissionRolePower, ProjectRoles, WorkspaceRolesToProjectRoles } from 'nocodb-sdk'
import type { NcListProps } from '#imports'

interface Props extends Partial<NcListProps> {
  selectedUsers: Set<string>
  baseId: string
  permissionLabel: string
  permissionDescription?: string
  permission?: PermissionKey
  readonly?: boolean
  listClassName?: string
  showListFooter?: boolean
  disabledUsers?: string[]
}

const props = withDefaults(defineProps<Props>(), {})

const emits = defineEmits(['update:selectedUsers', 'update:open', 'escape'])

const selectedUsers = useVModel(props, 'selectedUsers', emits)

const vOpen = useVModel(props, 'open', emits)

const { t } = useI18n()

const {
  open: _open,
  selectedUsers: _selectedUsers,
  baseId,
  permissionLabel: _permissionLabel,
  permissionDescription: _permissionDescription,
  permission,
  readonly: _readonly,
  listClassName,
  showListFooter,
  ...restProps
} = props

const { blockTeamsManagement } = useEeConfig()

const { isTeamsEnabled } = storeToRefs(useWorkspace())

const basesStore = useBases()

const { basesUser, basesTeams } = storeToRefs(basesStore)

const listRef = ref()

// Todo: @rameshmane7218, @pranav - remove this flag once the teams table and field permissions are enabled
const isTeamsTableAndFieldPermissionsEnabled = false

const showTeams = computed(() => {
  return !blockTeamsManagement.value && isTeamsEnabled.value && isTeamsTableAndFieldPermissionsEnabled
})

const baseUsers = computed(() => {
  return (basesUser.value.get(baseId) || []).map((user) => ({
    ...user,
    roles:
      user.roles ??
      (user.workspace_roles
        ? WorkspaceRolesToProjectRoles[user.workspace_roles as WorkspaceUserRoles] ?? ProjectRoles.NO_ACCESS
        : ProjectRoles.NO_ACCESS),
    ncGroupHeaderLabel: showTeams.value ? t('labels.members') : undefined,
  }))
})

const baseTeams = computed<NcListItemType[]>(() => {
  if (!showTeams.value) return []

  return (basesTeams.value.get(baseId) || []).map((bt) => ({
    ...bt,
    id: bt.team_id,
    isTeam: true,
    display_name: bt.team_title,
    roles: bt.base_role,
    base_roles: bt.base_role,
    ncGroupHeaderLabel: t('general.teams'),
  })) as NcListItemType[]
})

// Filter users based on minimum role requirement from PermissionMeta
const roleFilteredUsers = computed<NcListItemType[]>(() => {
  if (!permission) return baseTeams.value.concat(baseUsers.value)

  const permissionMeta = PermissionMeta[permission]
  if (!permissionMeta) return baseTeams.value.concat(baseUsers.value)

  const minimumRolePower = PermissionRolePower[permissionMeta.minimumRole]
  if (!minimumRolePower) return baseTeams.value.concat(baseUsers.value)

  return baseTeams.value.concat(baseUsers.value).filter((user) => {
    if (typeof user.roles === 'string') {
      const userRoles = (user.roles as string).split(',').map((r) => r.trim())
      return userRoles.some((role) => {
        const mappedRole = PermissionRoleMap[role as keyof typeof PermissionRoleMap]
        const rolePower = PermissionRolePower[mappedRole]
        return (rolePower && rolePower >= minimumRolePower) || selectedUsers.value.has(user.id)
      })
    }

    return Object.keys(user.roles ?? {}).some((role) => {
      const mappedRole = PermissionRoleMap[role as keyof typeof PermissionRoleMap]
      const rolePower = PermissionRolePower[mappedRole]
      return (rolePower && rolePower >= minimumRolePower) || selectedUsers.value.has(user.id)
    })
  })
})

const computedNcList = computed(() => {
  return listRef.value?.list ?? roleFilteredUsers.value
})

// Selected users display
const selectedUsersList = computed(() => {
  return Array.from(selectedUsers.value)
    .map((userId) => baseUsers.value.find((user) => user.id === userId))
    .filter(Boolean)
})

const toggleUser = (userId: string) => {
  if (props.readonly) return

  if (selectedUsers.value.has(userId)) {
    selectedUsers.value.delete(userId)
  } else {
    selectedUsers.value.add(userId)
  }
}

const selectAll = (filteredList: NcListItemType[] = listRef?.value?.list ?? roleFilteredUsers.value) => {
  if (props.readonly) return

  filteredList.forEach((user) => {
    selectedUsers.value.add(user.id)
  })
}

const clearAll = (filteredList: NcListItemType[] = listRef?.value?.list ?? roleFilteredUsers.value) => {
  if (props.readonly) return

  filteredList.forEach((user) => {
    selectedUsers.value.delete(user.id)
  })
}

const selectedUserIds = computed(() => {
  return selectedUsersList.value.map((user) => user?.id) as string[]
})

const handleUpdateValue = (option: NcListItemType) => {
  toggleUser(option.id)
}

const filterOption = (input: string, option: NcListItemType) => {
  return antSelectFilterOption(input, option, ['email', 'display_name'])
}

defineExpose({
  selectAll,
  clearAll,
  list: computedNcList,
})
</script>

<template>
  <NcList
    ref="listRef"
    :open="vOpen"
    v-bind="restProps"
    :value="selectedUserIds"
    :list="roleFilteredUsers"
    :group-order="[$t('general.teams'), $t('labels.members')]"
    option-label-key="email"
    option-value-key="id"
    :item-height="52"
    search-input-placeholder="Search user"
    is-multi-select
    :class="listClassName"
    :filter-option="filterOption"
    empty-description="No users found"
    @change="handleUpdateValue($event)"
    @escape="emits('escape', $event)"
  >
    <template #listItemExtraLeft="{ isSelected }">
      <NcCheckbox :checked="isSelected" />
    </template>

    <template #listItemContent="{ option }">
      <GeneralTeamInfo
        v-if="option?.isTeam"
        :team="transformToTeamObject(option)"
        :disabled="disabledUsers?.includes(option.id)"
        class="max-w-[calc(100%_-_24px)]"
      />
      <NcUserInfo
        v-else-if="option?.email"
        :user="option"
        :disabled="disabledUsers?.includes(option.id)"
        class="w-full max-w-[calc(100%_-_24px)]"
      />
      <template v-else>{{ option.email ?? option.id }} </template>
    </template>
    <template #listItemExtraRight="{ option }">
      <div class="flex items-center gap-1">
        <RolesBadge :border="false" :role="option.roles" icon-only nc-badge-class="!px-1" show-tooltip>
          <template #tooltip="{ label }">
            {{ $t('tooltip.basePermissionRole', { role: $t(`objects.roleType.${label}`) }) }}
          </template>
        </RolesBadge>
      </div>
    </template>
    <template #listItemSelectedIcon> </template>
    <template v-if="showListFooter && roleFilteredUsers.length > 1" #listFooter>
      <NcDivider class="!my-0" />

      <div class="flex items-center p-2 gap-3">
        <NcButton type="text" size="small" :disabled="listRef?.list?.length === 0" @click="selectAll()"> Select all </NcButton>
        <NcButton type="text" size="small" :disabled="selectedUsers.size === 0" @click="clearAll()"> Clear all </NcButton>
      </div>
    </template>
  </NcList>
</template>
