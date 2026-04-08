<script setup lang="ts">
import { TeamUserRoles, WorkspaceUserRoles } from 'nocodb-sdk'
import type { TeamV3ResponseType } from 'nocodb-sdk'

type TeamRow = TeamV3ResponseType & { _treeDepth?: number }

interface Props {
  orgId?: string
}

const props = withDefaults(defineProps<Props>(), {
  orgId: undefined,
})

const { $api, $e } = useNuxtApp()

const router = useRouter()

const route = router.currentRoute

const { t } = useI18n()

const { isMobileMode, appInfo } = useGlobal()

// Use prop if provided (on-prem account page), fallback to route param (cloud org admin)
const orgId = computed(() => props.orgId || (route.value.params.orgId as string))

const teams = ref<TeamV3ResponseType[]>([])

const isLoading = ref(false)

const searchQuery = ref('')

const isCreateModalVisible = ref(false)

const createTeamParentId = ref<string | null>(null)

const newTeamTitle = ref('')

const isCreating = ref(false)

const inputEl = ref<HTMLInputElement>()

// Edit modal state
const editTeamId = ref<string | null>(null)

const editTeam = ref<any>(null)

const editTeamMembers = ref<any[]>([])

const isEditModalOpen = ref(false)

const isEditLoading = ref(false)

const memberSearchQuery = ref('')

const filteredEditMembers = computed(() => {
  if (!memberSearchQuery.value) return editTeamMembers.value
  return editTeamMembers.value.filter((m: any) =>
    searchCompare([m.user_display_name, m.user_email], memberSearchQuery.value),
  )
})

// Tree view
const viewMode = ref<'flat' | 'tree'>('tree')

const expandedTeams = ref(new Set<string>())

const toggleExpand = (teamId: string) => {
  if (expandedTeams.value.has(teamId)) {
    expandedTeams.value.delete(teamId)
  } else {
    expandedTeams.value.add(teamId)
  }
}

const hasChildren = (teamId: string) => {
  return teams.value.some((t) => t.fk_parent_team_id === teamId)
}

const flattenedTreeTeams = computed(() => {
  if (viewMode.value !== 'tree') return []

  const result: (TeamV3ResponseType & { _treeDepth: number })[] = []

  if (searchQuery.value) {
    return teams.value
      .filter((team) => searchCompare([team.title], searchQuery.value))
      .map((team) => ({ ...team, _treeDepth: 0 }))
  }

  const childrenMap = new Map<string | null, TeamV3ResponseType[]>()
  for (const team of teams.value) {
    const parentId = team.fk_parent_team_id || null
    if (!childrenMap.has(parentId)) childrenMap.set(parentId, [])
    childrenMap.get(parentId)!.push(team)
  }

  const walk = (parentId: string | null, depth: number) => {
    const children = childrenMap.get(parentId) || []
    for (const child of children) {
      result.push({ ...child, _treeDepth: depth } as TeamRow)
      if (expandedTeams.value.has(child.id)) {
        walk(child.id, depth + 1)
      }
    }
  }

  walk(null, 0)
  return result
})

const filteredTeams = computed(() => {
  if (!searchQuery.value) return teams.value
  return teams.value.filter((t) => searchCompare([t.title], searchQuery.value))
})

const tableData = computed(() => {
  return viewMode.value === 'tree' ? flattenedTreeTeams.value : filteredTeams.value
})

// API methods
const loadTeams = async () => {
  if (!orgId.value) return

  try {
    isLoading.value = true
    const response = await $api.instance.get(`/api/v3/meta/orgs/${orgId.value}/teams`)
    teams.value = (response.data?.list || []).filter((t: TeamV3ResponseType) => t.scope === 'org')
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isLoading.value = false
  }
}

const loadTeamDetail = async (teamId: string) => {
  try {
    isEditLoading.value = true
    const response = await $api.instance.get(`/api/v3/meta/orgs/${orgId.value}/teams/${teamId}`)
    editTeam.value = response.data
    editTeamMembers.value = response.data?.members || []
    selectedParentId.value = response.data?.fk_parent_team_id || null
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isEditLoading.value = false
  }
}

const handleCreateTeam = (parentId?: string | null) => {
  createTeamParentId.value = parentId || null
  newTeamTitle.value = generateUniqueTitle('Team', teams.value ?? [], 'title', '-', true)
  isCreateModalVisible.value = true
  nextTick(() => {
    inputEl.value?.focus()
    inputEl.value?.select()
  })
}

const isDuplicateTeamName = computed(() => {
  if (!newTeamTitle.value?.trim()) return false
  return teams.value.some((t) => t.title?.toLowerCase() === newTeamTitle.value.trim().toLowerCase())
})

const createTeam = async () => {
  if (!newTeamTitle.value.trim() || !orgId.value || isCreating.value || isDuplicateTeamName.value) return

  try {
    isCreating.value = true
    await $api.instance.post(`/api/v3/meta/orgs/${orgId.value}/teams`, {
      title: newTeamTitle.value.trim(),
      ...(createTeamParentId.value ? { parent_team_id: createTeamParentId.value } : {}),
    })
    isCreateModalVisible.value = false
    newTeamTitle.value = ''
    if (createTeamParentId.value) {
      expandedTeams.value.add(createTeamParentId.value)
    }
    createTeamParentId.value = null
    await loadTeams()
    $e('a:org-team:create')
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    setTimeout(() => {
      isCreating.value = false
    }, 500)
  }
}

