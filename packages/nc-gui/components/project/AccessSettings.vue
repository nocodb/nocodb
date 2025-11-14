<script lang="ts" setup>
import type { MetaType, PlanLimitExceededDetailsType, Roles, WorkspaceUserRoles } from 'nocodb-sdk'
import {
  OrderedProjectRoles,
  OrgUserRoles,
  ProjectRoles,
  RoleIcons,
  WorkspaceRolesToProjectRoles,
  WorkspaceUserRoles as WorkspaceUserRolesEnum,
  extractBaseRoleFromWorkspaceRole,
  getEffectiveBaseRole,
} from 'nocodb-sdk'

const props = defineProps<{
  baseId?: string
}>()

const router = useRouter()

const { user, ncNavigateTo } = useGlobal()

const { showInfoModal } = useNcConfirmModal()

const { isTeamsEnabled, activeWorkspaceId, teamsMap } = storeToRefs(useWorkspace())

const { isPrivateBase, base } = storeToRefs(useBase())

const basesStore = useBases()
const { getBaseUsers, getBaseTeams, createProjectUser, updateProjectUser, removeProjectUser, baseTeamUpdate, baseTeamRemove } =
  basesStore
const { activeProjectId, bases, basesUser, basesTeams } = storeToRefs(basesStore)

const { orgRoles, baseRoles, loadRoles, isUIAllowed } = useRoles()

const { sorts, sortDirection, loadSorts, handleGetSortedData, saveOrUpdate: saveOrUpdateUserSort } = useUserSorts('Project')

const isSuper = computed(() => orgRoles.value?.[OrgUserRoles.SUPER_ADMIN])

const orgStore = useOrg()
const { orgId, org } = storeToRefs(orgStore)

const isAdminPanel = inject(IsAdminPanelInj, ref(false))

const { $api, $eventBus } = useNuxtApp()

const { t } = useI18n()

const { projectPageTab } = storeToRefs(useConfigStore())

const { isPaymentEnabled, showUserPlanLimitExceededModal, showUpgradeToUseTeams } = useEeConfig()

const currentBase = computedAsync(async () => {
  let base
  if (props.baseId) {
    await loadRoles(props.baseId)
    base = bases.value.get(props.baseId)
    if (!base) {
      base = await $api.base.read(props.baseId!)
    }
  } else {
    base = bases.value.get(activeProjectId.value)
  }
  return base
})

const isInviteModalVisible = ref(false)

const isInviteTeamDlg = ref<boolean>(false)

interface Collaborators {
  id: string
  email: string
  main_roles: OrgUserRoles
  roles: ProjectRoles
  base_roles: Roles
  workspace_roles: WorkspaceUserRoles
  created_at: string
  display_name: string | null
  meta: MetaType
}

// Todo: @rameshmane7218 - toggle this when user clicks on listed team item
const isEditModalOpenUsingRouterPush = ref<boolean>(false)

const collaborators = ref<Collaborators[]>([])
const userSearchText = ref('')

const isLoading = ref(false)
const accessibleRoles = ref<(typeof ProjectRoles)[keyof typeof ProjectRoles][]>([])

const getTeamCompatibleAccessibleRoles = (roles: ProjectRoles[], record: any) => {
  let filteredRoles = roles

  if (!record?.isTeam || !isEeUI) {
    filteredRoles = roles.filter((r) => r !== ProjectRoles.INHERIT || isTeamsEnabled.value)
  } else {
    // Allow INHERIT for teams at base level, but filter out OWNER
    filteredRoles = roles.filter((r) => r !== ProjectRoles.OWNER)
  }

  // Show INHERIT only if current base-level role is not INHERIT or null/undefined
  // base_roles is the explicit base-level role (not inherited from workspace)
  const currentBaseRole = record?.base_roles
  if (!currentBaseRole || currentBaseRole === ProjectRoles.INHERIT) {
    filteredRoles = filteredRoles.filter((r) => r !== ProjectRoles.INHERIT)
  }

  return filteredRoles
}

