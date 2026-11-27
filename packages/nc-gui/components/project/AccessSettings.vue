<script lang="ts" setup>
import type {
  AppMemberTeamRef,
  BaseMembersListApp,
  MetaType,
  PlanLimitExceededDetailsType,
  Roles,
  SeatType,
  WorkspaceUserRoles,
} from 'nocodb-sdk'
import {
  AGENT_ASSIGNABLE_ROLES,
  OrderedProjectRoles,
  OrgUserRoles,
  ProjectRoles,
  RoleColors,
  RoleIcons,
  RoleLabels,
  WorkspaceRolesToProjectRoles,
  WorkspaceUserRoles as WorkspaceUserRolesEnum,
  extractBaseRoleFromWorkspaceRole,
  getEffectiveBaseRole,
} from 'nocodb-sdk'

const props = defineProps<{
  baseId?: string
}>()

const openBaseSettings = useBaseSettingsLink()

const { user, ncNavigateTo } = useGlobal()

const { showInfoModal } = useNcConfirmModal()

const { isTeamsEnabled, activeWorkspaceId, teamsMap } = storeToRefs(useWorkspace())

const { isPrivateBase, base } = storeToRefs(useBase())

const basesStore = useBases()
const { getBaseUsers, getBaseTeams, createProjectUser, updateProjectUser, removeProjectUser, baseTeamUpdate, baseTeamRemove } =
  basesStore
const { activeProjectId, bases, basesUser, basesTeams } = storeToRefs(basesStore)

// An agent is a base principal like a user or a team: it holds a base role via
// its PrincipalAssignment row, so it belongs in this list. CE's store stub
// returns an empty map, which collapses every agent branch below to a no-op.
const agentStore = useAgentStore()
const { loadAgents, updateAgent } = agentStore
const { agents } = storeToRefs(agentStore)

const { orgRoles, baseRoles, loadRoles, isUIAllowed, environmentRestrictionReason } = useRoles()

const appStore = useAppStore()

const { removeAppMember } = appStore

const { appTeamMembersVersion } = storeToRefs(appStore)

const { sorts, sortDirection, loadSorts, handleGetSortedData, saveOrUpdate: saveOrUpdateUserSort } = useUserSorts('Project')

const isSuper = computed(() => orgRoles.value?.[OrgUserRoles.SUPER_ADMIN])

const orgStore = useOrg()
const { orgId, org } = storeToRefs(orgStore)

const isAdminPanel = inject(IsAdminPanelInj, ref(false))

const isSettingsSidebar = inject(IsSettingsSidebarInj, ref(false))

const { $api, $eventBus, $e } = useNuxtApp()

const { t } = useI18n()

const { projectPageTab } = storeToRefs(useConfigStore())

const {
  isPaymentEnabled,
  showEEFeatures,
  showUserPlanLimitExceededModal,
  showUpgradeToUseTeams,
  seatModel,
  seatMonthlyPrices,
  isWsOwner,
  loadSeatCounts,
  activePlanTitle,
} = useEeConfig()

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

const canAddTeams = computed(() => isTeamsEnabled.value && !isAdminPanel.value && showEEFeatures.value)

function addMembers() {
  isInviteModalVisible.value = true
}

function addTeams() {
  showUpgradeToUseTeams({
    successCallback: () => {
      isInviteTeamDlg.value = true
      isInviteModalVisible.value = true
    },
    triggerSource: 'project-teams',
  })
}

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
  app_teams?: AppMemberTeamRef[]
}

// Todo: @rameshmane7218 - toggle this when user clicks on listed team item
const isEditModalOpenUsingRouterPush = ref<boolean>(false)

const collaborators = ref<Collaborators[]>([])

const baseApp = ref<BaseMembersListApp | null>(null)

// The app and its teams are served to base owners and creators only, and only when the base has an app.
const app = computed(() =>
  appOnBaseMembersList(baseApp.value, {
    isAdminPanel: isAdminPanel.value,
    pageBaseId: props.baseId ?? activeProjectId.value,
    activeBaseId: activeProjectId.value,
  }),
)

const isV2 = computed(() => isPaymentEnabled.value && seatModel.value === 'v2')

const hasSeatData = computed(() => isV2.value && collaborators.value.some((collab: any) => !!collab.seat_type))
const userSearchText = ref('')

const isLoading = ref(false)
const accessibleRoles = ref<(typeof ProjectRoles)[keyof typeof ProjectRoles][]>([])