const _updateTeamTitle = async (teamId: string, title: string) => {
  if (!title?.trim()) return

  try {
    await $api.instance.patch(`/api/v3/meta/orgs/${orgId.value}/teams/${teamId}`, { title: title.trim() })
    await loadTeams()
    $e('a:org-team:update-title', { teamId })
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const updateTeamTitle = useDebounceFn(_updateTeamTitle, 1000)

const handleEditTeam = (team: TeamV3ResponseType) => {
  if (!team?.id) return

  editTeamId.value = team.id
  isEditModalOpen.value = true
  loadTeamDetail(team.id)

  $e('c:org-team:edit', { teamId: team.id })
}

const closeEditModal = async () => {
  // Flush any pending debounced title update before closing
  if (editTeamId.value && editTeam.value?.title) {
    updateTeamTitle.flush()
  }
  isEditModalOpen.value = false
  editTeamId.value = null
  editTeam.value = null
  editTeamMembers.value = []
  selectedParentId.value = null
  memberSearchQuery.value = ''
}

// Parent team editing
const selectedParentId = ref<string | null>(null)
const isMoving = ref(false)

const getTeamDescendantIds = (teamId: string): string[] => {
  const ids: string[] = []
  const children = teams.value.filter((t) => t.fk_parent_team_id === teamId)
  for (const child of children) {
    ids.push(child.id)
    ids.push(...getTeamDescendantIds(child.id))
  }
  return ids
}

const editParentTeamOptions = computed(() => {
  if (!editTeamId.value) return []

  const descendantIds = new Set(getTeamDescendantIds(editTeamId.value))

  const eligible = (teams.value || []).filter((t) => {
    if (t.id === editTeamId.value) return false
    if (descendantIds.has(t.id)) return false
    if ((t.depth ?? 0) >= 3) return false
    return true
  })

  const childrenMap = new Map<string | null, typeof eligible>()
  for (const t of eligible) {
    const parentId = t.fk_parent_team_id || null
    if (!childrenMap.has(parentId)) childrenMap.set(parentId, [])
    childrenMap.get(parentId)!.push(t)
  }

  for (const siblings of childrenMap.values()) {
    siblings.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''))
  }

  const ordered: typeof eligible = []
  const walk = (parentId: string | null) => {
    for (const child of childrenMap.get(parentId) ?? []) {
      ordered.push(child)
      walk(child.id)
    }
  }
  walk(null)
  return ordered
})

const handleMoveTeam = async () => {
  if (isMoving.value || !editTeamId.value) return

  try {
    isMoving.value = true
    await $api.instance.patch(`/api/v3/meta/orgs/${orgId.value}/teams/${editTeamId.value}/move`, {
      parent_team_id: selectedParentId.value,
    })
    message.success(t('msg.success.teamMoved'))
    await loadTeams()
    await loadTeamDetail(editTeamId.value)
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isMoving.value = false
  }
}

const handleConfirm = ({
  title,
  content,
  okText,
  cancelText,
  okCallback = () => Promise.resolve(),
}: {
  title: string
  content: string
  okText?: string
  cancelText?: string
  okCallback?: () => Promise<void>
}) => {
  const isOpen = ref(true)
  const okProps = ref({ loading: false, type: 'danger' })

  const { close } = useDialog(resolveComponent('NcModalConfirm'), {
    'visible': isOpen,
    'title': title,
    'content': content,
    'okText': okText,
    'cancelText': cancelText,
    'onCancel': closeDialog,
    'onOk': async () => {
      okProps.value.loading = true
      await okCallback()
      okProps.value.loading = false
      closeDialog()
    },
    'okProps': okProps,
    'update:visible': closeDialog,
    'showIcon': false,
    'maskClosable': true,
  })

  function closeDialog() {
    isOpen.value = false
    close(1000)
  }
}

const handleDeleteTeam = (team: TeamV3ResponseType) => {
  const teamHasChildren = hasChildren(team.id)

  handleConfirm({
    title: teamHasChildren ? t('objects.teams.confirmDeleteTeamWithChildrenTitle') : t('objects.teams.confirmDeleteTeamTitle'),
    content: teamHasChildren
      ? t('objects.teams.confirmDeleteOrgTeamWithChildrenSubtitle')
      : t('objects.teams.confirmDeleteOrgTeamSubtitle'),
    okText: t('activity.deleteTeam'),
    cancelText: t('labels.cancel'),
    okCallback: async () => {
      try {
        await $api.instance.delete(`/api/v3/meta/orgs/${orgId.value}/teams/${team.id}${teamHasChildren ? '?force=true' : ''}`)
        await loadTeams()
        message.success(t('msg.success.teamDeleted'))
      } catch (e: any) {
        message.error(await extractSdkResponseErrorMsg(e))
      }
    },
  })
}

// Move team state
const isMoveModalVisible = ref(false)
const moveTeamTarget = ref<TeamV3ResponseType | null>(null)

const handleOpenMoveTeam = (team: TeamV3ResponseType) => {
  moveTeamTarget.value = team
  isMoveModalVisible.value = true
}

const moveSelectedParentId = ref<string | null>(null)
const isMoveLoading = ref(false)

const moveParentOptions = computed(() => {
  if (!moveTeamTarget.value) return []
  const target = moveTeamTarget.value
  const descendantIds = new Set<string>()

  // Collect all descendants to prevent circular moves
  const collectDescendants = (parentId: string) => {
    for (const t of teams.value) {
      if (t.fk_parent_team_id === parentId) {
        descendantIds.add(t.id!)
        collectDescendants(t.id!)
      }
    }
  }
  collectDescendants(target.id!)

  return (teams.value || []).filter((t) => {
    if (t.id === target.id) return false
    if (descendantIds.has(t.id)) return false
    if ((t.depth ?? 0) >= 3) return false
    return true
  })
})

const moveHasChanged = computed(() => {
  if (!moveTeamTarget.value) return false
  const currentParent = moveTeamTarget.value?.fk_parent_team_id || null
  return moveSelectedParentId.value !== currentParent
})

const handleMoveTeamSubmit = async () => {
  if (isMoveLoading.value || !moveTeamTarget.value || !moveHasChanged.value) return

  try {
    isMoveLoading.value = true
    await $api.instance.patch(
      `/api/v3/meta/orgs/${orgId.value}/teams/${moveTeamTarget.value.id}/move`,
      { parent_team_id: moveSelectedParentId.value },
    )
    await loadTeams()
    message.success(t('msg.success.teamMoved'))
    isMoveModalVisible.value = false
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isMoveLoading.value = false
  }
}