const baseTeamsToCollaborators = computed(() => {
  if (!currentBase.value?.id) return []

  return (basesTeams.value.get(currentBase.value.id) || []).map((bt) => ({
    ...bt,
    id: bt.team_id,
    isTeam: true,
    display_name: bt.team_title,
    email: bt.team_title, // just for sort table by email
    roles:
      bt.base_role ??
      (bt.workspace_role
        ? WorkspaceRolesToProjectRoles[bt.workspace_role as WorkspaceUserRoles] ?? ProjectRoles.NO_ACCESS
        : ProjectRoles.NO_ACCESS),
    base_roles: bt.base_role,
    workspace_roles: bt.workspace_role,
  }))
})

const filteredCollaborators = computed(() => {
  if (!userSearchText.value) return collaborators.value.concat(baseTeamsToCollaborators.value)

  return collaborators.value
    .concat(baseTeamsToCollaborators.value)
    .filter((collab) => searchCompare([collab.display_name, collab.email], userSearchText.value))
})

const sortedCollaborators = computed(() => {
  return handleGetSortedData(
    filteredCollaborators.value,
    sorts.value,
    baseTeamsToCollaborators.value.length ? { field: 'created_at', direction: 'asc' } : undefined,
  )
})

const loadCollaborators = async () => {
  try {
    if (!currentBase.value) return

    const { users } = await getBaseUsers({
      baseId: currentBase.value.id!,
      ...(!userSearchText.value ? {} : ({ searchText: userSearchText.value } as any)),
      force: true,
    })

    collaborators.value = [
      ...(users || [])
        .filter((u: any) => !u?.deleted)
        .map((user: any) => ({
          ...user,
          base_roles: user.roles,
          roles:
            user.roles ??
            (user.workspace_roles
              ? WorkspaceRolesToProjectRoles[user.workspace_roles as WorkspaceUserRoles] ?? ProjectRoles.NO_ACCESS
              : ProjectRoles.NO_ACCESS),
        })),
    ]
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    if (currentBase.value) {
      getBaseTeams({
        baseId: currentBase.value.id!,
        force: true,
      }).catch(() => {
        // ignore
      })
    }
  }
}

const isOwnerOrCreator = computed(() => {
  return baseRoles.value?.[ProjectRoles.OWNER] || baseRoles.value?.[ProjectRoles.CREATOR]
})

