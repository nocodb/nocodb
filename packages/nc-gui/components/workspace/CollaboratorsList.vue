<script lang="ts" setup>
import {
  OrderedWorkspaceRoles,
  type PlanLimitExceededDetailsType,
  PlanTitles,
  WorkspaceUserRoles,
  PlanLimitTypes,
} from 'nocodb-sdk'

const props = defineProps<{
  workspaceId?: string
  height?: string
}>()

const { workspaceRoles } = useRoles()

const { user } = useGlobal()

const workspaceStore = useWorkspace()

const { removeCollaborator, updateCollaborator: _updateCollaborator } = workspaceStore

const { collaborators, activeWorkspace, workspacesList, isCollaboratorsLoading } = storeToRefs(workspaceStore)

const { isPaymentEnabled, showUserPlanLimitExceededModal, activePlanTitle, getLimit } = useEeConfig()

const currentWorkspace = computedAsync(async () => {
  if (props.workspaceId) {
    const ws = workspacesList.value.find((workspace) => workspace.id === props.workspaceId)
    if (ws) {
      return ws
    }
  }
  return activeWorkspace.value ?? workspacesList.value[0]
})

const { sorts, sortDirection, loadSorts, handleGetSortedData, saveOrUpdate: saveOrUpdateUserSort } = useUserSorts('Workspace')

const userSearchText = ref('')

const isAdminPanel = inject(IsAdminPanelInj, ref(false))

const isOnlyOneOwner = computed(() => {
  return collaborators.value?.filter((collab) => collab.roles === WorkspaceUserRoles.OWNER).length === 1
})

const { t } = useI18n()

const inviteDlg = ref(false)

const filterCollaborators = computed(() => {
  if (!userSearchText.value) return collaborators.value ?? []

  if (!collaborators.value) return []

  return collaborators.value.filter(
    (collab) =>
      collab.display_name?.toLowerCase().includes(userSearchText.value.toLowerCase()) ||
      collab.email?.toLowerCase().includes(userSearchText.value.toLowerCase()),
  )
})

const selected = reactive<{
  [key: number]: boolean
}>({})

const toggleSelectAll = (value: boolean) => {
  filterCollaborators.value.forEach((_, i) => {
    selected[i] = value
  })
}

const sortedCollaborators = computed(() => {
  return handleGetSortedData(filterCollaborators.value, sorts.value)
})

const paidUsersCount = computed(() => sortedCollaborators.value.filter((c) => !!parseProp(c?.meta).billable).length)

const selectAll = computed({
  get: () =>
    Object.values(selected).every((v) => v) &&
    Object.keys(selected).length > 0 &&
    Object.values(selected).length === sortedCollaborators.value.length,
  set: (value) => {
    toggleSelectAll(value)
  },
})

const updateCollaborator = async (collab: any, roles: WorkspaceUserRoles) => {
  if (!currentWorkspace.value || !currentWorkspace.value.id) return

  try {
    const res = await _updateCollaborator(collab.id, roles, currentWorkspace.value.id, isAdminPanel.value)
    if (!res) return
    message.success(t('msg.info.userRoleUpdated'))

    collaborators.value?.forEach((collaborator) => {
      if (collaborator.id === collab.id) {
        collaborator.roles = roles
      }
    })
  } catch (e: any) {
    const errorInfo = await extractSdkResponseErrorMsgv2(e)

    if (isPaymentEnabled.value && errorInfo.error === NcErrorType.PLAN_LIMIT_EXCEEDED) {
      const details = errorInfo.details as PlanLimitExceededDetailsType

      showUserPlanLimitExceededModal({
        details,
        role: roles,
        workspaceId: currentWorkspace.value.id,
        isAdminPanel: isAdminPanel.value,
      })
    }
  }
}

const isOwnerOrCreator = computed(() => {
  return workspaceRoles.value[WorkspaceUserRoles.OWNER] || workspaceRoles.value[WorkspaceUserRoles.CREATOR]
})

const accessibleRoles = computed<WorkspaceUserRoles[]>(() => {
  const currentRoleIndex = OrderedWorkspaceRoles.findIndex(
    (role) => workspaceRoles.value && Object.keys(workspaceRoles.value).includes(role),
  )
  if (currentRoleIndex === -1) return []
  return OrderedWorkspaceRoles.slice(currentRoleIndex).filter((r) => r)
})

