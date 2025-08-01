<script lang="ts" setup>
import type { UserInfoType, UserType, WorkspaceUserType } from 'nocodb-sdk'
import type { NcConfirmModalProps } from '~/components/nc/ModalConfirm.vue'

interface Props {
  team: TeamType
  tableToolbarClassName?: string
}

interface TeamMember extends WorkspaceUserType, Omit<UserType, 'roles' | 'email' | 'id'> {}

const props = withDefaults(defineProps<Props>(), {})

const { team } = toRefs(props)

const { t } = useI18n()

const { user } = useGlobal()

const workspaceStore = useWorkspace()

const { collaborators } = storeToRefs(workspaceStore)

const teamMembers = ref<TeamMember[]>([])

const isLoading = ref(true)

const searchQuery = ref('')

const isOpenContextMenu = ref<Record<string, boolean>>({})

const filterMembers = computed(() => {
  if (!searchQuery.value) return teamMembers.value ?? []

  return teamMembers.value.filter((member) => searchCompare([member.display_name, member.email], searchQuery.value))
})

const hasSoleTeamOwner = computed(() => {
  return team.value?.owners?.length < 2
})

// NcTable columns configuration
const membersColumns = [
  {
    key: 'select',
    title: '',
    width: 70,
    minWidth: 70,
  },
  {
    key: 'member_name',
    title: t('objects.member'),
  },
  {
    key: 'workspace_role',
    title: t('labels.workspaceRole'),
    basis: '25%',
    minWidth: 252,
    dataIndex: 'workspace_role',
  },
  {
    key: 'action',
    title: t('labels.actions'),
    width: 110,
    minWidth: 110,
    justify: 'justify-end',
  },
] as NcTableColumnProps[]

const selectedRows = ref<{
  [id: string]: boolean
}>({})

const selectedRowConfig = computed(() => {
  const selectedRowCount = Object.values(selectedRows.value).filter(Boolean).length

  return {
    selectedRowCount,
    isAllSelected: teamMembers.value.length > 0 && selectedRowCount === teamMembers.value.length,
    isSomeSelected: selectedRowCount > 0 && selectedRowCount < teamMembers.value.length,
  }
})

const toggleSelectAll = (value: boolean) => {
  filterMembers.value.forEach((member, i) => {
    selectedRows.value[member.fk_user_id!] = value
  })
}

const customRow = (record: Record<string, any>) => ({
  class: `${selectedRows.value[record.fk_user_id!] ? 'selected' : ''} last:!border-b-0 !cursor-default`,
})

const loadTeamMembers = async () => {
  if (!team.value) {
    isLoading.value = false
    return
  }

  try {
    // Todo: load team members
    await ncDelay(2000)
    teamMembers.value = (collaborators.value || []) as TeamMember[]
  } catch (error: any) {
    message.error(await extractSdkResponseErrorMsg(error))
  } finally {
    isLoading.value = false
  }
}

