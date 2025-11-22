<script lang="ts" setup>
import { TeamUserRoles, WorkspaceUserRoles } from 'nocodb-sdk'
import type { TeamMemberV3ResponseV3Type, TeamV3V3Type, WorkspaceUserType } from 'nocodb-sdk'

import type { NcConfirmModalProps } from '~/components/nc/ModalConfirm.vue'

export type TeamMember = TeamMemberV3ResponseV3Type & WorkspaceUserType

interface Props {
  team: TeamV3V3Type
  tableToolbarClassName?: string
  readOnly: boolean
}

const props = withDefaults(defineProps<Props>(), {})

const emits = defineEmits<{
  (e: 'update:team', value: TeamV3V3Type): void
  (e: 'close'): void
}>()

const team = useVModel(props, 'team', emits)

const { readOnly } = toRefs(props)

const { t } = useI18n()

const { user } = useGlobal()

const workspaceStore = useWorkspace()

const { collaboratorsMap, activeWorkspaceId, editTeamDetails } = storeToRefs(workspaceStore)

const teamMembers = computed<TeamMember[]>(() => {
  return (editTeamDetails.value?.members || []).map((member) => ({
    ...member,
    ...(collaboratorsMap.value[member.user_id] || collaboratorsMap.value[member.user_email] || {}),
  }))
})

const isLoading = ref(true)

const searchQuery = ref('')

const isOpenContextMenu = ref<Record<string, boolean>>({})

const isAddMembersModalVisible = ref(false)

const filterMembers = computed(() => {
  if (!searchQuery.value) return teamMembers.value ?? []

  return teamMembers.value.filter((member) => searchCompare([member.display_name, member.email], searchQuery.value))
})

const teamOwners = computed(() => {
  return teamMembers.value.filter((member) => member.team_role === TeamUserRoles.OWNER)
})

const hasSoleTeamOwner = computed(() => {
  return teamOwners.value.length < 2
})

const isTeamOwner = (member: TeamMember) => {
  return member.team_role === TeamUserRoles.OWNER
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

  await workspaceStore.getTeamById(activeWorkspaceId.value!, team.value.id)

  isLoading.value = false
}

const handleAssignAsRole = async (member: TeamMember, role: TeamUserRoles) => {
  const res = await workspaceStore.updateTeamMembers(activeWorkspaceId.value!, team.value.id, [
    { user_id: member.user_id!, team_role: role },
  ])

  if (res) {
    message.success({
      content: `${extractUserDisplayNameOrEmail(member)} is now a ${team.value?.title || 'team'} ${
        role === TeamUserRoles.OWNER ? 'owner' : 'member'
      }`,
      showDuration: false,
    })
  }
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
      const removedMembers = await workspaceStore.removeTeamMembers(activeWorkspaceId.value!, team.value.id, [
        { user_id: member.user_id || member.fk_user_id! },
      ])

      if (removedMembers) {
        removedMembers.forEach((member) => {
          delete selectedRows.value[member.user_id!]
        })
      }

      // If current user leaves the team then we have to close modal and remove team from list
      emits('close')
    },
  })
}