const updateCollaborator = async (collab: any, roles: ProjectRoles) => {
  const currentCollaborator = collaborators.value.find((coll) => coll.id === collab.id)!

  try {
    if (collab?.isTeam) {
      // When role is INHERIT, delete the base team assignment
      if (roles === ProjectRoles.INHERIT) {
        await baseTeamRemove(currentBase.value.id!, [collab.id])
        // Update local state
        const currentBaseTeams = basesTeams.value.get(currentBase.value.id)
        if (currentBaseTeams?.length) {
          basesTeams.value.set(
            currentBase.value.id,
            currentBaseTeams.filter((team) => team.team_id !== collab.id),
          )
        }
      } else {
        await baseTeamUpdate(currentBase.value.id!, {
          team_id: collab.id,
          base_role: roles,
        })
      }
    } else {
      // When role is INHERIT, delete the base user entry
      if (roles === ProjectRoles.INHERIT) {
        await removeProjectUser(currentBase.value.id!, currentCollaborator as unknown as User)
        if (
          currentCollaborator.workspace_roles &&
          WorkspaceRolesToProjectRoles[currentCollaborator.workspace_roles as WorkspaceUserRoles] &&
          isEeUI
        ) {
          currentCollaborator.roles = WorkspaceRolesToProjectRoles[currentCollaborator.workspace_roles as WorkspaceUserRoles]
        } else {
          currentCollaborator.roles = ProjectRoles.NO_ACCESS
        }
        currentCollaborator.base_roles = null
      } else if (!roles || (roles === ProjectRoles.NO_ACCESS && !isEeUI)) {
        await removeProjectUser(currentBase.value.id!, currentCollaborator as unknown as User)
        if (
          currentCollaborator.workspace_roles &&
          WorkspaceRolesToProjectRoles[currentCollaborator.workspace_roles as WorkspaceUserRoles] === roles &&
          isEeUI
        ) {
          currentCollaborator.roles = WorkspaceRolesToProjectRoles[currentCollaborator.workspace_roles as WorkspaceUserRoles]
        } else {
          currentCollaborator.roles = ProjectRoles.NO_ACCESS
        }
        currentCollaborator.base_roles = null
      } else if (currentCollaborator.base_roles) {
        currentCollaborator.roles = roles
        await updateProjectUser(currentBase.value.id!, currentCollaborator as unknown as User)
      } else {
        currentCollaborator.roles = roles
        currentCollaborator.base_roles = roles
        await createProjectUser(currentBase.value.id!, currentCollaborator as unknown as User)
      }

      let currentBaseUsers = basesUser.value.get(currentBase.value.id)

      if (currentBaseUsers?.length) {
        currentBaseUsers = currentBaseUsers.map((user) => {
          if (user.id === currentCollaborator.id) {
            user.roles = currentCollaborator.roles as any
            user.base_roles = currentCollaborator.base_roles as any
          }
          return user
        })

        basesUser.value.set(currentBase.value.id, currentBaseUsers)
      }
    }
  } catch (e: any) {
    const errorInfo = await extractSdkResponseErrorMsgv2(e)

    if (isPaymentEnabled.value && errorInfo.error === NcErrorType.ERR_PLAN_LIMIT_EXCEEDED) {
      const details = errorInfo.details as PlanLimitExceededDetailsType

      showUserPlanLimitExceededModal({
        details,
        role: roles,
      })
    } else {
      message.error(errorInfo.message)
    }
  } finally {
    if (
      currentCollaborator &&
      user.value?.id === currentCollaborator.id &&
      currentCollaborator.roles === ProjectRoles.NO_ACCESS
    ) {
      if (currentBase.value) {
        bases.value.delete(currentBase.value.id!)
      }

      ncNavigateTo({
        workspaceId: activeWorkspaceId.value,
        baseId: undefined,
        tableId: undefined,
      })
      showInfoModal({
        title: `Base access no longer available`,
        content: `You removed your access from base ${currentBase.value?.title}.`,
      })
    } else {
      loadCollaborators()
    }
  }
}
const showOverlay = computed(() => {
  return base.value?.default_role && !baseRoles.value?.[ProjectRoles.OWNER]
})

onMounted(async () => {
  if (showOverlay.value) return
  isLoading.value = true
  try {
    await loadCollaborators()
    const currentRoleIndex = OrderedProjectRoles.findIndex(
      (role) => baseRoles.value && Object.keys(baseRoles.value).includes(role),
    )
    if (isSuper.value) {
      accessibleRoles.value = OrderedProjectRoles.slice(0)
    } else if (currentRoleIndex !== -1) {
      accessibleRoles.value = OrderedProjectRoles.slice(currentRoleIndex)
    }

    moveInheritRole()

    loadSorts()
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isLoading.value = false
  }
})

watch(baseRoles, (br) => {
  const currentRoleIndex = OrderedProjectRoles.findIndex((role) => br && Object.keys(br).includes(role))
  accessibleRoles.value = OrderedProjectRoles.slice(currentRoleIndex)

  moveInheritRole()
})

function moveInheritRole() {
  // move INHERIT role to the end of the list
  const inheritIndex = accessibleRoles.value.indexOf(ProjectRoles.INHERIT)
  if (inheritIndex !== -1) {
    accessibleRoles.value.push(...accessibleRoles.value.splice(inheritIndex, 1))
  }
}

