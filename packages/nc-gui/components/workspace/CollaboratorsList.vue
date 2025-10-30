<script lang="ts" setup>
import {
  HigherPlan,
  OrderedWorkspaceRoles,
  type PlanLimitExceededDetailsType,
  PlanLimitTypes,
  PlanTitles,
  WorkspaceUserRoles,
  type WorkspaceUserType,
} from 'nocodb-sdk'

const props = defineProps<{
  workspaceId?: string
  height?: string
}>()

const { workspaceRoles } = useRoles()

const { user, isMobileMode } = useGlobal()

const { showInfoModal } = useNcConfirmModal()

const workspaceStore = useWorkspace()

const { removeCollaborator: _removeCollaborator, updateCollaborator: _updateCollaborator } = workspaceStore

const { collaborators, activeWorkspace, workspacesList, isCollaboratorsLoading, removingCollaboratorMap } =
  storeToRefs(workspaceStore)

const {
  isPaymentEnabled,
  showUserPlanLimitExceededModal,
  activePlanTitle,
  getLimit,
  isWsOwner,
  navigateToPricing,
  isTopBannerVisible,
} = useEeConfig()

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

const topSectionRef = ref<HTMLDivElement>()

const tableHeaderSectionRef = ref<HTMLDivElement>()

const { height: toSectionHeight } = useElementSize(topSectionRef)

const { height: tableHeaderSectionHeight } = useElementSize(tableHeaderSectionRef)