watch(isMoveModalVisible, (val) => {
  if (val && moveTeamTarget.value) {
    moveSelectedParentId.value = moveTeamTarget.value?.fk_parent_team_id || null
  }
})

// Add members state
const isAddMembersOpen = ref(false)

const orgUsers = ref<any[]>([])

const selectedUserIds = ref<string[]>([])

const isAddingMembers = ref(false)

const loadOrgUsers = async () => {
  try {
    let data: any
    if (appInfo.value?.isCloud) {
      const response = await $api.instance.get(`/api/v2/orgs/${orgId.value}/users`)
      data = response.data
    } else {
      // On-prem uses /api/v1/users which returns { list, pageInfo }
      const response = await $api.orgUsers.list({ query: { limit: 1000 } } as any)
      data = response?.list || []
    }
    orgUsers.value = Array.isArray(data) ? data : data?.list || data?.users || []
  } catch (_e) {
    orgUsers.value = []
  }
}

const openAddMembers = async () => {
  selectedUserIds.value = editTeamMembers.value.map((m: any) => m.user_id)
  await loadOrgUsers()
  isAddMembersOpen.value = true
}

const ncListData = computed(() => {
  const existingIds = new Set(editTeamMembers.value.map((m: any) => m.user_id))
  return (orgUsers.value || []).map((u: any) => ({
    ...u,
    id: u.id,
    fk_user_id: u.id,
    email: u.email,
    display_name: u.display_name,
    ncItemDisabled: existingIds.has(u.id),
    ncItemTooltip: existingIds.has(u.id) ? t('objects.teams.alreadyPartOfTeam') : '',
  }))
})

const selectedNewUsers = computed(() => {
  const existingIds = new Set(editTeamMembers.value.map((m: any) => m.user_id))
  return ncListData.value.filter((u: any) => selectedUserIds.value.includes(u.id) && !existingIds.has(u.id))
})

const handleAddMembers = async () => {
  if (!editTeamId.value || selectedNewUsers.value.length === 0) return

  try {
    isAddingMembers.value = true
    await $api.instance.post(
      `/api/v3/meta/orgs/${orgId.value}/teams/${editTeamId.value}/members`,
      selectedNewUsers.value.map((u: any) => ({
        user_id: u.id,
        team_role: TeamUserRoles.MEMBER,
      })),
    )
    isAddMembersOpen.value = false
    await loadTeamDetail(editTeamId.value)
    await loadTeams()
    message.success(t('activity.membersAdded'))
    $e('a:org-team:members-add', { teamId: editTeamId.value, count: selectedNewUsers.value.length })
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isAddingMembers.value = false
  }
}

const toggleUser = (userId: string) => {
  if (selectedUserIds.value.includes(userId)) {
    selectedUserIds.value = selectedUserIds.value.filter((id) => id !== userId)
  } else {
    selectedUserIds.value.push(userId)
  }
}

const teamOwners = computed(() => {
  return editTeamMembers.value.filter((m: any) => m.team_role === TeamUserRoles.OWNER)
})

const isSoleOwner = (userId: string) => {
  return teamOwners.value.length <= 1 && teamOwners.value.some((m: any) => m.user_id === userId)
}

const isTeamOwner = (member: any) => {
  return member.team_role === TeamUserRoles.OWNER
}

