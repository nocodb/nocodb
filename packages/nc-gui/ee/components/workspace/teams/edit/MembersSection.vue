<script lang="ts" setup>
import type { UserType, WorkspaceUserType } from 'nocodb-sdk'
import type { NcConfirmModalProps } from '~/components/nc/ModalConfirm.vue'

export interface TeamMember extends WorkspaceUserType, Omit<UserType, 'roles' | 'email' | 'id'> {}

interface Props {
  team: TeamType
  tableToolbarClassName?: string
}

const props = withDefaults(defineProps<Props>(), {})

const emits = defineEmits<{
  (e: 'update:team', value: TeamType): void
  (e: 'close'): void
}>()

const team = useVModel(props, 'team', emits)

const { t } = useI18n()

const { user } = useGlobal()

const workspaceStore = useWorkspace()

const { collaborators, teams } = storeToRefs(workspaceStore)

const teamMembers = ref<TeamMember[]>([])

const isLoading = ref(true)

const searchQuery = ref('')

const isOpenContextMenu = ref<Record<string, boolean>>({})

const isAddMembersModalVisible = ref(false)

const filterMembers = computed(() => {
  if (!searchQuery.value) return teamMembers.value ?? []

  return teamMembers.value.filter((member) => searchCompare([member.display_name, member.email], searchQuery.value))
})

const teamOwners = computed(() => {
  return team.value?.owners?.map((ownerIdOrEmail) =>
    teamMembers.value.find((member) => member.fk_user_id === ownerIdOrEmail || member.email === ownerIdOrEmail),
  )
})

const hasSoleTeamOwner = computed(() => {
  return team.value?.owners?.length < 2
})

const isTeamOwner = (member: TeamMember) => {
  return team.value?.owners?.includes(member.fk_user_id!) || team.value?.owners?.includes(member.email!)
}

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
    basis: '20%',
    minWidth: 200,
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

  const selectedMembers = filterMembers.value.filter((member) => selectedRows.value[member.fk_user_id!])

  return {
    selectedRowCount,
    selectedMembers,
    selectedMembersMap: new Map(selectedMembers.map((member) => [member.fk_user_id!, member])),
    isAllSelected: teamMembers.value.length > 0 && selectedRowCount === teamMembers.value.length,
    isSomeSelected: selectedRowCount > 0 && selectedRowCount < teamMembers.value.length,
  }
})

const hasSelectedAllOwners = computed(() => {
  return (
    selectedRowConfig.value.selectedRowCount > 0 &&
    teamOwners.value.every((member) => member?.fk_user_id && selectedRowConfig.value.selectedMembersMap.has(member.fk_user_id))
  )
})