// Helper function to determine inheritance source and effective role
const getInheritanceInfo = (record: any) => {
  const baseRole = record.base_roles as ProjectRoles | null
  if (baseRole && baseRole !== ProjectRoles.INHERIT) {
    return null
  }

  const workspaceRole = (record.workspace_roles as WorkspaceUserRoles | null) || null
  let baseTeamRole: ProjectRoles | undefined
  let workspaceTeamRole: WorkspaceUserRoles | undefined
  let workspaceUserRole: WorkspaceUserRoles | undefined

  if (record.isTeam) {
    baseTeamRole = (record.base_role as ProjectRoles | null) || undefined
    workspaceTeamRole = workspaceRole && workspaceRole !== WorkspaceUserRolesEnum.INHERIT ? workspaceRole : undefined
  } else {
    // Backend already processes team roles to single string values
    // base_team_roles is already a ProjectRole string, workspace_team_roles is already a WorkspaceUserRole string
    baseTeamRole = (record.base_team_roles as ProjectRoles | null) || undefined
    workspaceTeamRole = (record.workspace_team_roles as WorkspaceUserRoles | null) || undefined
    workspaceUserRole = workspaceRole && workspaceRole !== WorkspaceUserRolesEnum.INHERIT ? workspaceRole : undefined
  }

  // If no inheritance sources available, return null
  if (!baseTeamRole && !workspaceUserRole && !workspaceTeamRole) {
    return null
  }

  const effectiveRole = getEffectiveBaseRole({
    baseRole: baseRole || ProjectRoles.INHERIT,
    baseTeamRole,
    workspaceRole: workspaceUserRole,
    workspaceTeamRole,
  })

  if (!effectiveRole || effectiveRole === ProjectRoles.INHERIT || effectiveRole === ProjectRoles.NO_ACCESS) {
    return null
  }

  // Determine source based on which role was actually used (following getEffectiveBaseRole priority)
  let source: 'workspace' | 'team'
  if (record.isTeam) {
    source = baseTeamRole && baseTeamRole === effectiveRole ? 'team' : 'workspace'
  } else {
    // Priority: baseTeamRole > workspaceUserRole > workspaceTeamRole
    if (baseTeamRole && baseTeamRole === effectiveRole) {
      source = 'team'
    } else if (workspaceUserRole && extractBaseRoleFromWorkspaceRole(workspaceUserRole) === effectiveRole) {
      source = 'workspace'
    } else if (workspaceTeamRole && extractBaseRoleFromWorkspaceRole(workspaceTeamRole) === effectiveRole) {
      source = 'team'
    } else {
      source = 'workspace'
    }
  }

  return {
    source,
    effectiveRole,
    effectiveRoleIcon: RoleIcons[effectiveRole as keyof typeof RoleIcons],
  }
}

const selected = reactive<{
  [key: string]: boolean
}>({})

const toggleSelectAll = (value: boolean) => {
  filteredCollaborators.value.forEach((_) => {
    selected[_.id] = value
  })
}

// const isSomeSelected = computed(() => Object.values(selected).some((v) => v))

const selectAll = computed({
  get: () =>
    Object.values(selected).every((v) => v) &&
    Object.keys(selected).length > 0 &&
    Object.values(selected).length === filteredCollaborators.value.length,
  set: (value) => {
    toggleSelectAll(value)
  },
})

watch(isInviteModalVisible, () => {
  if (!isInviteModalVisible.value) {
    isInviteTeamDlg.value = false

    loadCollaborators()
  }
})

watch(currentBase, () => {
  loadCollaborators()
})

const orderBy = computed<Record<string, SordDirectionType>>({
  get: () => {
    return sortDirection.value
  },
  set: (value: Record<string, SordDirectionType>) => {
    // Check if value is an empty object
    if (Object.keys(value).length === 0) {
      saveOrUpdateUserSort({})
      return
    }

    const [field, direction] = Object.entries(value)[0]

    saveOrUpdateUserSort({
      field,
      direction,
    })
  },
})

const columns = [
  // // Enable this select row column once we introduce bulk action
  // {
  //   key: 'select',
  //   title: '',
  //   width: 70,
  //   minWidth: 70,
  // },
  {
    key: 'email',
    title: t('labels.members'),
    minWidth: 220,
    dataIndex: 'email',
    showOrderBy: true,
  },
  {
    key: 'role',
    title: t('general.role'),
    basis: '30%',
    minWidth: 272,
    dataIndex: 'roles',
    showOrderBy: true,
  },
  {
    key: 'created_at',
    title: t('title.dateJoined'),
    basis: '20%',
    minWidth: 200,
  },
  {
    key: 'action',
    title: t('labels.actions'),
    width: 110,
    minWidth: 110,
    justify: 'justify-end',
  },
] as NcTableColumnProps[]