const getTeamCompatibleAccessibleRoles = (roles: ProjectRoles[], record: any) => {
  let filteredRoles = roles

  // An agent's role is a direct grant with no inheritance chain, and it is
  // capped at EDITOR server-side — mirror that cap here so the selector can't
  // offer a role the API will reject.
  if (record?.isAgent) {
    return roles.filter((r) => (AGENT_ASSIGNABLE_ROLES as readonly string[]).includes(r))
  }

  if (record?.isTeam && isEeUI) {
    // EE teams: allow INHERIT, filter out OWNER
    filteredRoles = roles.filter((r) => r !== ProjectRoles.OWNER)
  } else if (isEeUI) {
    // EE non-team: INHERIT only if teams enabled
    filteredRoles = roles.filter((r) => r !== ProjectRoles.INHERIT || isTeamsEnabled.value)

    // In EE: hide INHERIT if user is already inheriting (no explicit base role)
    const currentBaseRole = record?.base_roles
    if (!currentBaseRole || currentBaseRole === ProjectRoles.INHERIT) {
      filteredRoles = filteredRoles.filter((r) => r !== ProjectRoles.INHERIT)
    }
  }
  // CE: always keep INHERIT visible — workspace role inheritance is supported

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

const baseAgentsToCollaborators = computed(() => {
  if (!currentBase.value?.id) return []

  return selectableAgents(agents.value.get(currentBase.value.id) || []).map((agent: Record<string, any>) => ({
    ...agent,
    isAgent: true,
    display_name: agent.title,
    // Agents have no mailbox; the row's secondary line shows the description
    // instead, and `email` still backs search and email-column sorting.
    email: agent.description || '',
    roles: agent.role ?? ProjectRoles.VIEWER,
    base_roles: agent.role ?? ProjectRoles.VIEWER,
  }))
})

const roleFilter = ref<string>('all')

const memberFilter = ref<string>('all')

const teamFilter = ref<string>('all')

const teamFilterOptions = computed(() => [
  { value: 'all', label: t('labels.appAccess.allTeams') },
  { value: 'any', label: t('labels.appAccess.anyTeam') },
  ...(app.value?.teams ?? []).map((team) => ({ value: team.id, label: team.title })),
  { value: 'none', label: t('labels.appAccess.notInTheApp') },
])

watch(teamFilter, (value) => {
  $e('c:base:members:app-team:filter', { value: ['all', 'any', 'none'].includes(value) ? value : 'team' })
})

// Only the roles a base can actually hand out — INHERIT is a source, not a role,
// and App User belongs to the interface surface.
const roleFilterOptions = computed(() => [
  { value: 'all', label: t('labels.allRoles') },
  ...OrderedProjectRoles.filter((role) => role !== ProjectRoles.INHERIT && role !== ProjectRoles.APP_USER).map((role) => ({
    value: role,
    label: t(`objects.roleType.${RoleLabels[role]}`),
    icon: RoleIcons[role],
    color: RoleColors[role],
  })),
])

// Principal-type slices first, a divider, then where the role came from.
const memberFilterOptions = computed(() => {
  const options: Record<string, any>[] = [
    { value: 'all', label: t('labels.allSources'), description: t('labels.baseMembersAll') },
  ]

  if (baseTeamsToCollaborators.value.length) {
    options.push({ value: 'teams', label: t('labels.sourceTeams'), description: t('labels.baseMembersTeams') })
  }

  if (baseAgentsToCollaborators.value.length) {
    options.push({ value: 'agents', label: t('labels.agents'), description: t('labels.baseMembersAgents') })
  }

  options.push(
    { value: '__divider', divider: true, label: '' },
    { value: 'direct', label: t('labels.sourceDirectGrants'), description: t('labels.baseMembersDirect') },
    { value: 'inherited', label: t('labels.sourceFromBase'), description: t('labels.baseMembersInherited') },
  )

  return options
})

function matchesMemberFilter(collab: any) {
  switch (memberFilter.value) {
    case 'teams':
      return !!collab.isTeam
    case 'agents':
      return !!collab.isAgent
    case 'direct':
      return !getInheritanceInfo(collab)
    case 'inherited':
      return !!getInheritanceInfo(collab)
    default:
      return true
  }
}

function matchesTeamFilter(collab: any) {
  if (teamFilter.value === 'all' || !app.value) return true

  if (collab.isTeam || collab.isAgent) return false

  const teamIds: string[] = (collab.app_teams ?? []).map((team: { id: string }) => team.id)

  if (teamFilter.value === 'any') return teamIds.length > 0
  if (teamFilter.value === 'none') return teamIds.length === 0

  return teamIds.includes(teamFilter.value)
}

const filteredCollaborators = computed(() => {
  const all = collaborators.value.concat(baseTeamsToCollaborators.value).concat(baseAgentsToCollaborators.value)

  return all.filter((collab) => {
    if (userSearchText.value && !searchCompare([collab.display_name, collab.email], userSearchText.value)) return false

    if (roleFilter.value !== 'all' && collab.roles !== roleFilter.value) return false

    return matchesMemberFilter(collab) && matchesTeamFilter(collab)
  })
})

const sortedCollaborators = computed(() => {
  return handleGetSortedData(
    filteredCollaborators.value,
    sorts.value,
    baseTeamsToCollaborators.value.length || baseAgentsToCollaborators.value.length
      ? { field: 'created_at', direction: 'asc' }
      : undefined,
  )
})

const loadCollaborators = async () => {
  try {
    if (!currentBase.value) return

    // Agents are base principals too, and the sidebar tree may not have loaded
    // them yet when this page is opened directly. Failure is non-fatal: the
    // members list still renders its users and teams.
    loadAgents({ baseId: currentBase.value.id!, force: true }).catch(() => {})

    const { users, app: appOfBase } = await getBaseUsers({
      baseId: currentBase.value.id!,
      ...(!userSearchText.value ? {} : ({ searchText: userSearchText.value } as any)),
      force: true,
    })

    baseApp.value = appOfBase ?? null

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
    if (collab?.isAgent) {
      // The agent store patches its own cached row, which `agents` — and so
      // this table — reads straight through.
      await updateAgent(currentBase.value!.id!, collab.id, { role: roles })
      return true
    }

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
      // When role is INHERIT, delete the base user entry (if exists)
      if (roles === ProjectRoles.INHERIT) {
        // Only remove if user has an explicit base role to remove
        if (currentCollaborator.base_roles) {
          await removeProjectUser(currentBase.value.id!, currentCollaborator as unknown as User)
        }
        if (
          currentCollaborator.workspace_roles &&
          WorkspaceRolesToProjectRoles[currentCollaborator.workspace_roles as WorkspaceUserRoles]
        ) {
          currentCollaborator.roles = WorkspaceRolesToProjectRoles[currentCollaborator.workspace_roles as WorkspaceUserRoles]
        } else {
          currentCollaborator.roles = ProjectRoles.NO_ACCESS
        }
        currentCollaborator.base_roles = null
      } else if (!roles) {
        if (currentCollaborator.base_roles) {
          await removeProjectUser(currentBase.value.id!, currentCollaborator as unknown as User)
        }
        if (
          currentCollaborator.workspace_roles &&
          WorkspaceRolesToProjectRoles[currentCollaborator.workspace_roles as WorkspaceUserRoles] === roles
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

    return true
  } catch (e: any) {
    const errorInfo = await extractSdkResponseErrorMsgv2(e)

    if (isPaymentEnabled.value && errorInfo.error === NcErrorType.ERR_PLAN_LIMIT_EXCEEDED) {
      const details = errorInfo.details as PlanLimitExceededDetailsType

      showUserPlanLimitExceededModal({
        details,
        role: roles,
        triggerSource: 'project-members',
      })
    } else {
      message.error(errorInfo.message)
    }

    return false
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
        title: `Project access no longer available`,
        content: `You removed your access from project ${currentBase.value?.title}.`,
      })
    } else {
      loadCollaborators()
    }
  }
}
const roleConfirm = reactive({
  visible: false,
  collab: null as any,
  role: ProjectRoles.NO_ACCESS as ProjectRoles,
  seatLine: '',
  hasExplicitAppTeams: false,
  removeFromApp: true,
  viaTeams: [] as string[],
})

