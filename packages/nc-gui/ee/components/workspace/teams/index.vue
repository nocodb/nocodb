<script lang="ts" setup>
import type { TeamV3V3Type } from 'nocodb-sdk'
import type { NcConfirmModalProps } from '~/components/nc/ModalConfirm.vue'

interface Props {
  workspaceId?: string
  isActive?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isActive: true,
})

const router = useRouter()
const route = router.currentRoute

const { isActive } = toRefs(props)

const isAdminPanel = inject(IsAdminPanelInj, ref(false))

const { t } = useI18n()

const { user } = useGlobal()

const { isUIAllowed } = useRoles()

const hasEditPermission = computed(() => {
  return isUIAllowed('teamCreate')
})

const workspaceStore = useWorkspace()

const { teams, isTeamsLoading, collaboratorsMap, activeWorkspace, isTeamsEnabled } = storeToRefs(workspaceStore)

const { sorts, sortDirection, loadSorts, handleGetSortedData, saveOrUpdate: saveOrUpdateUserSort } = useUserSorts('Teams')

const searchQuery = ref('')

const isCreateTeamModalVisible = ref(false)

const activeWorkspaceId = computed(() => {
  return props.workspaceId || activeWorkspace.value?.id
})

/**
 * Modal visibility is based on query params, and will use following method
 * Open - router.push
 * Close - router.back or router.replace (if back history is not available)
 * */
const isEditModalOpenUsingRouterPush = ref(false)

const sortedTeams = computed(() => {
  return handleGetSortedData(
    teams.value.filter((team) => searchCompare([team.title], searchQuery.value)),
    sorts.value,
  )
})

const orderBy = computed<Record<string, SordDirectionType>>({
  get: () => {
    return sortDirection.value
  },
  set: (value: Record<string, SordDirectionType>) => {
    const valueEntries = Object.entries(value)

    // Check if value is an empty object
    if (valueEntries.length === 0) {
      saveOrUpdateUserSort({})
      return
    }

    const [field, direction] = valueEntries[0]!

    saveOrUpdateUserSort({
      field,
      direction,
    })
  },
})

const handleEditTeam = (team: TeamType) => {
  if (!team?.id || !team?.is_member) return

  router.push({ query: { ...route.value.query, teamId: team.id } })

  isEditModalOpenUsingRouterPush.value = true
}

const columns = [
  {
    key: 'teamName',
    title: t('labels.teamName'),
    minWidth: 220,
    dataIndex: 'name',
    showOrderBy: true,
  },
  {
    key: 'badge',
    title: t('labels.badge'),
    basis: '25%',
    minWidth: 252,
    dataIndex: 'badge',
  },
  {
    key: 'owner',
    title: t('title.creator'),
    basis: '25%',
    minWidth: 252,
    dataIndex: 'created_by',
    showOrderBy: true,
  },
  {
    key: 'action',
    title: t('labels.actions'),
    width: 110,
    minWidth: 110,
    justify: 'justify-end',
  },
] as NcTableColumnProps<TeamV3V3Type>[]

const customRow = (record: Record<string, any>) => ({
  class: record.is_member ? '' : '!cursor-default',
  onClick: () => {
    handleEditTeam(record as TeamType)
  },
})

const handleCreateTeam = () => {
  isCreateTeamModalVisible.value = true
}

const hasSoleTeamOwner = (team: TeamV3V3Type) => {
  return (team?.managers_count || 0) < 2
}