const customRow = (record: Record<string, any>) => ({
  class: `${selected[record.id] ? 'selected' : ''} user-row`,
})

const isOnlyOneOwner = computed(() => {
  return collaborators.value?.filter((collab) => collab.roles === ProjectRoles.OWNER).length === 1
})

const isDeleteOrUpdateAllowed = (user) => {
  return !(isOnlyOneOwner.value && user.roles === ProjectRoles.OWNER)
}

const goToBaseSettings = () => {
  router.push({
    query: {
      ...router.currentRoute.value.query,
      page: 'base-settings',
      tab: 'baseType',
    },
  })
}

watch(projectPageTab, () => {
  if (!userSearchText.value) return

  userSearchText.value = ''
})

const evtListener = (event: string, data: any) => {
  if (data.baseId !== currentBase.value?.id) return

  if (event === 'base_user_update') {
    // Handle the event
    loadCollaborators()
  }
}

onMounted(() => {
  loadSorts()
  $eventBus.realtimeBaseUserEventBus.on(evtListener)
})

onBeforeUnmount(() => {
  $eventBus.realtimeBaseUserEventBus.off(evtListener)
})
</script>

<template>
  <div
    class="nc-collaborator-table-container nc-access-settings-view flex flex-col relative"
    :class="{
      'nc-admin-panel': isAdminPanel,
    }"
  >
    <ProjectPrivateOverlay v-if="showOverlay" />
    <template v-else>
      <div v-if="isAdminPanel">
        <div class="nc-breadcrumb px-2">
          <div class="nc-breadcrumb-item">
            {{ org.title }}
          </div>
          <GeneralIcon icon="ncSlash1" class="nc-breadcrumb-divider" />
          <NuxtLink
            :href="`/admin/${orgId}/bases`"
            class="!hover:(text-gray-800 underline-gray-600) flex items-center !text-gray-700 !underline-transparent max-w-1/4"
          >
            <div class="nc-breadcrumb-item">
              {{ $t('objects.projects') }}
            </div>
          </NuxtLink>
          <GeneralIcon icon="ncSlash1" class="nc-breadcrumb-divider" />
          <div class="nc-breadcrumb-item active truncate capitalize">
            {{ currentBase?.title }}
          </div>
        </div>
        <NcPageHeader>
          <template #icon>
            <div class="nc-page-header-icon flex justify-center items-center h-5 w-5">
              <GeneralBaseIconColorPicker readonly />
            </div>
          </template>
          <template #title>
            <span data-rec="true" class="capitalize">
              {{ currentBase?.title }}
            </span>
          </template>
        </NcPageHeader>
      </div>

      <div class="nc-content-max-w h-full flex flex-col items-center gap-6 px-4 md:px-6 pt-6">
        <NcAlert v-if="isEeUI && isPrivateBase" type="info" :message="$t('title.privateBase')" class="bg-nc-bg-gray-extralight">
          <template #icon>
            <GeneralIcon icon="ncUser" class="w-6 h-6 text-nc-content-gray-subtle" />
          </template>
          <template #description>
            {{ $t('title.privateBaseAlertDescription') }}
          </template>

          <template v-if="isUIAllowed('manageBaseType')" #action>
            <NcButton
              type="secondary"
              size="small"
              class="!mt-[-4px]"
              inner-class="!gap-1.5"
              icon-position="right"
              @click="goToBaseSettings"
            >
              <template #icon>
                <GeneralIcon icon="ncArrowUpRight" class="w-4 h-4" />
              </template>
              {{ $t('activity.goToBaseSettings') }}
            </NcButton>
          </template>
        </NcAlert>
        <div v-if="!isAdminPanel" class="w-full flex justify-between items-center max-w-full gap-3">
          <a-input
            v-model:value="userSearchText"
            :placeholder="isTeamsEnabled ? $t('title.searchForMembersOrTeams') : $t('title.searchMembers')"
            :disabled="isLoading"
            allow-clear
            class="nc-input-border-on-value !max-w-90 !h-8 !px-3 !py-1 !rounded-lg"
          >
            <template #prefix>
              <GeneralIcon icon="search" class="mr-2 h-4 w-4 text-gray-500 group-hover:text-black" />
            </template>
          </a-input>

          <div class="flex items-center gap-2">
            <NcButton
              size="small"
              :type="isTeamsEnabled ? 'secondary' : 'primary'"
              :disabled="isLoading"
              data-testid="nc-add-member-btn"
              :text-color="isTeamsEnabled ? 'primary' : undefined"
              @click="isInviteModalVisible = true"
            >
              <div class="flex items-center gap-2">
                <GeneralIcon :icon="isTeamsEnabled ? 'ncUsers' : 'plus'" class="h-4 w-4" />
                {{ $t('activity.addMembers') }}
              </div>
            </NcButton>

            <NcButton
              v-if="isTeamsEnabled && !isAdminPanel"
              v-e="['c:base:team-add']"
              size="small"
              type="secondary"
              :disabled="isLoading"
              data-testid="nc-add-teams-btn"
              text-color="primary"
              @click="
                showUpgradeToUseTeams({
                  successCallback: () => {
                    isInviteTeamDlg = true
                    isInviteModalVisible = true
                  },
                })
              "
            >
              <div class="flex items-center gap-2">
                <GeneralIcon icon="ncBuilding" />
                {{ $t('labels.addTeams') }}
              </div>
            </NcButton>
          </div>
        </div>

        <NcTable
          v-model:order-by="orderBy"
          :is-data-loading="isLoading"
          :columns="columns"
          :data="sortedCollaborators"
          :bordered="false"
          :custom-row="customRow"
          class="flex-1 nc-collaborators-list max-w-full"
          body-row-class-name="!cursor-default"
          :pagination="true"
          :pagination-offset="25"
        >
          <template #emptyText>
            <a-empty :description="$t('title.noMembersFound')" />
          </template>

          <template #headerCell="{ column }">
            <template v-if="column.key === 'select'">
              <NcCheckbox v-model:checked="selectAll" :disabled="!sortedCollaborators.length" />
            </template>
            <template v-else>
              {{ column.title }}
            </template>
          </template>

          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'select'">
              <NcCheckbox v-model:checked="selected[record.id]" />
            </template>

            <template v-if="column.key === 'email' && record.isTeam">
              <GeneralTeamInfo :team="transformToTeamObject(record, teamsMap[record.id])" />
            </template>

            <div v-else-if="column.key === 'email'" class="w-full flex gap-3 items-center users-email-grid">
              <GeneralUserIcon size="base" :user="record" class="flex-none" />
              <div class="flex flex-col flex-1 max-w-[calc(100%_-_44px)]">
                <div class="flex gap-3">
                  <NcTooltip class="truncate max-w-full text-gray-800 capitalize font-semibold" show-on-truncate-only>
                    <template #title>
                      {{ record.display_name || record.email.slice(0, record.email.indexOf('@')) }}
                    </template>
                    {{ record.display_name || record.email.slice(0, record.email.indexOf('@')) }}
                  </NcTooltip>
                </div>
                <NcTooltip class="truncate max-w-full text-xs text-gray-600" show-on-truncate-only>
                  <template #title>
                    {{ record.email }}
                  </template>
                  {{ record.email }}
                </NcTooltip>
              </div>
            </div>
            <div v-if="column.key === 'role'">
              <template
                v-if="
                  isDeleteOrUpdateAllowed(record) &&
                  isOwnerOrCreator &&
                  (getTeamCompatibleAccessibleRoles(accessibleRoles, record).includes(record.roles) ||
                    record.roles === ProjectRoles.INHERIT)
                "
              >
                <RolesSelectorV2
                  :role="getInheritanceInfo(record) ? ProjectRoles.INHERIT : record.roles"
                  :roles="getTeamCompatibleAccessibleRoles(accessibleRoles, record)"
                  :inherit="isEeUI && getInheritanceInfo(record) ? getInheritanceInfo(record)?.effectiveRole : undefined"
                  :inherit-source="getInheritanceInfo(record)?.source"
                  :effective-role="getInheritanceInfo(record)?.effectiveRole"
                  :show-inherit="!!getInheritanceInfo(record)"
                  :on-role-change="(role) => updateCollaborator(record, role as ProjectRoles)"
                />
              </template>
              <template v-else>
                <div class="flex items-center gap-2">
                  <RolesBadge
                    :border="false"
                    :role="getInheritanceInfo(record) ? ProjectRoles.INHERIT : record.roles"
                    :inherit="!!getInheritanceInfo(record)"
                  />
                  <NcTooltip
                    v-if="isEeUI && getInheritanceInfo(record)"
                    class="uppercase text-[10px] leading-4 text-nc-content-gray-muted"
                    placement="bottom"
                  >
                    <template #title>
                      <div class="flex flex-col gap-1">
                        <div>
                          {{
                            getInheritanceInfo(record)?.source === 'team'
                              ? $t('tooltip.roleInheritedFromTeam')
                              : $t('tooltip.roleInheritedFromWorkspace')
                          }}
                        </div>
                        <div v-if="getInheritanceInfo(record)?.effectiveRole" class="text-xs font-normal">
                          {{
                            $t('tooltip.effectiveRole', {
                              role: $t(`objects.roleType.${getInheritanceInfo(record)?.effectiveRole}`),
                            })
                          }}
                        </div>
                      </div>
                    </template>
                    <div class="flex items-center gap-1">
                      <RolesBadge
                        v-if="getInheritanceInfo(record)?.effectiveRole"
                        :border="false"
                        :role="getInheritanceInfo(record)?.effectiveRole"
                        icon-only
                        nc-badge-class="!px-1"
                      />
                      <span>{{
                        getInheritanceInfo(record)?.source === 'team' ? $t('objects.team') : $t('objects.workspace')
                      }}</span>
                    </div>
                  </NcTooltip>
                </div>
              </template>
            </div>
            <div v-if="column.key === 'created_at'">
              <NcTooltip class="max-w-full">
                <template #title>
                  {{ parseStringDateTime(record.created_at) }}
                </template>
                <span>
                  {{ timeAgo(record.created_at) }}
                </span>
              </NcTooltip>
            </div>
            <div v-if="column.key === 'action'">
              <NcDropdown placement="bottomRight">
                <NcButton size="small" type="secondary">
                  <component :is="iconMap.ncMoreVertical" />
                </NcButton>
                <template #overlay>
                  <NcMenu variant="small">
                    <NcMenuItemCopyId
                      :id="record.id"
                      :tooltip="record.isTeam ? $t(`labels.clickToCopyTeamID`) : $t(`labels.clickToCopyUserID`)"
                      :label="
                        record.isTeam
                          ? $t(`labels.teamIdColon`, { teamId: record.id })
                          : $t(`labels.userIdColon`, { userId: record.id })
                      "
                    />
                  </NcMenu>
                </template>
              </NcDropdown>
            </div>
          </template>
        </NcTable>
      </div>

      <LazyDlgInviteDlg
        v-model:model-value="isInviteModalVisible"
        :base-id="currentBase?.id"
        :users="collaborators"
        :is-team="isInviteTeamDlg"
        type="base"
        :existing-team-ids="baseTeamsToCollaborators.map((bt) => bt.id)"
      />

      <WorkspaceTeamsEdit v-if="isEeUI && isTeamsEnabled" :is-open-using-router-push="isEditModalOpenUsingRouterPush" />
    </template>
  </div>
</template>

<style scoped lang="scss">
.color-band {
  @apply w-6 h-6 left-0 top-2.5 rounded-full flex justify-center uppercase text-white font-weight-bold text-xs items-center;
}

:deep(.nc-collaborator-role-select .ant-select-selector) {
  @apply !rounded;
}

.nc-page-header-icon {
  :deep(svg) {
    @apply h-4.5 w-4.5;
  }
}

.nc-collaborator-table-container {
  &:not(.nc-admin-panel) {
    @apply h-[calc(100vh-var(--topbar-height)-44px)];

    @supports (height: 100dvh) {
      @apply h-[calc(100dvh-var(--topbar-height)-44px)];
    }
  }
}
</style>