function onRoleChange(collab: any, role: ProjectRoles) {
  if (collab.isTeam || collab.isAgent) return updateCollaborator(collab, role)

  const { becomesEditor, hasExplicitAppTeams, viaTeams } = planBaseMemberRoleChange({
    isV2: isV2.value,
    editorPrice: seatMonthlyPrices.value.editor,
    hasApp: !!app.value,
    role,
    seatType: collab.seat_type,
    appTeams: collab.app_teams ?? [],
  })

  if (!becomesEditor && !hasExplicitAppTeams && !viaTeams.length) return updateCollaborator(collab, role)

  Object.assign(roleConfirm, {
    visible: true,
    collab,
    role,
    seatLine: becomesEditor
      ? t('payment.appSeat.roleChangeToEditor', {
          name: extractUserDisplayNameOrEmail(collab),
          price: seatMonthlyPrices.value.editor,
        })
      : '',
    hasExplicitAppTeams,
    removeFromApp: true,
    viaTeams,
  })

  $e('c:base:member:role-seat:confirm', { role, seat: becomesEditor, removeFromApp: hasExplicitAppTeams })
}

async function onConfirmRoleChange() {
  const { collab, role, hasExplicitAppTeams, removeFromApp } = roleConfirm

  roleConfirm.visible = false

  await changeRoleThenRemoveFromApp(
    () => updateCollaborator(collab, role),
    async () => {
      if (!hasExplicitAppTeams || !removeFromApp || !app.value) return

      if (await removeAppMember(app.value.id, { principalType: 'user', principalId: collab.id })) loadCollaborators()
    },
  )
}

