<script lang="ts" setup>
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

const { t } = useI18n()

const isAdminPanel = inject(IsAdminPanelInj, ref(false))

const workspaceStore = useWorkspace()

const { teams, collaboratorsMap } = storeToRefs(workspaceStore)

const { sorts, sortDirection, loadSorts, handleGetSortedData, saveOrUpdate: saveOrUpdateUserSort } = useUserSorts('Teams')

const searchQuery = ref('')

const isTeamsLoading = ref(true)

const isCreateTeamModalVisible = ref(false)

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

const handleEditTeam = (team: TeamType) => {
  if (!team?.id) return

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
] as NcTableColumnProps<TeamType>[]

const customRow = (record: Record<string, any>) => ({
  onClick: () => {
    handleEditTeam(record as TeamType)
  },
})

const handleCreateTeam = () => {
  isCreateTeamModalVisible.value = true
}

const hasSoleTeamOwner = (team: TeamType) => {
  return team?.owners?.length < 2
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

const handleLeaveTeam = (team: TeamType) => {
  handleConfirm({
    title: t('objects.teams.confirmLeaveTeamTitle'),
    content: t('objects.teams.confirmLeaveTeamSubtitle'),
    okText: t('activity.leaveTeam'),
    cancelText: t('labels.cancel'),
    okCallback: async () => {
      // Todo: api call
      console.log('leave team', team)
      await ncDelay(1000)
    },
  })
}

const handleDeleteTeam = (team: TeamType) => {
  handleConfirm({
    title: t('objects.teams.confirmDeleteTeamTitle'),
    content: t('objects.teams.confirmDeleteTeamSubtitle'),
    okText: t('activity.deleteTeam'),
    cancelText: t('labels.cancel'),
    okCallback: async () => {
      // Todo: api call
      console.log('delete team', team)
      await ncDelay(2000)
    },
  })
}

/**
 * Reset search query on tab change
 */
watch(isActive, () => {
  searchQuery.value = ''
})

const mockTeamsList = [
  {
    id: '1',
    title: 'Engineering',
    created_by: 'ramesh@nocodb.com',
    owners: ['ramesh@nocodb.com', 'test@nocodb.com'],
    members: ['ramesh@nocodb.com', 'test@nocodb.com', 'test-1@nocodb.com', 'test-2@nocodb.com', 'test-3@nocodb.com'],
    created_at: '2021-01-01',
    updated_at: '2021-01-01',
    meta: {},
  },
  {
    id: '2',
    title: 'Sales',
    created_by: 'user@gmail.com',
    owners: ['user@nocodb.com'],
    members: ['ramesh@nocodb.com', 'test@nocodb.com', 'test-1@nocodb.com', 'test-2@nocodb.com', 'test-3@nocodb.com'],
    created_at: '2021-01-01',
    updated_at: '2021-01-01',
    meta: {},
  },
]

onMounted(async () => {
  loadSorts()

  teams.value = mockTeamsList

  forcedNextTick(() => {
    isTeamsLoading.value = false
  })
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
          size="small"
          inner-class="!gap-2"
          :disabled="isTeamsLoading"
          data-testid="nc-new-team-btn"
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
            :title="$t('placeholder.youHaveNotCreatedAnyTeams')"
            :subtitle="$t('placeholder.youHaveNotCreatedAnyTeamsSubtitle')"
          >
            <template #icon>
              <img src="~assets/img/placeholder/moscot-collaborators.png" alt="New Team" class="!w-[320px] flex-none" />
            </template>
            <template #action>
              <NcButton size="small" inner-class="!gap-2" @click="handleCreateTeam">
                <template #icon>
                  <GeneralIcon icon="plus" class="h-4 w-4" />
                </template>
                {{ $t('labels.newTeam') }}
              </NcButton>
            </template>
          </NcEmptyPlaceholder>
        </template>

        <template #bodyCell="{ column, record }">
          <div v-if="column.key === 'teamName'">
            {{ record.title }}
          </div>

          <div v-if="column.key === 'badge'">
            <NcBadge class="uppercase">
              {{ record.title?.slice(0, 3) }}
            </NcBadge>
          </div>

          <div v-if="column.key === 'owner'" class="w-full flex gap-3 items-center">
            <GeneralUserIcon size="base" :user="collaboratorsMap[record.created_by]" class="flex-none" />
            <div class="flex flex-col flex-1 max-w-[calc(100%_-_44px)]">
              <div class="flex items-center gap-1">
                <NcTooltip class="truncate max-w-full text-gray-800 capitalize font-semibold" show-on-truncate-only>
                  <template #title>
                    {{ collaboratorsMap[record.created_by]?.display_name || extractNameFromEmail(record.created_by) }}
                  </template>
                  {{ collaboratorsMap[record.created_by]?.display_name || extractNameFromEmail(record.created_by) }}
                </NcTooltip>
              </div>
              <NcTooltip class="truncate max-w-full text-xs text-gray-600" show-on-truncate-only>
                <template #title>
                  {{ collaboratorsMap[record.created_by]?.email }}
                </template>
                {{ collaboratorsMap[record.created_by]?.email }}
              </NcTooltip>
            </div>
          </div>

          <div v-if="column.key === 'action'" @click.stop>
            <NcDropdown>
              <NcButton size="small" type="secondary">
                <component :is="iconMap.ncMoreVertical" />
              </NcButton>
              <template #overlay>
                <NcMenu variant="medium">
                  <NcMenuItem @click="handleEditTeam(record as TeamType)">
                    <GeneralIcon icon="ncEdit" class="h-4 w-4" />
                    {{ $t('general.edit') }}
                  </NcMenuItem>
                  <NcTooltip
                    :disabled="!hasSoleTeamOwner(record as TeamType)"
                    :title="t('objects.teams.soleTeamOwnerTooltip')"
                    placement="left"
                  >
                    <NcMenuItem :disabled="hasSoleTeamOwner(record as TeamType)" @click="handleLeaveTeam(record as TeamType)">
                      <GeneralIcon icon="ncLogOut" class="h-4 w-4" />
                      {{ $t('activity.leaveTeam') }}
                    </NcMenuItem>
                  </NcTooltip>
                  <NcMenuItem class="!text-red-500 !hover:bg-red-50" @click="handleDeleteTeam(record as TeamType)">
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
    <WorkspaceTeamsEdit :is-open-using-router-push="isEditModalOpenUsingRouterPush" />
    <WorkspaceTeamsCreate v-model:visible="isCreateTeamModalVisible" />
  </div>
</template>

<style lang="scss" scoped></style>