const handleConfirm = ({
  title,
  content,
  okText,
  cancelText,
  okProps: _okProps = {},
  okCallback = () => Promise.resolve(),
}: Partial<NcConfirmModalProps> & { okCallback?: () => Promise<void> }) => {
  const isOpen = ref(true)

  const okProps = ref({ loading: false, type: 'danger', ..._okProps })

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

const handleLeaveTeam = (team: TeamV3V3Type) => {
  handleConfirm({
    title: t('objects.teams.confirmLeaveTeamTitle'),
    content: t('objects.teams.confirmLeaveTeamSubtitle'),
    okText: t('activity.leaveTeam'),
    cancelText: t('labels.cancel'),
    okCallback: async () => {
      await workspaceStore.removeTeamMembers(activeWorkspaceId.value!, team.id, [{ user_id: user.value?.id }])
    },
  })
}

const handleDeleteTeam = (team: TeamV3V3Type) => {
  handleConfirm({
    title: t('objects.teams.confirmDeleteTeamTitle'),
    content: t('objects.teams.confirmDeleteTeamSubtitle'),
    okText: t('activity.deleteTeam'),
    cancelText: t('labels.cancel'),
    okCallback: async () => {
      await workspaceStore.deleteTeam(activeWorkspaceId.value!, team.id)
    },
  })
}

/**
 * Reset search query on tab change
 */
watch(isActive, () => {
  searchQuery.value = ''
})

onMounted(async () => {
  loadSorts()
})
</script>

<template>
  <div
    class="nc-teams-container overflow-auto nc-scrollbar-thin relative"
    :class="{
      'h-[calc(100vh-144px)]': isAdminPanel,
      'h-[calc(100vh-92px)]': !isAdminPanel,
    }"
  >
    <div class="nc-teams-wrapper h-full max-w-[1200px] mx-auto py-6 px-6 flex flex-col gap-6 sticky top-0">
      <div class="w-full flex items-center justify-between gap-3">
        <a-input
          v-model:value="searchQuery"
          allow-clear
          :disabled="isTeamsLoading"
          class="nc-input-border-on-value !max-w-90 !h-8 !px-3 !py-1 !rounded-lg"
          :placeholder="$t('placeholder.searchATeam')"
        >
          <template #prefix>
            <GeneralIcon icon="search" class="mr-2 h-4 w-4 text-gray-500 group-hover:text-black" />
          </template>
        </a-input>

        <NcButton
          v-if="hasEditPermission"
          size="small"
          inner-class="!gap-2"
          :disabled="isTeamsLoading"
          data-testid="nc-new-team-btn"
          class="capitalize"
          @click="handleCreateTeam"
        >
          <template #icon>
            <GeneralIcon icon="plus" class="h-4 w-4" />
          </template>
          {{ $t('labels.newTeam') }}
        </NcButton>
      </div>

      <NcTable
        v-model:order-by="orderBy"
        :columns="columns"
        :data="sortedTeams"
        :is-data-loading="isTeamsLoading"
        :bordered="false"
        class="flex-1 nc-teams-list"
        :pagination="true"
        :pagination-offset="25"
        :custom-row="customRow"
      >
        <template #emptyText>
          <NcEmptyPlaceholder
            :title="teams.length ? '' : $t('placeholder.youHaveNotCreatedAnyTeams')"
            :subtitle="
              teams.length ? $t('title.noResultsMatchedYourSearch') : $t('placeholder.youHaveNotCreatedAnyTeamsSubtitle')
            "
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
            <template #subtitle>
              {{ teams.length ? $t('title.noResultsMatchedYourSearch') : $t('placeholder.youHaveNotCreatedAnyTeamsSubtitle') }}

              <!-- Todo: @rameshmane7218 update doc links -->
              <a
                v-if="!teams.length"
                href="https://nocodb.com/docs/product-docs/collaboration/teams"
                target="_blank"
                rel="noopener noreferrer"
                >{{ $t('msg.learnMore') }}</a
              >
            </template>
            <template v-if="hasEditPermission" #action>
              <NcButton size="small" inner-class="!gap-2" class="capitalize" @click="handleCreateTeam">
                <template #icon>
                  <GeneralIcon icon="plus" class="h-4 w-4" />
                </template>
                {{ $t('labels.newTeam') }}
              </NcButton>
            </template>
          </NcEmptyPlaceholder>
        </template>

        <template #bodyCell="{ column, record }">
          <GeneralTeamInfo
            v-if="column.key === 'teamName'"
            :team="record"
            :icon-props="{ size: 'base', wrapperClass: '!rounded-lg' }"
          />

          <div v-if="column.key === 'badge'">
            <NcBadge class="uppercase">
              <GeneralTeamIcon v-if="record.icon" :team="record" icon-bg-color="transparent" />
              {{ record.title?.slice(0, 3) }}
            </NcBadge>
          </div>

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

          <div v-if="column.key === 'action'" @click.stop>
            <NcDropdown placement="bottomRight">
              <NcButton size="small" type="secondary">
                <component :is="iconMap.ncMoreVertical" />
              </NcButton>
              <template #overlay>
                <NcMenu variant="medium">
                  <NcMenuItem v-if="record.is_member" @click="handleEditTeam(record as TeamV3V3Type)">
                    <GeneralIcon icon="ncEdit" class="h-4 w-4" />
                    {{ $t('general.edit') }}
                  </NcMenuItem>
                  <NcTooltip
                    v-if="record.is_member"
                    :disabled="!hasSoleTeamOwner(record as TeamV3V3Type)"
                    :title="t('objects.teams.thisTeamHasOnlyOneOwnerTooltip')"
                    placement="left"
                  >
                    <NcMenuItem
                      :disabled="hasSoleTeamOwner(record as TeamV3V3Type) "
                      @click="handleLeaveTeam(record as TeamV3V3Type)"
                    >
                      <GeneralIcon icon="ncLogOut" class="h-4 w-4" />
                      {{ $t('activity.leaveTeam') }}
                    </NcMenuItem>
                  </NcTooltip>
                  <NcMenuItem
                    v-if="hasEditPermission"
                    :disabled="!record.is_member"
                    danger
                    @click="handleDeleteTeam(record as TeamV3V3Type)"
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
    <WorkspaceTeamsEdit v-if="isTeamsEnabled" :is-open-using-router-push="isEditModalOpenUsingRouterPush" />
    <WorkspaceTeamsCreate v-model:visible="isCreateTeamModalVisible" />
  </div>
</template>