const handleRemoveMemberFromTeam = (members: TeamMember[]) => {
  if (!members.length) return

  const removeMemberIds = members.map((member) => member.fk_user_id!)

  const selectedMemberNameOrCount =
    removeMemberIds.length > 1 ? `${removeMemberIds.length} ${t('labels.members')}` : extractUserDisplayNameOrEmail(members[0])

  handleConfirm({
    title: `${
      removeMemberIds.length > 1 ? t('objects.teams.removeMemberFromTeamPlural') : t('objects.teams.removeMemberFromTeam')
    }?`,
    okText: t('general.remove'),
    cancelText: t('labels.cancel'),
    okCallback: async () => {
      const removedMembers = await workspaceStore.removeTeamMembers(
        activeWorkspaceId.value!,
        team.value.id,
        members.map((member) => ({ user_id: member.user_id || member.fk_user_id! })),
      )

      if (removedMembers) {
        removedMembers.forEach((member) => {
          delete selectedRows.value[member.user_id!]
        })
      }
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

            <div v-if="!readOnly" class="relative children:flex-none min-w-[150px] min-h-8 flex items-center justify-end">
              <div v-if="!selectedRowConfig.selectedRowCount">
                <NcButton
                  size="small"
                  type="secondary"
                  class="absolute"
                  text-color="primary"
                  inner-class="!gap-2"
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
            :disabled="!teamMembers.length || readOnly"
            @update:checked="toggleSelectAll"
          />
        </template>
        <template v-else>
          {{ column.title }}
        </template>
      </template>

      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'select'">
          <NcCheckbox v-model:checked="selectedRows[record.fk_user_id!]" :disabled="readOnly" />
        </template>
        <template v-else-if="column.key === 'member_name'">
          <div class="w-full flex items-center gap-4 overflow-hidden">
            <NcUserInfo :user="record" class="min-w-20" :class="{ 'max-w-[calc(100%_-_100px)] !w-auto': isTeamOwner(record) }" />

            <RolesBadge
              v-if="isTeamOwner(record)"
              :border="false"
              :role="WorkspaceUserRoles.OWNER"
              class="cursor-default"
              :show-icon="false"
              show-tooltip
              show-on-truncate-only
            >
              <template #tooltip>
                {{ $t('objects.teams.teamOwner') }}
              </template>
              <template #label>
                <span class="text-bodySm">
                  {{ $t('objects.teams.teamOwner') }}
                </span>
              </template>
            </RolesBadge>
          </div>
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
                  <NcMenuItem
                    v-if="!isTeamOwner(record as TeamMember)"
                    v-e="['c:team:assign-as-owner', { teamId: team.id, userId: record.fk_user_id }]"
                    :disabled="readOnly"
                    @click="handleAssignAsRole(record as TeamMember, TeamUserRoles.OWNER)"
                  >
                    <GeneralIcon icon="ncArrowUpCircle" class="h-4 w-4" />
                    {{ $t('activity.assignAsTeamOwner') }}
                  </NcMenuItem>
                  <NcMenuItem
                    v-if="!hasSoleTeamOwner && isTeamOwner(record as TeamMember)"
                    v-e="['c:team:remove-as-owner', { teamId: team.id, userId: record.fk_user_id }]"
                    :disabled="readOnly"
                    @click="handleAssignAsRole(record as TeamMember, TeamUserRoles.MEMBER)"
                  >
                    <GeneralIcon icon="ncArrowUpCircle" class="h-4 w-4 transform rotate-180" />
                    {{ $t('activity.removeAsTeamOwner') }}
                  </NcMenuItem>

                  <!-- Show leave team option only if logged in user is same as record user -->
                  <NcTooltip
                    v-if="record.fk_user_id === user?.id"
                    :disabled="!(hasSoleTeamOwner && isTeamOwner(record as TeamMember)) || readOnly"
                    :title="t('objects.teams.soleTeamOwnerTooltip')"
                    placement="left"
                  >
                    <NcMenuItem
                      v-e="['c:team:member-leave', { teamId: team.id, userId: record.fk_user_id }]"
                      :disabled="(hasSoleTeamOwner && isTeamOwner(record as TeamMember))"
                      danger
                      @click="handleLeaveTeam(record as TeamMember)"
                    >
                      <GeneralIcon icon="ncLogOut" class="h-4 w-4" />
                      {{ $t('activity.leaveTeam') }}
                    </NcMenuItem>
                  </NcTooltip>

                  <NcTooltip
                    v-else
                    v-e="['c:team:member-remove', { teamId: team.id, userId: record.fk_user_id }]"
                    :disabled="!(hasSoleTeamOwner && isTeamOwner(record as TeamMember)) || readOnly"
                    :title="t('objects.teams.thisIsTheOnlyTeamOwnerTooltip')"
                    placement="left"
                  >
                    <NcMenuItem
                      :disabled="(hasSoleTeamOwner && isTeamOwner(record as TeamMember)) || readOnly"
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

    <WorkspaceTeamsEditAddMembersModal
      v-model:visible="isAddMembersModalVisible"
      v-model:team="team"
      :team-members="teamMembers"
    />
  </div>
</template>