const passNoticeRows = computed(() =>
  collaborators.value.map((collab: any) => ({
    principal_type: 'user' as const,
    principal_id: collab.id,
    base_role: collab.roles,
    teams: collab.app_teams ?? [],
  })),
)

const appMembershipReason = computed(() => {
  if (currentBase.value?.is_lane_instance) return t('tooltip.featureOnProductionOnly')

  return (
    environmentRestrictionReason('appCreateOrEdit') || (app.value?.teams.length ? null : t('labels.appAccess.createTeamFirst'))
  )
})

const stillOnAppTeams = (record: Collaborators) =>
  appTeamsKeptOnNoAccess(app.value, record, getInheritanceInfo(record)?.effectiveRole ?? record.roles).join(', ')

const seatCounts = ref<Awaited<ReturnType<typeof loadSeatCounts>>>(null)

watch(
  [isV2, activeWorkspaceId],
  async ([v2, workspaceId]) => {
    seatCounts.value = v2 && workspaceId ? await loadSeatCounts(workspaceId as string) : null
  },
  { immediate: true },
)

function seatTooltip(seatType: SeatType) {
  if (seatType === 'full') {
    return seatMonthlyPrices.value.editor ? t('payment.appSeat.seatTooltipEditor', { price: seatMonthlyPrices.value.editor }) : ''
  }

  if (seatType === 'app') {
    return seatMonthlyPrices.value.guest && seatCounts.value?.freeApp != null
      ? t('payment.appSeat.seatTooltipGuest', {
          price: seatMonthlyPrices.value.guest,
          free: seatCounts.value.freeApp,
          plan: activePlanTitle.value,
        })
      : ''
  }

  return t('payment.appSeat.seatTooltipFree')
}

// Billing detail is owner-only; `isWsOwner` is absent from the CE useEeConfig stub.
const canOpenSeatDetail = computed(() => isEeUI && !!(isWsOwner?.value || isSuper.value))

const seatDetailUser = ref<any>(null)

const isSeatDetailModalOpen = ref(false)

function openSeatDetail(record: any) {
  if (!canOpenSeatDetail.value || record?.isTeam || record?.isAgent) return

  seatDetailUser.value = record
  isSeatDetailModalOpen.value = true
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
      accessibleRoles.value = filterAssignableRoles(OrderedProjectRoles.slice(0))
    } else if (currentRoleIndex !== -1) {
      accessibleRoles.value = filterAssignableRoles(OrderedProjectRoles.slice(currentRoleIndex))
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
  accessibleRoles.value = filterAssignableRoles(OrderedProjectRoles.slice(currentRoleIndex))

  moveInheritRole()
})

// APP_USER is assignable only where apps exist (EE) — hide it in CE.
function filterAssignableRoles(roles: ProjectRoles[]) {
  if (isEeUI) return roles
  return roles.filter((role) => role !== ProjectRoles.APP_USER)
}

function moveInheritRole() {
  // move INHERIT role to the end of the list
  const inheritIndex = accessibleRoles.value.indexOf(ProjectRoles.INHERIT)
  if (inheritIndex !== -1) {
    accessibleRoles.value.push(...accessibleRoles.value.splice(inheritIndex, 1))
  }
}