const filterCollaborators = computed(() => {
  if (!userSearchText.value) return collaborators.value ?? []

  if (!collaborators.value) return []

  return collaborators.value.filter(
    (collab) =>
      searchCompare([collab.display_name, collab.email], userSearchText.value) && !removingCollaboratorMap.value[collab.id],
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

const paidUsersCount = computed(() => (collaborators.value || []).filter((c) => !!parseProp(c?.meta).billable).length)

const nonPaidUsersCount = computed(() => {
  return (collaborators.value || []).length - paidUsersCount.value
})

const showBanner = false

const showUpgradeAlert = computed(() => {
  return (
    (showBanner && isPaymentEnabled.value && paidUsersCount.value > getLimit(PlanLimitTypes.LIMIT_EDITOR)) ||
    nonPaidUsersCount.value > getLimit(PlanLimitTypes.LIMIT_COMMENTER)
  )
})

const selectAll = computed({
  get: () =>
    Object.values(selected).every((v) => v) &&
    Object.keys(selected).length > 0 &&
    Object.values(selected).length === sortedCollaborators.value.length,
  set: (value) => {
    toggleSelectAll(value)
  },
})

const updateCollaborator = async (collab: any, roles: WorkspaceUserRoles, overrideBaseRole: boolean = false) => {
  if (!currentWorkspace.value || !currentWorkspace.value.id) return

  try {
    const res = await _updateCollaborator(collab.id, roles, currentWorkspace.value.id, overrideBaseRole)
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

// Todo: Enable this after we add support for overriding base role in backend
const showOverrideBaseRoleCheckbox = ref(false)

const userRoleUpdateInfo = ref<{
  collab?: WorkspaceUserType
  roles?: WorkspaceUserRoles
  showConfirmationModal: boolean
  overrideBaseRole: boolean
}>({
  showConfirmationModal: false,
  overrideBaseRole: false,
})

/**
 * If user is only owner in any base then we should restrict overriding base role
 */
const showRoleChangeConfirmationModal = async (collab: any, roles: WorkspaceUserRoles) => {
  if (!currentWorkspace.value || !currentWorkspace.value.id) return

  userRoleUpdateInfo.value.collab = collab
  userRoleUpdateInfo.value.roles = roles
  userRoleUpdateInfo.value.overrideBaseRole = false

  try {
    /**
     * Todo: API call to check if user has explicit base role assigned to any base or not
     * And whether user is only owner in any base or not
     */

    userRoleUpdateInfo.value.showConfirmationModal = true
  } catch (e: any) {
    console.error(e)
  }
}

const onCancelRoleChangeConfirmationModal = () => {
  userRoleUpdateInfo.value.showConfirmationModal = false
  userRoleUpdateInfo.value.overrideBaseRole = false
}

const onConfirmRoleChangeConfirmationModal = () => {
  userRoleUpdateInfo.value.showConfirmationModal = false

  updateCollaborator(userRoleUpdateInfo.value.collab, userRoleUpdateInfo.value.roles!, userRoleUpdateInfo.value.overrideBaseRole)
}

const isOwnerOrCreator = computed(() => {
  return workspaceRoles.value?.[WorkspaceUserRoles.OWNER] || workspaceRoles.value?.[WorkspaceUserRoles.CREATOR]
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
  class: `${selected[recordIndex] ? 'selected' : ''} last:!border-b-0 !cursor-default`,
})

const isDeleteOrUpdateAllowed = (user) => {
  return !(isOnlyOneOwner.value && user.roles === WorkspaceUserRoles.OWNER)
}

const topScroll = ref(0)

const tableHeight = computed(() => {
  return `calc(100% - ${
    tableHeaderSectionHeight.value + (isTopBannerVisible.value ? toSectionHeight.value - topScroll.value : 0) + 64
  }px)`
})

const handleScroll = (e) => {
  if (!isTopBannerVisible.value) return

  topScroll.value = e.target?.scrollTop
}

const removeCollaborator = (userId: string, workspaceId: string) => {
  showInfoModal({
    title: userId === user.value?.id ? t('title.confirmLeaveWorkspaceTitle') : t('title.confirmRemoveMemberFromWorkspaceTitle'),
    content:
      userId === user.value?.id ? t('title.confirmLeaveWorkspaceSubtile') : t('title.confirmRemoveMemberFromWorkspaceSubtitle'),
    showCancelBtn: true,
    showIcon: false,
    okProps: {
      type: 'danger',
    },
    okText: userId === user.value?.id ? t('activity.leaveWorkspace') : t('general.remove'),
    okCallback: async () => {
      _removeCollaborator(userId, workspaceId)
    },
  })
}
</script>

<template>
  <div
    class="nc-collaborator-table-container overflow-auto nc-scrollbar-thin relative"
    :class="{
      'nc-is-admin-panel': !height && isAdminPanel,
      'nc-is-ws-members-list': !height && !isAdminPanel,
    }"
    :style="`${height ? `height: ${height}` : ''}`"
    @scroll.passive="handleScroll"
  >
    <div ref="topSectionRef">
      <PaymentBanner />
    </div>

    <div class="nc-collaborator-table-wrapper h-full max-w-[1200px] mx-auto py-6 px-4 md:px-6 flex flex-col gap-6 sticky top-0">
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
          <template v-if="!isMobileMode && isPaymentEnabled && paidUsersCount">
            <NcTooltip
              v-if="activePlanTitle === PlanTitles.FREE"
              :tooltip-style="{ width: '230px' }"
              :overlay-inner-style="{ width: '230px' }"
              :title="
                $t('upgrade.freePlanEditorLimitTooltip', {
                  limit: getLimit(PlanLimitTypes.LIMIT_EDITOR),
                })
              "
            >
              <div class="flex items-center text-nc-content-gray-default text-sm whitespace-nowrap">
                <GeneralIcon icon="ncCrown" class="flex-none h-4 w-4 mr-1" />

                {{ paidUsersCount }} {{ paidUsersCount === 1 ? $t('labels.editorSeat') : $t('labels.editorSeats') }}
              </div>
            </NcTooltip>
            <div v-else class="flex items-center text-nc-content-gray-default text-sm whitespace-nowrap">
              <GeneralIcon icon="ncCrown" class="flex-none h-4 w-4 mr-1" />

              {{ paidUsersCount }} {{ $t('general.paid') }}
              {{ paidUsersCount === 1 ? $t('general.seat').toLowerCase() : $t('general.seats').toLowerCase() }}
            </div>
            <div class="self-stretch border-r-1 border-nc-border-gray-medium"></div>
          </template>

          <NcButton size="small" :disabled="isCollaboratorsLoading" data-testid="nc-add-member-btn" @click="inviteDlg = true">
            <div class="flex items-center gap-2">
              <component :is="iconMap.plus" class="!h-4 !w-4" />
              {{ $t('labels.addMember') }}
            </div>
          </NcButton>
        </div>
      </div>

      <NcAlert
        v-if="showUpgradeAlert"
        ref="tableHeaderSectionRef"
        type="warning"
        class=""
        :message="$t('upgrade.adjustCollaboratorRoles')"
        :description="
          $t('upgrade.UpgradeToInviteMoreSubtitle', {
            activePlan: activePlanTitle,
            editors: getLimit(PlanLimitTypes.LIMIT_EDITOR),
            commenters: getLimit(PlanLimitTypes.LIMIT_COMMENTER),
            plan: HigherPlan[activePlanTitle],
          })
        "
      >
        <template #action>
          <NcButton
            type="text"
            size="small"
            class="!text-nc-content-brand !font-700"
            @click="
              navigateToPricing({
                limitOrFeature:
                  paidUsersCount > getLimit(PlanLimitTypes.LIMIT_EDITOR)
                    ? PlanLimitTypes.LIMIT_EDITOR
                    : PlanLimitTypes.LIMIT_COMMENTER,
              })
            "
          >
            {{ isWsOwner ? 'Upgrade' : $t('general.requestUpgrade') }}
          </NcButton>
        </template>
      </NcAlert>

      <div class="flex" :style="{ height: tableHeight }">
        <NcTable
          v-model:order-by="orderBy"
          :columns="columns"
          :data="sortedCollaborators"
          :is-data-loading="isCollaboratorsLoading"
          :custom-row="customRow"
          :bordered="false"
          class="flex-1 nc-collaborators-list"
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

          <template #bodyCell="{ column, record, recordIndex }">
            <template v-if="column.key === 'select'">
              <NcCheckbox v-model:checked="selected[recordIndex]" />
            </template>

            <div v-if="column.key === 'email'" class="w-full flex gap-3 items-center">
              <GeneralUserIcon size="base" :user="record" class="flex-none" />
              <div class="flex flex-col flex-1 max-w-[calc(100%_-_44px)]">
                <div class="flex items-center gap-1">
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
                    :tooltip-style="{ width: '180px' }"
                    :overlay-inner-style="{ width: '180px' }"
                  >
                    <div v-if="activePlanTitle === PlanTitles.FREE" class="text-nc-content-gray-default">
                      <GeneralIcon icon="ncCrown" class="flex-none mb-0.5" />
                    </div>
                    <NcBadge
                      v-else
                      :border="false"
                      color="green"
                      class="text-nc-content-green-dark text-[10px] leading-[14px] !h-[18px] font-semibold"
                    >
                      <GeneralIcon icon="ncCrown" class="flex-none mb-0.5" />
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
                <RolesSelectorV2
                  :on-role-change="(role) => showRoleChangeConfirmationModal(record, role as WorkspaceUserRoles)"
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
              <NcDropdown placement="bottomRight">
                <NcButton size="small" type="secondary">
                  <component :is="iconMap.ncMoreVertical" />
                </NcButton>
                <template #overlay>
                  <NcMenu variant="small">
                    <NcMenuItemCopyId
                      :id="record.id"
                      :tooltip="$t('labels.clickToCopyUserID')"
                      :label="
                        $t('labels.userIdColon', {
                          userId: record.id,
                        })
                      "
                    />

                    <template v-if="isOwnerOrCreator || record.id === user.id">
                      <NcDivider />

                      <template v-if="isAdminPanel">
                        <NcMenuItem data-testid="nc-admin-org-user-delete">
                          <GeneralIcon icon="signout" />
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
                          danger
                          @click="removeCollaborator(record.id, currentWorkspace?.id)"
                        >
                          <div v-if="removingCollaboratorMap[record.id]" class="h-4 w-4 flex items-center justify-center">
                            <GeneralLoader class="!flex-none !text-current" />
                          </div>
                          <GeneralIcon v-else icon="delete" />
                          {{ record.id === user.id ? t('activity.leaveWorkspace') : t('activity.removeMember') }}
                        </NcMenuItem>
                      </NcTooltip>
                    </template>
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
      <DlgInviteDlg
        v-if="currentWorkspace"
        v-model:model-value="inviteDlg"
        :workspace-id="currentWorkspace?.id"
        type="workspace"
        :users="sortedCollaborators"
      />

      <NcModalConfirm
        v-if="currentWorkspace"
        v-model:visible="userRoleUpdateInfo.showConfirmationModal"
        ok-class="capitalize"
        :ok-text="$t('general.confirm')"
        :show-icon="false"
        @cancel="onCancelRoleChangeConfirmationModal"
        @ok="onConfirmRoleChangeConfirmationModal"
      >
        <template #title>
          <div>
            <div class="inline-flex !align-top mr-2">
              {{ $t('title.changeWorkspaceRoleTo') }}
            </div>

            <RolesBadge :border="false" :role="userRoleUpdateInfo.roles" class="inline-flex text-body"> </RolesBadge>
          </div>
        </template>
        <template #extraContent>
          <div class="flex flex-col gap-5 text-caption text-nc-content-gray">
            <NcAlert
              type="info"
              :show-icon="false"
              class="!p-3 bg-nc-bg-yellow-light !border-nc-fill-yellow-light"
              description-class="!line-clamp-none"
            >
              <template #description>
                <div class="text-nc-content-yellow-dark">
                  <b>{{ $t('general.notice') }}:</b>
                  {{ $t('msg.info.workspaceRoleUpdateNotice') }}
                </div>
              </template>
            </NcAlert>
            <div v-if="showOverrideBaseRoleCheckbox" class="flex items-start gap-3">
              <div class="flex items-center h-5">
                <NcCheckbox v-model:checked="userRoleUpdateInfo.overrideBaseRole" />
              </div>

              <div class="flex flex-col gap-2">
                <div class="font-semibold">Apply to all bases</div>
                <div class="text-nc-content-gray-subtle">
                  This will override explicit base roles and apply the workspace role to all bases.
                </div>
              </div>
            </div>
          </div>
        </template>
      </NcModalConfirm>
    </div>
  </div>
</template>

<style scoped lang="scss">
.badge-text {
  @apply text-[14px] pt-1 text-center;
}

.nc-collaborator-table-container {
  &.nc-is-admin-panel {
    @apply h-[calc(100vh-144px)];

    @supports (height: 100dvh) {
      @apply h-[calc(100dvh-144px)];
    }
  }

  &.nc-is-ws-members-list {
    @apply h-[calc(100vh-var(--topbar-height)-44px)];

    @supports (height: 100dvh) {
      @apply h-[calc(100dvh-var(--topbar-height)-44px)];
    }
  }
}
</style>