const toggleSelectAll = (value: boolean) => {
  filterMembers.value.forEach((member) => {
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
    teamMembers.value = ((collaborators.value || []) as TeamMember[]).filter(
      (coll) =>
        team.value.members.includes(coll.fk_user_id!) ||
        team.value.members.includes(coll.email!) ||
        team.value.owners.includes(coll.fk_user_id!) ||
        team.value.owners.includes(coll.email!),
    )
  } catch (error: any) {
    message.error(await extractSdkResponseErrorMsg(error))
  } finally {
    isLoading.value = false
  }
}

const handleAssignAsTeamOwner = (member: TeamMember) => {
  team.value.owners.push(member.email!)
  // Todo: api call

  message.success({
    title: t('objects.teams.memberAssignedAsTeamOwner'),
    content: `${extractUserDisplayNameOrEmail(member)} is now a ${team.value?.title || 'team'} owner`,
  })
}

const handleConfirm = ({
  title,
  content,
  okText,
  cancelText,
  okProps: _okProps = {},
  okCallback = () => Promise.resolve(),
  initialSlots = {},
}: Partial<NcConfirmModalProps> & { okCallback?: () => Promise<void> }) => {
  const isOpen = ref(true)

  const okProps = ref({ loading: false, type: 'danger', ..._okProps })

  const slots = ref<Record<string, () => VNode[]>>(initialSlots)
  const { close } = useDialog(
    resolveComponent('NcModalConfirm'),
    {
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
    },
    {
      slots,
    },
  )

  function closeDialog() {
    isOpen.value = false
    close(1000)
  }
}

const handleLeaveTeam = (member: TeamMember) => {
  handleConfirm({
    title: t('objects.teams.confirmLeaveTeamTitle'),
    content: t('objects.teams.confirmLeaveTeamSubtitle'),
    okText: t('activity.leaveTeam'),
    cancelText: t('labels.cancel'),
    okCallback: async () => {
      // Todo: api call
      console.log('leave team', team.value)
      await ncDelay(1000)

      team.value.owners = team.value.owners.filter((owner) => owner !== member.email && owner !== member.fk_user_id!)
      team.value.members = team.value.members.filter(
        (teamMember) => teamMember !== member.email && teamMember !== member.fk_user_id!,
      )

      teamMembers.value = teamMembers.value.filter(
        (teamMember) => teamMember.email !== member.email && teamMember.fk_user_id !== member.fk_user_id,
      )

      delete selectedRows.value[member.fk_user_id!]

      // If current user leaves the team then we have to close modal and remove team from list
      emits('close')

      teams.value = teams.value.filter((t) => t.id !== team.value.id)

      console.log('team', team.value, teamMembers.value)
    },
  })
}

const handleRemoveMemberFromTeam = (members: TeamMember[]) => {
  if (!members.length) return

  const removeMemberIds = members.map((member) => member.fk_user_id!)
  const removeMemberEmails = members.map((member) => member.email!)

  const selectedMemberNameOrCount =
    removeMemberIds.length > 1 ? `${removeMemberIds.length} ${t('labels.members')}` : extractUserDisplayNameOrEmail(members[0])

  handleConfirm({
    title: `${
      removeMemberIds.length > 1 ? t('objects.teams.removeMemberFromTeamPlural') : t('objects.teams.removeMemberFromTeam')
    }?`,
    okText: t('general.remove'),
    cancelText: t('labels.cancel'),
    okCallback: async () => {
      // Todo: api call
      console.log('remove members from team', members)

      await ncDelay(1000)
      team.value.members = team.value.members.filter(
        (member) => !(removeMemberIds.includes(member) || removeMemberEmails.includes(member)),
      )
      team.value.owners = team.value.owners.filter(
        (owner) => !(removeMemberIds.includes(owner) || removeMemberEmails.includes(owner)),
      )

      emits('update:team', team.value)

      teamMembers.value = teamMembers.value.filter(
        (member) => !(removeMemberIds.includes(member.fk_user_id!) || removeMemberEmails.includes(member.email!)),
      )

      members.forEach((member) => {
        delete selectedRows.value[member.fk_user_id!]
      })

      console.log('team', team.value)
    },
    initialSlots: {
      content: () => [
        h(
          'div',
          {
            class: 'text-nc-content-gray-subtle2',
          },
          [
            h('div', {}, [
              'Are you sure you want to remove ',
              h('b', {}, selectedMemberNameOrCount),
              ' from the ',
              h('b', {}, team.value?.title),
              ' team?',
            ]),
          ],
        ),
      ],
    },
  })
}

const handleRemoveSelectedMembersFromTeam = () => {
  handleRemoveMemberFromTeam(selectedRowConfig.value.selectedMembers as TeamMember[])
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
          <div class="nc-modal-teams-edit-content-section-title text-bodyBold flex items-center gap-2">
            {{ $t('labels.members') }}
            <NcBadge v-if="!isLoading" size="xs" color="brand" :border="false" class="text-captionBold">
              {{ teamMembers.length }}
            </NcBadge>
          </div>

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
                <NcButton
                  size="small"
                  type="secondary"
                  class="absolute"
                  inner-class="!gap-2 text-nc-content-brand"
                  @click="isAddMembersModalVisible = true"
                >
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
                      <NcTooltip
                        :title="t('objects.teams.removeFromTeamRestrictionTooltip')"
                        placement="right"
                        :disabled="!hasSelectedAllOwners"
                      >
                        <NcMenuItem :disabled="hasSelectedAllOwners" danger @click="handleRemoveSelectedMembersFromTeam">
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
          <div class="w-full flex items-center gap-4 overflow-hidden">
            <NcUserInfo :user="record" :class="{ 'w-[calc(100%_-_100px)]': isTeamOwner(record) }" />

            <NcTooltip
              v-if="isTeamOwner(record)"
              :title="$t('objects.teams.teamOwner')"
              class="text-nc-content-gray-muted text-captionSm truncate"
              show-on-truncate-only
            >
              {{ $t('objects.teams.teamOwner') }}
            </NcTooltip>
          </div>
        </template>
        <template v-else-if="column.key === 'workspace_role'">
          <RolesBadge :border="false" :role="record.roles" class="cursor-default" />
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
                  <NcMenuItem v-if="!isTeamOwner(record as TeamMember)" @click="handleAssignAsTeamOwner(record as TeamMember)">
                    <GeneralIcon icon="ncArrowUpCircle" class="h-4 w-4" />
                    {{ $t('activity.assignAsTeamOwner') }}
                  </NcMenuItem>

                  <!-- Show leave team option only if logged in user is same as record user -->
                  <NcTooltip
                    v-if="record.fk_user_id === user?.id"
                    :disabled="!(hasSoleTeamOwner && isTeamOwner(record as TeamMember))"
                    :title="t('objects.teams.soleTeamOwnerTooltip')"
                    placement="left"
                  >
                    <NcMenuItem
                      :disabled="(hasSoleTeamOwner && isTeamOwner(record as TeamMember))"
                      danger
                      @click="handleLeaveTeam(record as TeamType)"
                    >
                      <GeneralIcon icon="ncLogOut" class="h-4 w-4" />
                      {{ $t('activity.leaveTeam') }}
                    </NcMenuItem>
                  </NcTooltip>

                  <NcTooltip
                    v-else
                    :disabled="!(hasSoleTeamOwner && isTeamOwner(record as TeamMember))"
                    :title="t('objects.teams.thisIsTheOnlyTeamOwnerTooltip')"
                    placement="left"
                  >
                    <NcMenuItem
                      :disabled="(hasSoleTeamOwner && isTeamOwner(record as TeamMember))"
                      danger
                      @click="handleRemoveMemberFromTeam([record as TeamMember])"
                    >
                      <GeneralIcon icon="ncXSquare" />
                      {{ $t('activity.removeFromTeam') }}
                    </NcMenuItem>
                  </NcTooltip>
                </NcMenu>
              </template>
            </NcDropdown>
          </div>
        </template>
      </template>
    </NcTable>

    <WorkspaceTeamsEditAddMembersModal v-model:visible="isAddMembersModalVisible" v-model:team="team" />
  </div>
</template>