const handleRemoveMember = async (userId: string) => {
  if (!editTeamId.value) return

  try {
    await $api.instance.delete(`/api/v3/meta/orgs/${orgId.value}/teams/${editTeamId.value}/members`, {
      data: [{ user_id: userId }],
    })
    editTeamMembers.value = editTeamMembers.value.filter((m: any) => m.user_id !== userId)
    await loadTeams()
    $e('a:org-team:member-remove', { teamId: editTeamId.value })
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const handlePromoteToOwner = async (userId: string) => {
  if (!editTeamId.value) return

  try {
    await $api.instance.patch(`/api/v3/meta/orgs/${orgId.value}/teams/${editTeamId.value}/members`, [
      { user_id: userId, team_role: TeamUserRoles.OWNER },
    ])
    const member = editTeamMembers.value.find((m: any) => m.user_id === userId)
    if (member) member.team_role = TeamUserRoles.OWNER
    $e('a:org-team:member-promote', { teamId: editTeamId.value })
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const handleDemoteFromOwner = async (userId: string) => {
  if (!editTeamId.value) return

  try {
    await $api.instance.patch(`/api/v3/meta/orgs/${orgId.value}/teams/${editTeamId.value}/members`, [
      { user_id: userId, team_role: TeamUserRoles.MEMBER },
    ])
    const member = editTeamMembers.value.find((m: any) => m.user_id === userId)
    if (member) member.team_role = TeamUserRoles.MEMBER
    $e('a:org-team:member-demote', { teamId: editTeamId.value })
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

// Build user map for Creator column — key by both id and fk_user_id
const collaboratorsMap = computed<Record<string, any>>(() => {
  const map: Record<string, any> = {}
  for (const u of orgUsers.value) {
    if (u.id) map[u.id] = u
    if (u.fk_user_id) map[u.fk_user_id] = u
  }
  return map
})

// Table columns — matches workspace teams layout
const columns = computed(() => [
  {
    key: 'teamName',
    title: t('labels.teamName'),
    minWidth: 220,
    showOrderBy: true,
  },
  {
    key: 'badge',
    title: t('labels.badge'),
    basis: '25%',
    minWidth: 252,
  },
  {
    key: 'owner',
    title: t('title.creator'),
    basis: '25%',
    minWidth: 252,
    showOrderBy: true,
  },
  {
    key: 'action',
    title: t('labels.actions'),
    width: 110,
    minWidth: 110,
    justify: 'justify-end',
  },
])

const customRow = (record: Record<string, any>) => ({
  onClick: () => handleEditTeam(record as TeamV3ResponseType),
})

// Parent team options for create dialog
const parentTeamOptions = computed(() => {
  return (teams.value || []).filter((t) => (t.depth ?? 0) < 3)
})

// Expand parent teams by default
watch(
  teams,
  (newTeams) => {
    if (newTeams?.length) {
      const parentIds = new Set<string>()
      for (const t of newTeams as TeamV3ResponseType[]) {
        if (t.fk_parent_team_id) {
          parentIds.add(t.fk_parent_team_id)
        }
      }
      expandedTeams.value = parentIds
    }
  },
  { immediate: true },
)

onMounted(() => {
  loadTeams()
  loadOrgUsers()
})
</script>

<template>
  <div class="nc-teams-container overflow-auto nc-scrollbar-thin relative h-[calc(100vh-144px)]" data-testid="nc-admin-teams">
    <div class="nc-teams-wrapper h-full max-w-[1200px] mx-auto p-4 md:p-6 flex flex-col gap-6 sticky top-0">
      <!-- Header -->
      <div class="w-full flex items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <a-input
            v-model:value="searchQuery"
            allow-clear
            :disabled="isLoading"
            class="nc-input-border-on-value !max-w-90 !h-8 !px-3 !py-1 !rounded-lg"
            :placeholder="$t('title.searchTeams')"
          >
            <template #prefix>
              <GeneralIcon
                icon="search"
                class="mr-2 h-4 w-4 text-nc-content-gray-muted group-hover:text-nc-content-gray-extreme"
              />
            </template>
          </a-input>

          <div class="flex items-center gap-0.5 border-1 border-nc-border-gray-medium rounded-lg p-0.5 min-h-8">
            <NcTooltip :title="$t('labels.flatView')" class="flex">
              <NcButton size="xsmall" :type="viewMode === 'flat' ? 'secondary' : 'text'" class="!px-0" @click="viewMode = 'flat'">
                <GeneralIcon icon="ncList" class="h-4 w-4" />
              </NcButton>
            </NcTooltip>
            <NcTooltip :title="$t('labels.treeView')" class="flex">
              <NcButton size="xsmall" :type="viewMode === 'tree' ? 'secondary' : 'text'" class="!px-0" @click="viewMode = 'tree'">
                <GeneralIcon icon="ncLayers" class="h-4 w-4" />
              </NcButton>
            </NcTooltip>
          </div>
        </div>

        <NcButton
          size="small"
          inner-class="!gap-2"
          :disabled="isLoading"
          data-testid="nc-admin-teams-create"
          class="capitalize"
          :icon-only="isMobileMode"
          @click="handleCreateTeam()"
        >
          <template #icon>
            <GeneralIcon icon="plus" class="h-4 w-4" />
          </template>
          <span class="xs:hidden">
            {{ $t('labels.newTeam') }}
          </span>
        </NcButton>
      </div>

      <!-- Teams table -->
      <NcTable
        :columns="columns"
        :data="tableData"
        :is-data-loading="isLoading"
        :bordered="false"
        class="flex-1 nc-teams-list"
        :pagination="viewMode === 'flat'"
        :pagination-offset="25"
        :custom-row="customRow"
      >
        <template #emptyText>
          <NcEmptyPlaceholder
            :title="teams.length ? '' : $t('msg.info.noTeamsFound')"
            :subtitle="teams.length ? $t('title.noResultsMatchedYourSearch') : $t('msg.info.noTeamsFoundSubtitle')"
          >
            <template #icon>
              <img
                v-if="!teams.length"
                src="~assets/img/placeholder/moscot-collaborators.png"
                alt="New Team"
                class="!w-[320px] flex-none"
              />
              <img
                v-else
                src="~assets/img/placeholder/no-search-result-found.png"
                alt="No search results found"
                class="!w-[320px] flex-none"
              />
            </template>
            <template #action>
              <NcButton size="small" inner-class="!gap-2" class="capitalize" @click="handleCreateTeam()">
                <template #icon>
                  <GeneralIcon icon="plus" class="h-4 w-4" />
                </template>
                {{ $t('labels.newTeam') }}
              </NcButton>
            </template>
          </NcEmptyPlaceholder>
        </template>

        <template #bodyCell="{ column, record }">
          <!-- Team name column -->
          <div v-if="column.key === 'teamName'" class="flex items-center gap-1">
            <div
              v-if="viewMode === 'tree'"
              :style="{ width: `${((record as TeamRow)._treeDepth || 0) * (isMobileMode ? 16 : 24)}px` }"
              class="flex-none"
            />
            <button
              v-if="viewMode === 'tree' && hasChildren(record.id)"
              class="flex-none w-5 h-5 flex items-center justify-center rounded hover:bg-nc-bg-gray-light cursor-pointer"
              @click.stop="toggleExpand(record.id)"
            >
              <GeneralIcon
                :icon="expandedTeams.has(record.id) ? 'ncChevronDown' : 'ncChevronRight'"
                class="h-4 w-4 text-nc-content-gray-muted"
              />
            </button>
            <div v-else-if="viewMode === 'tree'" class="flex-none w-5" />

            <GeneralTeamInfo :team="record" :icon-props="{ size: 'base', wrapperClass: '!rounded-lg' }">
              <template v-if="record.scim_managed" #title-append>
                <NcTooltip :title="$t('labels.scimManagedTeamTooltip')" class="flex items-center">
                  <NcBadge
                    :border="false"
                    color="blue"
                    class="text-nc-content-blue-dark text-[10px] leading-[14px] !h-[18px] font-semibold flex-none"
                  >
                    {{ $t('labels.scimManaged') }}
                  </NcBadge>
                </NcTooltip>
              </template>
            </GeneralTeamInfo>
          </div>

          <!-- Badge column -->
          <div v-if="column.key === 'badge'">
            <NcBadge class="uppercase">
              <GeneralTeamIcon v-if="record.icon" :team="record" icon-bg-color="transparent" />
              {{ getSafeInitials(record.title, 3) }}
            </NcBadge>
          </div>

          <!-- Creator column -->
          <div v-if="column.key === 'owner'" class="w-full flex gap-3 items-center">
            <template v-if="collaboratorsMap[record.created_by]">
              <GeneralUserIcon size="base" :user="collaboratorsMap[record.created_by]" class="flex-none" />
              <div class="flex flex-col flex-1 max-w-[calc(100%_-_44px)]">
                <div class="flex items-center gap-1">
                  <NcTooltip class="truncate max-w-full text-nc-content-gray capitalize text-captionBold" show-on-truncate-only>
                    <template #title>
                      {{ extractUserDisplayNameOrEmail(collaboratorsMap[record.created_by]) }}
                    </template>
                    {{ extractUserDisplayNameOrEmail(collaboratorsMap[record.created_by]) }}
                  </NcTooltip>
                </div>
                <NcTooltip class="truncate max-w-full text-xs text-nc-content-gray-muted" show-on-truncate-only>
                  <template #title>
                    {{ collaboratorsMap[record.created_by]?.email }}
                  </template>
                  {{ collaboratorsMap[record.created_by]?.email }}
                </NcTooltip>
              </div>
            </template>
          </div>

          <!-- Actions column -->
          <div v-if="column.key === 'action'" @click.stop>
            <NcDropdown placement="bottomRight">
              <NcButton size="small" type="secondary">
                <component :is="iconMap.ncMoreVertical" />
              </NcButton>
              <template #overlay>
                <NcMenu variant="medium">
                  <NcMenuItem
                    v-e="['c:org-team:edit', { teamId: record.id }]"
                    @click="handleEditTeam(record as TeamV3ResponseType)"
                  >
                    <GeneralIcon icon="ncEdit" class="h-4 w-4" />
                    {{ $t('general.edit') }}
                  </NcMenuItem>

                  <NcTooltip
                    :disabled="!record.scim_managed && (record.depth ?? 0) < 3"
                    :title="record.scim_managed ? $t('labels.scimManagedTeamSubTeamTooltip') : $t('msg.info.maxTeamNestingReached')"
                    placement="left"
                  >
                    <NcMenuItem
                      v-e="['c:org-team:add-sub-team', { teamId: record.id }]"
                      :disabled="record.scim_managed || (record.depth ?? 0) >= 3"
                      @click="!record.scim_managed && (record.depth ?? 0) < 3 && handleCreateTeam(record.id)"
                    >
                      <GeneralIcon icon="plus" class="h-4 w-4" />
                      {{ $t('labels.addSubTeam') }}
                    </NcMenuItem>
                  </NcTooltip>

                  <NcMenuItem
                    v-e="['c:org-team:move', { teamId: record.id }]"
                    @click="handleOpenMoveTeam(record as TeamV3ResponseType)"
                  >
                    <GeneralIcon icon="ncMove" class="h-4 w-4" />
                    {{ $t('labels.moveTeam') }}
                  </NcMenuItem>

                  <NcDivider />

                  <NcTooltip
                    :disabled="!record.scim_managed"
                    :title="$t('labels.scimManagedTeamRemovalTooltip')"
                    placement="left"
                  >
                    <NcMenuItem
                      v-e="['c:org-team:delete', { teamId: record.id }]"
                      :disabled="record.scim_managed"
                      danger
                      @click="handleDeleteTeam(record as TeamV3ResponseType)"
                    >
                      <GeneralIcon icon="delete" />
                      {{ $t('activity.deleteTeam') }}
                    </NcMenuItem>
                  </NcTooltip>
                </NcMenu>
              </template>
            </NcDropdown>
          </div>
        </template>
      </NcTable>
    </div>

    <!-- Create Team Modal -->
    <NcModal
      v-model:visible="isCreateModalVisible"
      :header="$t('labels.newTeam')"
      size="xs"
      height="auto"
      :centered="false"
      nc-modal-class-name="!p-0"
      class="!top-[25vh]"
      :mask-closable="!isCreating"
      wrap-class-name="nc-modal-team-create-wrapper"
    >
      <div class="py-4 md:py-5 flex flex-col gap-5">
        <div class="px-4 md:px-5 flex justify-between w-full items-center">
          <div class="flex flex-row items-center gap-x-2 text-base font-semibold text-nc-content-gray capitalize">
            <GeneralIcon icon="ncBuilding" class="!text-nc-content-gray-subtle2 w-5 h-5" />
            {{ $t('labels.newTeam') }}
          </div>
        </div>

        <a-form
          layout="vertical"
          name="create-new-org-team-form"
          class="flex flex-col gap-5 !px-4 md:!px-5"
          @keydown.enter="createTeam"
          @keydown.esc="isCreateModalVisible = false"
        >
          <a-form-item class="!mb-0">
            <a-input
              ref="inputEl"
              v-model:value="newTeamTitle"
              class="nc-team-input nc-input-sm nc-input-shadow"
              hide-details
              data-testid="nc-admin-teams-create-input"
              :placeholder="$t('placeholder.enterTeamName')"
            />
            <div v-if="isDuplicateTeamName" class="text-nc-content-red-medium text-xs mt-1">
              {{ $t('msg.error.duplicateTeamName') }}
            </div>
          </a-form-item>

          <!-- Parent team selector -->
          <a-form-item v-if="parentTeamOptions.length" class="!mb-0">
            <div class="flex gap-3 text-nc-content-gray h-7 mb-1 items-center">
              <span class="text-bodyDefaultSm">{{ $t('labels.parentTeam') }}</span>
            </div>
            <NcSelect
              v-model:value="createTeamParentId"
              :placeholder="$t('general.none')"
              allow-clear
              show-search
              :filter-option="(input: string, option: any) => option['data-label']?.toLowerCase().includes(input.toLowerCase())"
              class="w-full nc-select-shadow"
            >
              <a-select-option v-for="team in parentTeamOptions" :key="team.id" :value="team.id" :data-label="team.title">
                <div class="flex items-center gap-2" :style="{ paddingLeft: `${(team.depth ?? 0) * 16}px` }">
                  <GeneralTeamIcon :team="team" class="!w-5 !h-5 !min-w-5 flex-none !rounded-md" />
                  <NcTooltip class="truncate flex-1" show-on-truncate-only>
                    <template #title>{{ team.title }}</template>
                    {{ team.title }}
                  </NcTooltip>
                  <component
                    :is="iconMap.check"
                    v-if="createTeamParentId === team.id"
                    id="nc-selected-item-icon"
                    class="text-primary w-4 h-4 flex-none"
                  />
                </div>
              </a-select-option>
            </NcSelect>
          </a-form-item>

          <div class="flex flex-row items-center justify-end gap-x-2">
            <NcButton type="secondary" size="small" :disabled="isCreating" @click="isCreateModalVisible = false">
              {{ $t('general.cancel') }}
            </NcButton>
            <NcButton
              v-e="['a:org-team:create']"
              type="primary"
              size="small"
              :disabled="!newTeamTitle.trim() || isCreating || isDuplicateTeamName"
              :loading="isCreating"
              class="capitalize"
              data-testid="nc-admin-teams-create-submit"
              @click="createTeam"
            >
              {{ $t('labels.createTeam') }}
              <template #loading> {{ $t('labels.creatingTeam') }} </template>
            </NcButton>
          </div>
        </a-form>
      </div>
    </NcModal>

    <!-- Edit Team Modal -->
    <NcModal
      v-model:visible="isEditModalOpen"
      :header="false"
      size="md"
      :show-separator="false"
      wrap-class-name="nc-modal-teams"
      @update:visible="(val: boolean) => { if (!val) closeEditModal() }"
    >
      <div class="flex flex-col h-full">
        <!-- Header -->
        <div class="p-2 w-full flex items-center gap-3 border-b-1 border-nc-border-gray-medium">
          <div class="flex items-center">
            <GeneralIcon icon="ncBuilding" class="!h-6 !w-6 pl-1" />
          </div>
          <div class="flex-1 text-lg font-bold text-nc-content-gray-emphasis">
            {{ editTeam?.title }}
          </div>
          <NcButton size="small" type="text" @click="closeEditModal()">
            <GeneralIcon icon="close" />
          </NcButton>
        </div>

        <div class="h-[calc(100%_-_50px)] flex flex-col">
          <!-- Content -->
          <div class="flex-1 nc-modal-teams-edit-content overflow-auto">
            <div v-if="isEditLoading" class="flex-1 flex items-center justify-center h-full">
              <a-spin />
            </div>
            <template v-else-if="editTeam">
              <!-- Name section -->
              <div class="nc-modal-teams-edit-content-section mt-6">
                <a-form layout="vertical" class="flex flex-col gap-4">
                  <a-form-item class="!mb-0">
                    <template #label>
                      {{ $t('general.name') }}
                    </template>
                    <div class="relative">
                      <a-input
                        v-model:value="editTeam.title"
                        class="nc-team-input nc-input-sm nc-input-shadow !pl-38"
                        :placeholder="$t('placeholder.enterTeamName')"
                        @input="() => updateTeamTitle(editTeamId!, editTeam.title)"
                      >
                        <template #prefix>
                          <div class="w-6">&nbsp;</div>
                        </template>
                      </a-input>
                      <div class="absolute left-0 top-0 z-10">
                        <div class="border-1 w-8 h-8 flex-none rounded-lg overflow-hidden border-transparent !rounded-r-none border-r-nc-border-gray-medium">
                          <GeneralTeamIcon
                            :team="editTeam"
                            show-placeholder-icon
                            class="!w-full !h-full !min-w-full select-none !rounded-none"
                          />
                        </div>
                      </div>
                    </div>
                  </a-form-item>
                </a-form>

                <!-- Parent team -->
                <div class="mt-4">
                  <div class="text-bodyDefaultSm text-nc-content-gray mb-2">
                    {{ $t('labels.parentTeam') }}
                  </div>
                  <div class="flex items-center gap-2">
                    <NcSelect
                      v-model:value="selectedParentId"
                      :placeholder="$t('general.none')"
                      allow-clear
                      show-search
                      :filter-option="(input: string, option: any) => option['data-label']?.toLowerCase().includes(input.toLowerCase())"
                      class="flex-1 nc-select-shadow"
                      :disabled="isMoving"
                      @change="(val: any) => { selectedParentId = val ?? null }"
                    >
                      <a-select-option
                        v-for="pt in editParentTeamOptions"
                        :key="pt.id"
                        :value="pt.id"
                        :data-label="pt.title"
                      >
                        <div
                          class="flex items-center gap-2"
                          :style="{ paddingLeft: `${(pt.depth ?? 0) * 16}px` }"
                        >
                          <GeneralTeamIcon :team="pt" class="!w-5 !h-5 !min-w-5 flex-none !rounded-md" />
                          <NcTooltip class="truncate flex-1" show-on-truncate-only>
                            <template #title>{{ pt.title }}</template>
                            {{ pt.title }}
                          </NcTooltip>
                          <component
                            :is="iconMap.check"
                            v-if="selectedParentId === pt.id"
                            class="text-primary w-4 h-4 flex-none"
                          />
                        </div>
                      </a-select-option>
                    </NcSelect>
                    <NcButton
                      v-if="selectedParentId !== (editTeam.value?.fk_parent_team_id || null)"
                      size="small"
                      type="primary"
                      :loading="isMoving"
                      :disabled="isMoving"
                      @click="handleMoveTeam"
                    >
                      {{ $t('labels.moveTeam') }}
                    </NcButton>
                  </div>
                </div>
              </div>

              <!-- Members section -->
              <div class="nc-modal-teams-edit-content-section">
                <div class="flex flex-col gap-4">
                  <div class="text-bodyBold flex items-center gap-2">
                    {{ $t('labels.members') }}
                    <NcBadge v-if="!isEditLoading" size="xs" color="brand" :border="false" class="text-captionBold">
                      {{ editTeamMembers.length }}
                    </NcBadge>
                  </div>

                  <div class="flex items-center justify-between min-h-8">
                    <a-input
                      v-model:value="memberSearchQuery"
                      allow-clear
                      class="nc-input-border-on-value !max-w-90 !h-8 !px-3 !py-1 !rounded-lg"
                      :placeholder="`${$t('general.search')}...`"
                    >
                      <template #prefix>
                        <GeneralIcon icon="search" class="mr-2 h-4 w-4 text-nc-content-gray-muted" />
                      </template>
                    </a-input>

                    <NcTooltip :disabled="!editTeam?.scim_managed" :title="$t('labels.scimManagedTeamAddMemberTooltip')">
                      <NcButton
                        size="small"
                        type="secondary"
                        text-color="primary"
                        inner-class="!gap-2"
                        :disabled="editTeam?.scim_managed"
                        @click="openAddMembers"
                      >
                        <template #icon>
                          <GeneralIcon icon="ncUserPlus" class="h-4 w-4" />
                        </template>
                        {{ $t('activity.addMembers') }}
                      </NcButton>
                    </NcTooltip>
                  </div>
                </div>

                <!-- Members table header -->
                <div class="flex items-center px-1 py-2 border-b border-nc-border-gray-medium text-captionSm text-nc-content-gray-muted">
                  <div class="flex-1">{{ $t('objects.member') }}</div>
                  <div class="w-24 text-right">{{ $t('labels.actions') }}</div>
                </div>

                <div v-if="filteredEditMembers.length === 0" class="text-sm text-nc-content-gray-muted py-4 text-center">
                  {{ $t('title.noMembersFound') }}
                </div>

                <div v-else class="flex flex-col divide-y divide-nc-border-gray-light">
                  <div
                    v-for="member in filteredEditMembers"
                    :key="member.user_id"
                    class="flex items-center gap-3 py-3 px-1 group"
                  >
                    <NcUserInfo :user="{ email: member.user_email, display_name: member.user_display_name }" class="flex-1 min-w-0" />

                    <div class="w-24 flex justify-end">
                      <NcTooltip
                        :title="editTeam?.scim_managed ? $t('labels.scimManagedTeamAddMemberTooltip') : $t('activity.removeFromOrgTeam')"
                      >
                        <NcButton
                          size="small"
                          type="secondary"
                          class="md:invisible group-hover:visible !text-red-500"
                          :disabled="editTeam?.scim_managed"
                          @click="handleRemoveMember(member.user_id)"
                        >
                          <GeneralIcon icon="ncXSquare" class="h-4 w-4" />
                        </NcButton>
                      </NcTooltip>
                    </div>
                  </div>
                </div>

                <!-- Inherited members -->
                <template v-if="editTeam.inherited_members?.length">
                  <div class="mt-6">
                    <div class="text-bodyBold flex items-center gap-2 mb-4">
                      {{ $t('labels.inheritedMembers') }}
                      <NcBadge size="xs" color="gray" :border="false" class="text-captionBold">
                        {{ editTeam.inherited_members.length }}
                      </NcBadge>
                    </div>

                    <div class="flex flex-col divide-y divide-nc-border-gray-light">
                      <div
                        v-for="member in editTeam.inherited_members"
                        :key="member.user_id"
                        class="flex items-center justify-between py-3 px-1"
                      >
                        <NcUserInfo :user="{ email: member.user_email, display_name: member.user_display_name }" class="min-w-20 flex-1 overflow-hidden" />
                        <span class="text-captionSm text-nc-content-gray-muted flex-none ml-3">
                          {{ $t('labels.inheritedFrom', { team: member.inherited_from_team_title }) }}
                        </span>
                      </div>
                    </div>
                  </div>
                </template>
              </div>
            </template>
          </div>

          <!-- Info note -->
          <div class="mt-auto pt-2 px-6 pb-2 border-t border-nc-border-gray-medium bg-nc-bg-gray-light">
            <div class="flex items-center gap-2 text-captionSm text-nc-content-gray-muted">
              <GeneralIcon icon="ncInfo" class="h-4 w-4 flex-none" />
              <span>{{ $t('msg.info.orgTeamAdminNote') }}</span>
            </div>
          </div>
        </div>
      </div>
    </NcModal>

    <!-- Move Team Modal -->
    <NcModal
      v-model:visible="isMoveModalVisible"
      :header="$t('labels.moveTeam')"
      size="xs"
      height="auto"
      :centered="false"
      nc-modal-class-name="!p-0"
      class="!top-[25vh]"
      :mask-closable="!isMoveLoading"
      wrap-class-name="nc-modal-team-move-wrapper"
    >
      <div class="py-4 md:py-5 flex flex-col gap-5">
        <div class="px-4 md:px-5 flex justify-between w-full items-center">
          <div class="flex flex-row items-center gap-x-2 text-base font-semibold text-nc-content-gray capitalize">
            <GeneralIcon icon="ncMove" class="!text-nc-content-gray-subtle2 w-5 h-5" />
            {{ $t('labels.moveTeam') }}
          </div>
        </div>

        <div class="flex flex-col gap-5 !px-4 md:!px-5">
          <!-- Current team info -->
          <div>
            <div class="text-bodyDefaultSm text-nc-content-gray-subtle mb-1">{{ $t('objects.team') }}</div>
            <div class="flex items-center gap-2">
              <GeneralTeamIcon :team="moveTeamTarget" class="!w-6 !h-6 !min-w-6 flex-none !rounded-md" />
              <span class="text-sm font-medium text-nc-content-gray">{{ moveTeamTarget?.title }}</span>
            </div>
          </div>

          <!-- Parent team selector -->
          <div>
            <div class="text-bodyDefaultSm text-nc-content-gray mb-1">
              {{ $t('labels.parentTeam') }}
            </div>
            <NcSelect
              v-model:value="moveSelectedParentId"
              :placeholder="$t('general.none')"
              allow-clear
              show-search
              :disabled="isMoveLoading"
              :filter-option="(input: string, option: any) => option['data-label']?.toLowerCase().includes(input.toLowerCase())"
              class="w-full nc-select-shadow"
            >
              <a-select-option
                v-for="pt in moveParentOptions"
                :key="pt.id"
                :value="pt.id"
                :data-label="pt.title"
              >
                <div class="flex items-center gap-2" :style="{ paddingLeft: `${(pt.depth ?? 0) * 16}px` }">
                  <GeneralTeamIcon :team="pt" class="!w-5 !h-5 !min-w-5 flex-none !rounded-md" />
                  <NcTooltip class="truncate flex-1" show-on-truncate-only>
                    <template #title>{{ pt.title }}</template>
                    {{ pt.title }}
                  </NcTooltip>
                  <component
                    :is="iconMap.check"
                    v-if="moveSelectedParentId === pt.id"
                    class="text-primary w-4 h-4 flex-none"
                  />
                </div>
              </a-select-option>
            </NcSelect>
          </div>

          <!-- Actions -->
          <div class="flex flex-row items-center justify-end gap-2">
            <NcButton type="secondary" size="small" :disabled="isMoveLoading" @click="isMoveModalVisible = false">
              {{ $t('general.cancel') }}
            </NcButton>
            <NcButton
              v-e="['a:org-team:move']"
              type="primary"
              size="small"
              :disabled="!moveHasChanged || isMoveLoading"
              :loading="isMoveLoading"
              @click="handleMoveTeamSubmit"
            >
              {{ $t('labels.moveTeam') }}
            </NcButton>
          </div>
        </div>
      </div>
    </NcModal>

    <!-- Add Members Modal -->
    <GeneralModal
      v-model:visible="isAddMembersOpen"
      :mask-closable="false"
      :keyboard="!isAddingMembers"
      :mask-style="{ 'background-color': 'rgba(0, 0, 0, 0.08)' }"
      wrap-class-name="nc-modal-org-teams-add-members"
      :footer="null"
      class="!w-[448px]"
      :closable="false"
      @keydown.esc="isAddMembersOpen = false"
    >
      <div>
        <div class="flex items-center justify-between mb-2">
          <div class="text-subHeading2 text-nc-content-gray-emphasis">
            {{ $t('objects.teams.addMembersToTeam') }}
          </div>
        </div>

        <div class="text-body text-nc-content-gray-subtle mb-5">
          <span
            v-dompurify-html="$t('objects.teams.selectMembersToAddIntoTeam', { team: `<strong>${editTeam?.title}</strong>` })"
          ></span>
        </div>

        <NcList
          :open="isAddMembersOpen"
          :value="selectedUserIds"
          :list="ncListData"
          option-label-key="email"
          option-value-key="fk_user_id"
          :item-height="52"
          :search-input-placeholder="$t('title.searchMembers')"
          is-multi-select
          class="!w-auto border-1 border-nc-border-gray-medium rounded-lg"
          :filter-option="(input: string, option: any) => antSelectFilterOption(input, option, ['email', 'display_name'])"
          :empty-description="$t('title.noMembersFound')"
          item-tooltip-placement="left"
          @change="toggleUser($event.id)"
        >
          <template #listItemExtraLeft="{ isSelected, option }">
            <NcCheckbox :checked="isSelected" :disabled="option.ncItemDisabled" />
          </template>
          <template #listItemContent="{ option }">
            <div class="flex flex-col flex-1 min-w-0" :class="{ 'opacity-60': option.ncItemDisabled }">
              <div class="text-sm truncate">{{ option.display_name || option.email }}</div>
              <div v-if="option.display_name" class="text-xs text-nc-content-gray-muted truncate">{{ option.email }}</div>
            </div>
          </template>
          <template #listItemSelectedIcon><NcSpanHidden /></template>
        </NcList>

        <div class="flex items-center justify-between pt-4">
          <div v-if="selectedNewUsers.length" class="text-nc-content-gray-muted">
            {{
              selectedNewUsers.length === 1
                ? $t('objects.teams.nMemberSelected', { n: selectedNewUsers.length })
                : $t('objects.teams.nMembersSelected', { n: selectedNewUsers.length })
            }}
          </div>
          <div v-else>&nbsp;</div>
          <div class="flex gap-2">
            <NcButton type="secondary" size="small" :disabled="isAddingMembers" @click="isAddMembersOpen = false">
              {{ $t('general.cancel') }}
            </NcButton>
            <NcButton
              type="primary"
              size="small"
              :loading="isAddingMembers"
              :disabled="isAddingMembers || selectedNewUsers.length === 0"
              @click="handleAddMembers"
            >
              {{ selectedNewUsers.length > 1 ? $t('activity.addMembers') : $t('labels.addMember') }}
            </NcButton>
          </div>
        </div>
      </div>
    </GeneralModal>
  </div>
</template>

<style lang="scss">
.nc-modal-teams {
  .nc-modal {
    @apply !p-0;
    height: min(calc(100vh - 100px), 1024px);
    max-height: min(calc(100vh - 100px), 1024px) !important;
  }

  .nc-modal-teams-edit-content {
    @apply px-6 pb-6 nc-scrollbar-thin relative w-full h-full flex flex-col gap-2 overflow-auto;

    .nc-modal-teams-edit-content-section {
      @apply flex flex-col gap-4 w-full;
    }
  }
}
</style>

<style scoped lang="scss">
.ant-form-item {
  @apply mb-0;
}
</style>