onMounted(async () => {
  loadSorts()
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
  {
    key: 'select',
    title: '',
    width: 70,
    minWidth: 70,
  },
  {
    key: 'email',
    title: t('objects.users'),
    minWidth: 220,
    dataIndex: 'email',
    showOrderBy: true,
  },
  {
    key: 'role',
    title: t('general.access'),
    basis: '25%',
    minWidth: 252,
    dataIndex: 'roles',
    showOrderBy: true,
  },
  {
    key: 'created_at',
    title: t('title.dateJoined'),
    basis: '25%',
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

const customRow = (_record: Record<string, any>, recordIndex: number) => ({
  class: `${selected[recordIndex] ? 'selected' : ''} last:!border-b-0`,
})

const isDeleteOrUpdateAllowed = (user) => {
  return !(isOnlyOneOwner.value && user.roles === WorkspaceUserRoles.OWNER)
}
</script>

<template>
  <div
    class="nc-collaborator-table-container py-6 max-w-[1300px] px-6 flex flex-col gap-6"
    :class="{
      'h-[calc(100%-144px)]': !height && isAdminPanel,
      'h-[calc(100%-92px)]': !height && !isAdminPanel,
    }"
    :style="`${height ? `height: ${height}` : ''}`"
  >
    <div class="w-full flex items-center justify-between gap-3">
      <a-input
        v-model:value="userSearchText"
        allow-clear
        :disabled="isCollaboratorsLoading"
        class="nc-input-border-on-value !max-w-90 !h-8 !px-3 !py-1 !rounded-lg"
        :placeholder="$t('title.searchMembers')"
      >
        <template #prefix>
          <GeneralIcon icon="search" class="mr-2 h-4 w-4 text-gray-500 group-hover:text-black" />
        </template>
      </a-input>
      <div class="flex items-center gap-4">
        <template v-if="isPaymentEnabled && paidUsersCount">
          <NcTooltip
            v-if="activePlanTitle === PlanTitles.FREE"
            :title="
              $t('upgrade.freePlanEditorLimitTooltip', {
                limit: getLimit(PlanLimitTypes.LIMIT_EDITOR),
              })
            "
            class="cursor-pointer"
          >
            <NcBadge
              :border="false"
              color="grey"
              class="!bg-nc-bg-gray-medium text-nc-content-gray-default text-sm !h-[20px] !rounded-md"
            >
              <GeneralIcon icon="star" class="flex-none h-4 w-4 mr-1" />

              {{ paidUsersCount }} {{ paidUsersCount === 1 ? $t('general.editorSeat') : $t('labels.editorSeats') }}
            </NcBadge>
          </NcTooltip>
          <NcBadge
            v-else
            :border="false"
            color="maroon"
            class="text-nc-content-maroon-dark text-sm !h-[20px] font-500 whitespace-nowrap"
          >
            {{ paidUsersCount }} {{ $t('general.paid') }}
            {{ paidUsersCount === 1 ? $t('general.seat').toLowerCase() : $t('general.seats').toLowerCase() }}
          </NcBadge>
          <div class="self-stretch border-1 border-nc-border-gray-medium"></div>
        </template>

        <NcButton size="small" :disabled="isCollaboratorsLoading" data-testid="nc-add-member-btn" @click="inviteDlg = true">
          <div class="flex items-center gap-2">
            <component :is="iconMap.plus" class="!h-4 !w-4" />
            {{ $t('labels.addMember') }}
          </div>
        </NcButton>
      </div>
    </div>
    <div class="flex h-[calc(100%-4rem)]">
      <NcTable
        v-model:order-by="orderBy"
        :columns="columns"
        :data="sortedCollaborators"
        :is-data-loading="isCollaboratorsLoading"
        :custom-row="customRow"
        :bordered="false"
        class="flex-1 nc-collaborators-list"
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

        <template #bodyCell="{ column, record, recordIndex }">
          <template v-if="column.key === 'select'">
            <NcCheckbox v-model:checked="selected[recordIndex]" />
          </template>

          <div v-if="column.key === 'email'" class="w-full flex gap-3 items-center">
            <GeneralUserIcon size="base" :user="record" class="flex-none" />
            <div class="flex flex-col flex-1 max-w-[calc(100%_-_44px)]">
              <div class="flex items-center gap-3">
                <NcTooltip class="truncate max-w-full text-gray-800 capitalize font-semibold" show-on-truncate-only>
                  <template #title>
                    {{ record.display_name || record.email.slice(0, record.email.indexOf('@')) }}
                  </template>
                  {{ record.display_name || record.email.slice(0, record.email.indexOf('@')) }}
                </NcTooltip>
                <NcTooltip
                  v-if="isPaymentEnabled && parseProp(record.meta).billable"
                  :title="$t('tooltip.paidUserBadgeTooltip')"
                  class="flex items-center"
                >
                  <NcBadge
                    v-if="activePlanTitle === PlanTitles.FREE"
                    :border="false"
                    color="grey"
                    class="!bg-nc-bg-gray-medium text-nc-content-gray-default !h-[20px] !w-[20px] !p-0.5 !rounded"
                  >
                    <GeneralIcon icon="star" class="flex-none h-4 w-4" />
                  </NcBadge>
                  <NcBadge
                    v-else
                    :border="false"
                    color="maroon"
                    class="text-nc-content-maroon-dark text-[10px] leading-[14px] !h-[18px] font-semibold"
                  >
                    {{ $t('general.paid') }}
                  </NcBadge>
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
              v-if="isDeleteOrUpdateAllowed(record) && isOwnerOrCreator && accessibleRoles.includes(record.roles as WorkspaceUserRoles)"
            >
              <RolesSelector
                :description="false"
                :on-role-change="(role) => updateCollaborator(record, role as WorkspaceUserRoles)"
                :role="record.roles"
                :roles="accessibleRoles"
                class="cursor-pointer"
              />
            </template>
            <template v-else>
              <RolesBadge :border="false" :role="record.roles" class="cursor-default" />
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
            <NcDropdown v-if="isOwnerOrCreator || record.id === user.id">
              <NcButton size="small" type="secondary">
                <component :is="iconMap.ncMoreVertical" />
              </NcButton>
              <template #overlay>
                <NcMenu variant="small">
                  <template v-if="isAdminPanel">
                    <NcMenuItem data-testid="nc-admin-org-user-delete">
                      <GeneralIcon class="text-gray-800" icon="signout" />
                      <span>{{ $t('labels.signOutUser') }}</span>
                    </NcMenuItem>

                    <NcDivider />
                  </template>
                  <NcTooltip :disabled="!isOnlyOneOwner || record.roles !== WorkspaceUserRoles.OWNER">
                    <template #title>
                      {{ $t('tooltip.leaveWorkspace') }}
                    </template>
                    <NcMenuItem
                      :disabled="!isDeleteOrUpdateAllowed(record)"
                      :class="{ '!text-red-500 !hover:bg-red-50': isDeleteOrUpdateAllowed(record) }"
                      @click="removeCollaborator(record.id, currentWorkspace?.id)"
                    >
                      <MaterialSymbolsDeleteOutlineRounded />
                      {{ record.id === user.id ? t('activity.leaveWorkspace') : t('activity.removeUser') }}
                    </NcMenuItem>
                  </NcTooltip>
                </NcMenu>
              </template>
            </NcDropdown>
          </div>
        </template>

        <template #extraRow>
          <div v-if="collaborators?.length === 1" class="w-full pt-12 pb-4 px-2 flex flex-col items-center gap-6 text-center">
            <div class="text-2xl text-gray-800 font-bold">
              {{ $t('placeholder.inviteYourTeam') }}
            </div>
            <div class="text-sm text-gray-700">
              {{ $t('placeholder.inviteYourTeamLabel') }}
            </div>
            <img src="~assets/img/placeholder/invite-team.png" alt="Invite Team" class="!w-[30rem] flex-none" />
          </div>
        </template>
      </NcTable>
    </div>
    <DlgInviteDlg v-if="currentWorkspace" v-model:model-value="inviteDlg" :workspace-id="currentWorkspace?.id" type="workspace" />
  </div>
</template>

<style scoped lang="scss">
.badge-text {
  @apply text-[14px] pt-1 text-center;
}
</style>
