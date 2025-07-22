<script lang="ts" setup>
import type { UserInfoType, UserType, WorkspaceUserType } from 'nocodb-sdk'

interface Props {
  team: TeamType
  tableToolbarClassName?: string
}

interface TeamMember extends WorkspaceUserType, Omit<UserType, 'roles' | 'email' | 'id'> {}

const props = withDefaults(defineProps<Props>(), {})

const { team } = toRefs(props)

const { t } = useI18n()

const workspaceStore = useWorkspace()

const { collaborators } = storeToRefs(workspaceStore)

const teamMembers = ref<TeamMember[]>([])

const isLoading = ref(true)

const searchQuery = ref('')

const filterMembers = computed(() => {
  if (!searchQuery.value) return teamMembers.value ?? []

  return teamMembers.value.filter((member) => searchCompare([member.display_name, member.email], searchQuery.value))
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
            <NcDropdown placement="bottomRight">
              <NcButton size="small" type="secondary">
                <component :is="iconMap.ncMoreVertical" />
              </NcButton>
              <template #overlay>
                <NcMenu variant="medium">
                  <NcMenuItem>
                    <GeneralIcon icon="ncArrowUpCircle" class="h-4 w-4" />
                    {{ $t('activity.assignAsTeamOwner') }}
                  </NcMenuItem>
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
  </div>
</template>