// Helper function to determine inheritance source and effective role
function getInheritanceInfo(record: any) {
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
    defaultBaseRole: base.value?.default_role,
  })

  if (!effectiveRole || effectiveRole === ProjectRoles.INHERIT) {
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

watch(isInviteModalVisible, () => {
  if (!isInviteModalVisible.value) {
    isInviteTeamDlg.value = false

    loadCollaborators()
  }
})

watch(currentBase, () => {
  loadCollaborators()
})

// Team chips, the Team filter and the pass notice come from this list, so App teams edits reload it.
watch(appTeamMembersVersion, useDebounceFn(loadCollaborators, 300, { maxWait: 1000 }))

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

const columns = computed(
  () =>
    [
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
      ...(hasSeatData.value ? [{ key: 'seat', title: t('payment.appSeat.seatColumn'), width: 130, minWidth: 130 }] : []),
      ...(app.value ? [{ key: 'app_teams', title: t('labels.appAccess.appTeamsGroup'), basis: '25%', minWidth: 260 }] : []),
      {
        key: 'created_at',
        title: t('title.dateJoined'),
        basis: '20%',
        minWidth: 200,
      },
      {
        key: 'action',
        title: '',
        width: 110,
        minWidth: 110,
        justify: 'justify-end',
      },
    ] as NcTableColumnProps[],
)

const customRow = () => ({
  class: 'user-row',
})

const isOnlyOneOwner = computed(() => {
  return collaborators.value?.filter((collab) => collab.roles === ProjectRoles.OWNER).length === 1
})

const isDeleteOrUpdateAllowed = (user) => {
  return !(isOnlyOneOwner.value && user.roles === ProjectRoles.OWNER)
}

// Straight to the Base Type row. The old `?page=base-settings&tab=baseType` form
// only landed there by accident: the redirect middleware drops `tab`.
const goToBaseSettings = () => {
  openBaseSettings('base-type')
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
      'nc-is-settings-sidebar': isSettingsSidebar,
      'h-full min-h-0': !isAdminPanel,
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
            class="!hover:(text-nc-content-gray underline-nc-gray-600) flex items-center !text-nc-content-gray-subtle !underline-transparent max-w-1/4"
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
              <GeneralBaseIconColorPicker
                :managed-app="{
                  managed_app_master: currentBase?.managed_app_master,
                  managed_app_id: currentBase?.managed_app_id,
                }"
                readonly
              />
            </div>
          </template>
          <template #title>
            <span data-rec="true" class="capitalize">
              {{ currentBase?.title }}
            </span>
          </template>
        </NcPageHeader>
      </div>

      <!-- pt-3, not pt-6: lines the search box up with the settings shell's rail search. -->
      <div class="flex-1 min-h-0 flex flex-col nc-shell-gutter pb-6 pt-3" :class="{ 'nc-content-max-w': isAdminPanel }">
        <NcAlert
          v-if="isEeUI && isPrivateBase"
          type="info"
          :message="$t('title.privateBase')"
          class="mb-6 bg-nc-bg-gray-extralight"
        >
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
        <!-- Wraps rather than squeezes — a search box below its placeholder width is just an icon. -->
        <div v-if="!isAdminPanel" class="mb-6 flex flex-wrap items-center justify-between gap-3">
          <a-input
            v-model:value="userSearchText"
            :placeholder="isTeamsEnabled && showEEFeatures ? $t('title.searchForMembersOrTeams') : $t('title.searchMembers')"
            :disabled="isLoading"
            allow-clear
            class="nc-input-border-on-value flex-1 !min-w-60 !max-w-90 nc-input-sm"
          >
            <template #prefix>
              <GeneralIcon icon="search" class="mr-2 h-4 w-4 text-nc-content-gray-muted" />
            </template>
          </a-input>

          <!-- Narrowing controls: which role, and where the role came from. -->
          <div class="flex flex-wrap items-center gap-2">
            <NcSelect
              v-model:value="roleFilter"
              class="nc-base-members-filter flex-none !w-36"
              :disabled="isLoading"
              data-testid="nc-base-members-role-filter"
              dropdown-class-name="nc-base-members-role-filter-dropdown"
            >
              <a-select-option v-for="option in roleFilterOptions" :key="option.value" :value="option.value">
                <div class="flex items-center gap-2">
                  <GeneralIcon
                    v-if="'icon' in option"
                    :icon="option.icon"
                    class="flex-none h-4 w-4"
                    :class="roleColorsMapping[option.color]?.content"
                  />
                  <span :class="'color' in option ? roleColorsMapping[option.color]?.content : ''">{{ option.label }}</span>
                </div>
              </a-select-option>
            </NcSelect>

            <NcSelect
              v-model:value="memberFilter"
              class="nc-base-members-filter flex-none !w-36"
              option-label-prop="label"
              :dropdown-match-select-width="false"
              :disabled="isLoading"
              data-testid="nc-base-members-source-filter"
              dropdown-class-name="nc-base-members-source-filter-dropdown"
            >
              <template v-for="option in memberFilterOptions" :key="option.value">
                <a-select-option v-if="option.divider" :value="option.value" disabled class="nc-source-filter-divider">
                  <div class="border-t-1 border-nc-border-gray-medium"></div>
                </a-select-option>
                <a-select-option v-else :value="option.value" :label="option.label">
                  <div class="flex flex-col gap-0.5 py-0.5">
                    <span>{{ option.label }}</span>
                    <span class="text-bodySm text-nc-content-gray-subtle2">{{ option.description }}</span>
                  </div>
                </a-select-option>
              </template>
            </NcSelect>

            <NcSelect
              v-if="app"
              v-model:value="teamFilter"
              class="nc-base-members-filter flex-none !w-36"
              :disabled="isLoading"
              data-testid="nc-base-members-app-team-filter"
            >
              <a-select-option v-for="option in teamFilterOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </a-select-option>
            </NcSelect>
          </div>

          <ShellActions>
            <div class="flex items-center gap-2.5">
              <NcButton
                v-if="canAddTeams"
                v-e="['c:base:team-add']"
                size="small"
                type="secondary"
                :disabled="isLoading"
                data-testid="nc-add-teams-btn"
                text-color="primary"
                @click="addTeams()"
              >
                <div class="flex items-center gap-2">
                  <GeneralIcon icon="ncBuilding" />
                  <span>{{ $t('labels.addTeams') }}</span>
                </div>
              </NcButton>

              <NcButton size="small" type="primary" :disabled="isLoading" data-testid="nc-add-member-btn" @click="addMembers()">
                <div class="flex items-center gap-2">
                  <GeneralIcon :icon="isTeamsEnabled ? 'ncUsers' : 'plus'" class="h-4 w-4" />
                  <span>{{ $t('activity.addMembers') }}</span>
                </div>
              </NcButton>
            </div>
          </ShellActions>
        </div>

        <div class="flex-1 min-h-0 flex flex-col gap-6">
          <SmartsheetAppMembersPassNotice
            v-if="isEeUI && app && !userSearchText"
            :app="app"
            :teams="app.teams"
            :rows="passNoticeRows"
            :count="app.guests_without_team"
            @show-them="teamFilter = 'none'"
          />

          <NcTable
            v-model:order-by="orderBy"
            hide-on-empty
            :is-data-loading="isLoading"
            :columns="columns"
            :data="sortedCollaborators"
            :custom-row="customRow"
            class="nc-collaborators-list max-h-full min-h-0 max-w-full"
            body-row-class-name="!cursor-default"
            :pagination="true"
            :pagination-offset="25"
          >
            <template #emptyText>
              <ShellEmpty :title="userSearchText ? $t('title.noResultsMatchedYourSearch') : $t('title.noMembersFound')" />
            </template>

            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'email' && record.isTeam">
                <GeneralTeamInfo :team="transformToTeamObject(record, teamsMap[record.id])" show-breadcrumb />
                <NcBadge v-if="teamsMap[record.id]?.scope === 'org'" :border="false" color="blue" size="xs" class="flex-none">
                  {{ $t('general.orgBadge') }}
                </NcBadge>
              </template>

              <div v-else-if="column.key === 'email' && record.isAgent" class="w-full flex gap-3 items-center users-email-grid">
                <div class="nc-agent-member-icon flex-none">
                  <LazyGeneralEmojiPicker :key="record.meta?.icon" :emoji="record.meta?.icon" size="small" readonly>
                    <template #default>
                      <GeneralIcon icon="ncAgent" class="nc-agent-icon w-4 text-nc-content-gray-subtle !text-[16px]" />
                    </template>
                  </LazyGeneralEmojiPicker>
                </div>
                <div class="flex flex-col flex-1 max-w-[calc(100%_-_44px)]">
                  <div class="flex gap-2 items-center">
                    <NcTooltip class="truncate max-w-full text-captionMedium text-nc-content-gray" show-on-truncate-only>
                      <template #title>
                        {{ record.title }}
                      </template>
                      {{ record.title }}
                    </NcTooltip>
                    <NcBadge :border="false" color="purple" size="xs" class="flex-none">
                      {{ $t('general.agent') }}
                    </NcBadge>
                  </div>
                  <NcTooltip
                    v-if="record.email"
                    class="truncate max-w-full text-bodySm text-nc-content-gray-subtle2"
                    show-on-truncate-only
                  >
                    <template #title>
                      {{ record.email }}
                    </template>
                    {{ record.email }}
                  </NcTooltip>
                </div>
              </div>

              <div v-else-if="column.key === 'email'" class="w-full flex gap-3 items-center users-email-grid">
                <GeneralUserIcon size="base" :user="record" class="flex-none" />
                <div class="flex flex-col flex-1 max-w-[calc(100%_-_44px)]">
                  <div class="flex gap-3">
                    <NcTooltip class="truncate max-w-full text-captionMedium text-nc-content-gray" show-on-truncate-only>
                      <template #title>
                        {{ extractUserDisplayNameOrEmail(record) }}
                      </template>
                      {{ extractUserDisplayNameOrEmail(record) }}
                    </NcTooltip>
                  </div>
                  <NcTooltip class="truncate max-w-full text-bodySm text-nc-content-gray-subtle2" show-on-truncate-only>
                    <template #title>
                      {{ record.email }}
                    </template>
                    {{ record.email }}
                  </NcTooltip>
                </div>
              </div>
              <div v-if="column.key === 'role'" class="flex flex-col gap-1">
                <template
                  v-if="
                    isDeleteOrUpdateAllowed(record) &&
                    isOwnerOrCreator &&
                    (getTeamCompatibleAccessibleRoles(accessibleRoles, record).includes(record.roles) ||
                      record.roles === ProjectRoles.INHERIT)
                  "
                >
                  <RolesSelectorV2
                    plain
                    :role="getInheritanceInfo(record) ? ProjectRoles.INHERIT : record.roles"
                    :roles="getTeamCompatibleAccessibleRoles(accessibleRoles, record)"
                    :inherit="getInheritanceInfo(record) ? getInheritanceInfo(record)?.effectiveRole : undefined"
                    :inherit-source="getInheritanceInfo(record)?.source"
                    :effective-role="getInheritanceInfo(record)?.effectiveRole"
                    :show-inherit="!!getInheritanceInfo(record)"
                    :on-role-change="(role) => onRoleChange(record, role as ProjectRoles)"
                  />
                </template>
                <template v-else>
                  <RolesBadge
                    plain
                    :border="false"
                    :role="getInheritanceInfo(record) ? getInheritanceInfo(record)?.effectiveRole : record.roles"
                  />
                  <div v-if="getInheritanceInfo(record)" class="flex items-center gap-1 text-xs text-nc-content-gray-muted">
                    <GeneralIcon icon="role_inherit" class="h-3 w-3" />
                    <span>{{
                      getInheritanceInfo(record)?.source === 'team'
                        ? $t('tooltip.roleInheritedFromTeam')
                        : $t('tooltip.roleInheritedFromWorkspace')
                    }}</span>
                  </div>
                </template>
                <div
                  v-if="isOwnerOrCreator && !record.isTeam && !record.isAgent && stillOnAppTeams(record)"
                  class="text-xs text-nc-content-gray-muted truncate"
                  data-testid="nc-base-member-still-on-app-team"
                >
                  {{ $t('labels.appAccess.stillOnAppTeam', { teams: stillOnAppTeams(record) }) }}
                </div>
              </div>
              <div
                v-if="column.key === 'seat' && !record.isTeam && !record.isAgent && record.seat_type"
                class="flex items-center"
              >
                <NcTooltip
                  :disabled="!seatTooltip(record.seat_type)"
                  :title="seatTooltip(record.seat_type)"
                  class="flex items-center"
                >
                  <component
                    :is="canOpenSeatDetail ? 'button' : 'div'"
                    v-e="['c:workspace:member:billable-detail']"
                    class="nc-seat-type-badge flex items-center border-none p-0 bg-transparent"
                    :class="{ 'cursor-pointer': canOpenSeatDetail }"
                    data-testid="nc-seat-type-badge"
                    @click="openSeatDetail(record)"
                  >
                    <WorkspaceSeatTypeBadge :seat-type="record.seat_type" />
                  </component>
                </NcTooltip>
              </div>
              <ProjectAppTeamsCell
                v-if="isEeUI && app && column.key === 'app_teams' && !record.isTeam && !record.isAgent"
                :user="record"
                :app="app"
                :teams="app.teams"
                :can-manage="!!isOwnerOrCreator"
                :reason="appMembershipReason"
              />
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
                  <NcButton size="small" type="secondary" class="nc-row-action">
                    <GeneralIcon icon="threeDotVertical" />
                  </NcButton>
                  <template #overlay>
                    <NcMenu variant="small">
                      <NcMenuItem
                        v-if="canOpenSeatDetail && !record.isTeam && !record.isAgent && (hasSeatData || app)"
                        data-testid="nc-base-member-apps-and-seat"
                        @click="openSeatDetail(record)"
                      >
                        <GeneralIcon icon="ncApp" class="h-4 w-4" />
                        {{ $t('labels.appAccess.appsAndSeat') }}
                      </NcMenuItem>
                      <NcMenuItemCopyId
                        :id="record.id"
                        :tooltip="
                          record.isAgent
                            ? $t(`labels.clickToCopyAgentID`)
                            : record.isTeam
                            ? $t(`labels.clickToCopyTeamID`)
                            : $t(`labels.clickToCopyUserID`)
                        "
                        :label="
                          record.isAgent
                            ? $t(`labels.agentIdColon`, { agentId: record.id })
                            : record.isTeam
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

      <WorkspaceBillableDetailModal
        v-if="isEeUI && activeWorkspaceId && seatDetailUser"
        v-model:visible="isSeatDetailModalOpen"
        :workspace-id="activeWorkspaceId"
        :user="seatDetailUser"
      />

      <NcModalConfirm
        v-model:visible="roleConfirm.visible"
        :ok-text="$t('general.confirm')"
        :show-icon="false"
        :keyboard="true"
        :mask-closable="true"
        data-testid="nc-base-member-role-confirm"
        @ok="onConfirmRoleChange"
      >
        <template #title>
          <div class="inline-flex !align-top mr-2">
            {{ $t('labels.appAccess.changeRoleTitle', { name: extractUserDisplayNameOrEmail(roleConfirm.collab ?? {}) }) }}
          </div>
          <RolesBadge :border="false" :role="roleConfirm.role" class="inline-flex text-body" />
        </template>
        <template #extraContent>
          <div class="flex flex-col gap-4 text-caption text-nc-content-gray">
            <div v-if="roleConfirm.seatLine" data-testid="nc-base-member-role-seat-line">{{ roleConfirm.seatLine }}</div>

            <div v-if="roleConfirm.hasExplicitAppTeams && app" class="flex items-start gap-3">
              <NcCheckbox v-model:checked="roleConfirm.removeFromApp" data-testid="nc-base-member-also-remove-from-app" />
              <div class="flex flex-col gap-1">
                <div class="font-semibold">{{ $t('labels.appAccess.alsoRemoveFromApp', { app: app.title }) }}</div>
                <div class="text-nc-content-gray-subtle">{{ $t('labels.appAccess.removeFromAppBody') }}</div>
              </div>
            </div>

            <div v-for="team in roleConfirm.viaTeams" :key="team" class="text-nc-content-gray-subtle">
              {{ $t('labels.appAccess.viaTeamRemoveInApp', { team }) }}
            </div>
          </div>
        </template>
      </NcModalConfirm>
    </template>
  </div>
</template>

<style scoped lang="scss">
/* The role chip is a table cell, so it reads at the table's own size. */
:deep(.nc-role-badge .badge-text) {
  @apply text-bodyDefaultSm;
}

.color-band {
  @apply w-6 h-6 left-0 top-2.5 rounded-full flex justify-center uppercase text-base-white font-weight-bold text-xs items-center;
}

:deep(.nc-collaborator-role-select .ant-select-selector) {
  @apply !rounded;
}

/* NcSelect renders its value semibold by default; a filter is not an emphasis. */
.nc-base-members-filter {
  :deep(.ant-select-selection-item) {
    @apply !font-normal;
  }
}

.nc-page-header-icon {
  :deep(svg) {
    @apply h-4.5 w-4.5;
  }
}
</style>

<style lang="scss">
/* Dropdowns render in a portal — scoped styles can't reach them. */
.nc-base-members-role-filter-dropdown,
.nc-base-members-source-filter-dropdown {
  .ant-select-item-option-content {
    @apply text-bodyDefaultSm;
  }
}

.nc-base-members-source-filter-dropdown {
  .nc-source-filter-divider {
    @apply !min-h-0 !py-1 !px-3 !cursor-default;

    &.ant-select-item-option-disabled {
      @apply !bg-transparent;
    }
  }
}
</style>
