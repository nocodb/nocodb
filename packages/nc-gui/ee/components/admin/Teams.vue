<script setup lang="ts">
import type { TeamV3ResponseType } from 'nocodb-sdk'

const { $api, $e } = useNuxtApp()

const router = useRouter()

const route = router.currentRoute

const { t } = useI18n()

const { isMobileMode } = useGlobal()

const orgId = computed(() => route.value.params.orgId as string)

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
  return teams.value.some((t: any) => t.fk_parent_team_id === teamId)
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
    const parentId = (team as any).fk_parent_team_id || null
    if (!childrenMap.has(parentId)) childrenMap.set(parentId, [])
    childrenMap.get(parentId)!.push(team)
  }

  const walk = (parentId: string | null, depth: number) => {
    const children = childrenMap.get(parentId) || []
    for (const child of children) {
      result.push({ ...child, _treeDepth: depth } as any)
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
    const response = await $api.instance.get(`/api/v3/meta/workspaces/${orgId.value}/teams`)
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
    const response = await $api.instance.get(`/api/v3/meta/workspaces/${orgId.value}/teams/${teamId}`)
    editTeam.value = response.data
    editTeamMembers.value = response.data?.members || []
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
    await $api.instance.post(`/api/v3/meta/workspaces/${orgId.value}/teams`, {
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
    message.success(t('msg.success.teamCreated'))
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
    await $api.instance.patch(`/api/v3/meta/workspaces/${orgId.value}/teams/${teamId}`, { title: title.trim() })
    await loadTeams()
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

const closeEditModal = () => {
  isEditModalOpen.value = false
  editTeamId.value = null
  editTeam.value = null
  editTeamMembers.value = []
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
      ? t('objects.teams.confirmDeleteTeamWithChildrenSubtitle')
      : t('objects.teams.confirmDeleteTeamSubtitle'),
    okText: t('activity.deleteTeam'),
    cancelText: t('labels.cancel'),
    okCallback: async () => {
      try {
        await $api.instance.delete(
          `/api/v3/meta/workspaces/${orgId.value}/teams/${team.id}${teamHasChildren ? '?force=true' : ''}`,
        )
        await loadTeams()
        message.success(t('msg.success.teamDeleted'))
      } catch (e: any) {
        message.error(await extractSdkResponseErrorMsg(e))
      }
    },
  })
}

// Add members state
const isAddMembersOpen = ref(false)

const orgUsers = ref<any[]>([])

const selectedUserIds = ref<string[]>([])

const isAddingMembers = ref(false)

const loadOrgUsers = async () => {
  try {
    const response = await $api.instance.get(`/api/v2/orgs/${orgId.value}/users`)
    // Response is an array directly
    const data = response.data
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
    await $api.instance.post(`/api/v3/meta/workspaces/${orgId.value}/teams/${editTeamId.value}/members`,
      selectedNewUsers.value.map((u: any) => ({
        user_id: u.id,
        team_role: 'team-level-member',
      })),
    )
    isAddMembersOpen.value = false
    await loadTeamDetail(editTeamId.value)
    await loadTeams()
    message.success(t('activity.membersAdded'))
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

const handleRemoveMember = async (userId: string) => {
  if (!editTeamId.value) return

  try {
    await $api.instance.delete(`/api/v3/meta/workspaces/${orgId.value}/teams/${editTeamId.value}/members`, {
      data: [{ user_id: userId }],
    })
    editTeamMembers.value = editTeamMembers.value.filter((m: any) => m.user_id !== userId)
    await loadTeams()
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

// Table columns
const columns = computed(() => [
  {
    key: 'teamName',
    title: t('labels.teamName'),
    minWidth: 220,
    showOrderBy: false,
  },
  {
    key: 'members',
    title: t('objects.members'),
    width: 120,
    showOrderBy: false,
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
  return (teams.value || []).filter((t: any) => (t.depth ?? 0) < 3)
})

// Expand parent teams by default
watch(
  teams,
  (newTeams) => {
    if (newTeams?.length) {
      const parentIds = new Set<string>()
      for (const t of newTeams as any[]) {
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
})
</script>

<template>
  <div
    class="nc-teams-container overflow-auto nc-scrollbar-thin relative h-[calc(100vh-144px)]"
    data-testid="nc-admin-teams"
  >
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
              <NcButton
                size="xsmall"
                :type="viewMode === 'flat' ? 'secondary' : 'text'"
                class="!px-0"
                @click="viewMode = 'flat'"
              >
                <GeneralIcon icon="ncList" class="h-4 w-4" />
              </NcButton>
            </NcTooltip>
            <NcTooltip :title="$t('labels.treeView')" class="flex">
              <NcButton
                size="xsmall"
                :type="viewMode === 'tree' ? 'secondary' : 'text'"
                class="!px-0"
                @click="viewMode = 'tree'"
              >
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
            :subtitle="teams.length ? $t('title.noResultsMatchedYourSearch') : ''"
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
              :style="{ width: `${((record as any)._treeDepth || 0) * (isMobileMode ? 16 : 24)}px` }"
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

            <GeneralTeamInfo :team="record" :icon-props="{ size: 'base', wrapperClass: '!rounded-lg' }" />
            <NcBadge
              v-if="record.scim_managed"
              :border="false"
              color="green"
              class="text-[10px] leading-[14px] !h-[18px] font-semibold flex-none"
            >
              SCIM
            </NcBadge>
          </div>

          <!-- Members column -->
          <div v-if="column.key === 'members'" class="text-nc-content-gray-muted">
            {{ record.members_count ?? 0 }}
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

                  <NcMenuItem
                    v-if="(record.depth ?? 0) < 3"
                    v-e="['c:org-team:add-sub-team', { teamId: record.id }]"
                    @click="handleCreateTeam(record.id)"
                  >
                    <GeneralIcon icon="plus" class="h-4 w-4" />
                    {{ $t('labels.addSubTeam') }}
                  </NcMenuItem>

                  <NcDivider />

                  <NcMenuItem
                    v-e="['c:org-team:delete', { teamId: record.id }]"
                    danger
                    @click="handleDeleteTeam(record as TeamV3ResponseType)"
                  >
                    <GeneralIcon icon="delete" />
                    {{ $t('activity.deleteTeam') }}
                  </NcMenuItem>
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
              <a-select-option
                v-for="team in parentTeamOptions"
                :key="team.id"
                :value="team.id"
                :data-label="team.title"
              >
                <div
                  class="flex items-center gap-2"
                  :style="{ paddingLeft: `${(team.depth ?? 0) * 16}px` }"
                >
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
      size="lg"
      :body-style="{ 'max-height': 'min(calc(100vh - 100px), 864px)', 'height': 'min(calc(100vh - 100px), 864px)' }"
      nc-modal-class-name="!p-0 h-full"
      wrap-class-name="nc-modal-team-edit-wrapper"
      @update:visible="(val: boolean) => { if (!val) closeEditModal() }"
    >
      <div class="h-full flex flex-col">
        <!-- Header -->
        <div class="p-2 w-full flex items-center gap-3 border-b-1 border-nc-border-gray-medium">
          <div class="flex items-center">
            <GeneralIcon icon="ncBuilding" class="!h-6 !w-6 pl-1" />
          </div>
          <div class="flex-1 text-lg font-bold text-nc-content-gray-emphasis">
            {{ editTeam?.title }}
          </div>
          <NcButton type="text" size="xsmall" @click="closeEditModal()">
            <GeneralIcon icon="close" />
          </NcButton>
        </div>

        <!-- Content -->
        <div v-if="isEditLoading" class="flex-1 flex items-center justify-center">
          <a-spin />
        </div>
        <div v-else-if="editTeam" class="flex-1 overflow-auto nc-scrollbar-thin p-6 flex flex-col gap-6">
          <!-- General section -->
          <div class="flex flex-col gap-4">
            <div class="text-sm font-semibold text-nc-content-gray-emphasis">{{ $t('general.general') }}</div>
            <div class="flex items-center gap-3">
              <GeneralTeamIcon :team="editTeam" class="!w-10 !h-10 flex-none !rounded-lg" />
              <a-input
                v-model:value="editTeam.title"
                class="nc-input-sm nc-input-shadow flex-1"
                @input="() => updateTeamTitle(editTeamId!, editTeam.title)"
              />
            </div>
          </div>

          <!-- Members section -->
          <div class="flex flex-col gap-4">
            <div class="flex items-center justify-between">
              <div class="text-sm font-semibold text-nc-content-gray-emphasis">
                {{ $t('objects.members') }}
                <span class="text-nc-content-gray-muted font-normal ml-1">({{ editTeamMembers.length }})</span>
              </div>
              <NcButton size="small" type="secondary" inner-class="!gap-2" @click="openAddMembers">
                <template #icon>
                  <GeneralIcon icon="plus" class="h-4 w-4" />
                </template>
                {{ $t('labels.addMember') }}
              </NcButton>
            </div>

            <div v-if="editTeamMembers.length === 0" class="text-sm text-nc-content-gray-muted py-4 text-center">
              {{ $t('title.noMembersFound') }}
            </div>

            <div v-else class="flex flex-col gap-2">
              <div
                v-for="member in editTeamMembers"
                :key="member.user_id"
                class="flex items-center gap-3 p-2 rounded-lg hover:bg-nc-bg-gray-light"
              >
                <GeneralUserIcon size="base" :email="member.user_email" class="flex-none" />
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium truncate">{{ member.user_email }}</div>
                  <div class="text-xs text-nc-content-gray-muted capitalize">{{ member.team_role }}</div>
                </div>
                <NcButton size="xsmall" type="text" class="!text-red-500" @click="handleRemoveMember(member.user_id)">
                  <GeneralIcon icon="delete" class="h-4 w-4" />
                </NcButton>
              </div>
            </div>

            <!-- Inherited members -->
            <template v-if="editTeam.inherited_members?.length">
              <NcDivider />
              <div class="text-xs font-semibold text-nc-content-gray-muted uppercase">
                {{ $t('labels.inheritedMembers') }}
                <span class="font-normal ml-1">({{ editTeam.inherited_members.length }})</span>
              </div>
              <div
                v-for="member in editTeam.inherited_members"
                :key="member.user_id"
                class="flex items-center gap-3 p-2 rounded-lg opacity-60"
              >
                <GeneralUserIcon size="base" :email="member.user_email" class="flex-none" />
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium truncate">{{ member.user_email }}</div>
                  <div class="text-xs text-nc-content-gray-muted">
                    {{ $t('labels.inheritedFrom') }} {{ member.inherited_from_team_title }}
                  </div>
                </div>
              </div>
            </template>
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
            {{ selectedNewUsers.length }} {{ selectedNewUsers.length === 1 ? $t('objects.member') : $t('objects.members') }} selected
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

<style scoped lang="scss">
.ant-form-item {
  @apply mb-0;
}
</style>