const handleAssignAsTeamOwner = (member: TeamMember) => {
  // Todo: api call

  message.success({
    title: t('objects.teams.memberAssignedAsTeamOwner'),
    content: `${member.display_name || extractNameFromEmail(member.email)} is now a ${team.value?.title || 'team'} owner`,
  })
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

onMounted(() => {
  loadTeamMembers()
})
</script>

<template>
  <div class="nc-modal-teams-edit-content-section">
    <NcTable
      :is-data-loading="isLoading"
      :columns="membersColumns"
      :data="filterMembers"
      :bordered="false"
      row-height="56px"
      disable-table-scroll
      force-sticky-header
      header-row-height="44px"
      body-row-class-name="group"
      table-toolbar-class-name="pt-6"
      class="nc-field-permissions-table flex-1"
      :custom-row="customRow"
    >
      <template #tableToolbar>
        <div class="flex flex-col gap-4">
          <div class="nc-modal-teams-edit-content-section-title text-bodyBold">{{ $t('labels.members') }}</div>

          <div class="flex items-center justify-between min-h-8">
            <a-input
              v-model:value="searchQuery"
              allow-clear
              class="nc-input-border-on-value !max-w-90 !h-8 !px-3 !py-1 !rounded-lg"
              :placeholder="`${$t('general.search')}...`"
            >
              <template #prefix>
                <GeneralIcon icon="search" class="mr-2 h-4 w-4 text-gray-500 group-hover:text-black" />
              </template>
            </a-input>

            <div class="relative children:flex-none min-w-[150px] min-h-8 flex items-center justify-end">
              <div v-if="!selectedRowConfig.selectedRowCount">
                <NcButton size="small" type="secondary" class="absolute" inner-class="!gap-2 text-nc-content-brand">
                  <template #icon>
                    <GeneralIcon icon="ncUserPlus" class="h-4 w-4" />
                  </template>
                  {{ $t('activity.addMembers') }}
                </NcButton>
              </div>
              <div v-else>
                <NcDropdown placement="bottomRight">
                  <NcButton size="small" icon-position="right" inner-class="!gap-2">
                    <template #icon>
                      <GeneralIcon icon="ncChevronDown" />
                    </template>
                    {{ $t('labels.actions') }}
                  </NcButton>
                  <template #overlay>
                    <NcMenu variant="medium">
                      <NcTooltip :title="t('objects.teams.removeFromTeamRestrictionTooltip')" placement="right">
                        <NcMenuItem class="!text-red-500 !hover:bg-red-50">
                          <GeneralIcon icon="ncXSquare" />
                          {{ $t('activity.removeFromTeam') }}
                        </NcMenuItem>
                      </NcTooltip>
                    </NcMenu>
                  </template>
                </NcDropdown>
              </div>
            </div>
          </div>
        </div>
      </template>
      <template #headerCell="{ column }">
        <template v-if="column.key === 'select'">
          <NcCheckbox
            :checked="selectedRowConfig.isAllSelected"
            :indeterminate="selectedRowConfig.isSomeSelected"
            :disabled="!teamMembers.length"
            @update:checked="toggleSelectAll"
          />
        </template>
        <template v-else>
          {{ column.title }}
        </template>
      </template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'select'">
          <NcCheckbox v-model:checked="selectedRows[record.fk_user_id!]" />
        </template>
        <template v-else-if="column.key === 'member_name'">
          {{ record.display_name || extractNameFromEmail(record.email) }}
        </template>
        <template v-else-if="column.key === 'workspace_role'">
          {{ record.workspace_role }}
        </template>
        <template v-else-if="column.key === 'action'">
          <div v-if="column.key === 'action'" @click.stop>
            <NcDropdown v-model:visible="isOpenContextMenu[record.fk_user_id!]" placement="bottomRight">
              <template #default="{ visible }">
                <NcButton size="small" type="secondary" class="invisible group-hover:visible" :class="{ '!visible': visible }">
                  <component :is="iconMap.ncMoreVertical" />
                </NcButton>
              </template>
              <template #overlay>
                <NcMenu variant="medium" @click="isOpenContextMenu[record.fk_user_id!] = false">
                  <NcMenuItem @click="handleAssignAsTeamOwner(record as TeamMember)">
                    <GeneralIcon icon="ncArrowUpCircle" class="h-4 w-4" />
                    {{ $t('activity.assignAsTeamOwner') }}
                  </NcMenuItem>

                  <!-- Show leave team option only if logged in user is same as record user -->
                  <NcTooltip
                    v-if="record.fk_user_id === user?.id"
                    :disabled="!hasSoleTeamOwner"
                    :title="t('objects.teams.soleTeamOwnerTooltip')"
                    placement="left"
                  >
                    <NcMenuItem :disabled="hasSoleTeamOwner" @click="handleLeaveTeam(record as TeamType)">
                      <GeneralIcon icon="ncLogOut" class="h-4 w-4" />
                      {{ $t('activity.leaveTeam') }}
                    </NcMenuItem>
                  </NcTooltip>

                  <NcMenuItem class="!text-red-500 !hover:bg-red-50">
                    <GeneralIcon icon="ncXSquare" />
                    {{ $t('activity.removeFromTeam') }}
                  </NcMenuItem>
                </NcMenu>
              </template>
            </NcDropdown>
          </div>
        </template>
      </template>
    </NcTable>

    <!-- <NcModalConfirm
      v-model:visible="isConfirmModalVisible"
      :title="t('objects.teams.confirmLeaveTeamTitle')"
      :content="t('objects.teams.confirmLeaveTeamSubtitle')"
      :ok-text="t('activity.leaveTeam')"
      :cancel-text="t('labels.cancel')"
    /> -->
  </div>
</template>
