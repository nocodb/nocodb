<script lang="ts" setup>
const { t } = useI18n()

const { sorts, sortDirection, loadSorts, handleGetSortedData, saveOrUpdate: saveOrUpdateSort } = useUserSorts('Organization')

const { org } = storeToRefs(useOrg())

const organizationStore = useOrganization()

const { fetchOrganizationMembers, listWorkspaces } = organizationStore

const { members } = organizationStore

const searchInput = ref('')

// Used to store the selected Users for the bulk actions
// To be cleared after the action is performed and when search is used, also when page is changed
const selected = reactive<{
  [key: number]: boolean
}>({})
const filteredMembers = computed(() =>
  members.value.filter((member) => (member.display_name || member.email).toLowerCase().includes(searchInput.value.toLowerCase())),
)

const sortedMembers = computed(() => {
  return handleGetSortedData(filteredMembers.value, sorts.value)
})

const toggleSelectAll = (value: boolean) => {
  sortedMembers.value.forEach((_, i) => {
    selected[i] = value
  })
}

const selectAll = computed({
  get: () =>
    Object.values(selected).every((v) => v) &&
    Object.keys(selected).length > 0 &&
    Object.values(selected).length === sortedMembers.value.length,
  set: (value) => {
    toggleSelectAll(value)
  },
})

const isSomeSelected = computed(() => Object.values(selected).some((v) => v))
const bulkAddMemberDlg = ref(false)

const bulkOpsEmails = ref<string[]>([])

const inviteUsersToWorkspace = () => {
  bulkAddMemberDlg.value = true
}

const inviteUserToWorkspace = (email: string) => {
  bulkOpsEmails.value = [email]
  bulkAddMemberDlg.value = true
}

const orderBy = computed<Record<string, SordDirectionType>>({
  get: () => {
    return sortDirection.value
  },
  set: (value: Record<string, SordDirectionType>) => {
    // Check if value is an empty object
    if (Object.keys(value).length === 0) {
      saveOrUpdateSort({})
      return
    }

    const [field, direction] = Object.entries(value)[0]

    saveOrUpdateSort({
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
    title: t('objects.member'),
    minWidth: 288,
    dataIndex: 'email',
    showOrderBy: true,
  },
  {
    key: 'workspaceCount',
    title: t('labels.workspaces'),
    width: 180,
    minWidth: 180,
    dataIndex: 'workspaceCount',
    showOrderBy: true,
  },
  {
    key: 'dateAdded',
    title: t('labels.dateAdded'),
    minWidth: 180,
    width: 180,
  },
  {
    key: 'lastActive',
    title: t('labels.lastActive'),
    minWidth: 180,
    width: 180,
  },
  {
    key: 'action',
    title: t('labels.actions'),
    width: 120,
    minWidth: 120,
    justify: 'justify-end',
  },
] as NcTableColumnProps[]

const customRow = (_record: Record<string, any>, recordIndex: number) => ({
  class: `${selected[recordIndex] ? 'selected' : ''} last:!border-b-0`,
})

watch(bulkAddMemberDlg, (val) => {
  if (!val) {
    bulkOpsEmails.value = []
    fetchOrganizationMembers()
  }
})

onMounted(() => {
  fetchOrganizationMembers()
  listWorkspaces()
  loadSorts()
})

watch(selected, () => {
  bulkOpsEmails.value = sortedMembers.value.filter((_collab, i) => selected[i]).map((collab) => collab.email)
})
</script>

<template>
  <div class="flex flex-col h-full" data-test-id="nc-admin-members">
    <LazyDlgInviteDlg v-model:model-value="bulkAddMemberDlg" :emails="bulkOpsEmails" type="organization" />
    <div class="nc-breadcrumb px-2">
      <div class="nc-breadcrumb-item">
        {{ org.title }}
      </div>
      <GeneralIcon icon="ncSlash1" class="nc-breadcrumb-divider" />
      <div class="nc-breadcrumb-item active">
        {{ $t('labels.members') }}
      </div>
    </div>
    <NcPageHeader>
      <template #icon>
        <GeneralIcon icon="users" class="flex-none h-5 w-5" />
      </template>
      <template #title>
        <span data-rec="true">
          {{ $t('labels.members') }}
        </span>
      </template>
    </NcPageHeader>
    <div class="nc-content-max-w h-full max-h-[calc(100vh_-_100px)] flex flex-col items-center gap-6 p-6">
      <div class="w-full justify-between flex items-center">
        <div class="flex items-center gap-2">
          <a-input v-model:value="searchInput" placeholder="Search for a member">
            <template #prefix>
              <component :is="iconMap.search" class="w-4 text-gray-500 h-4" />
            </template>
          </a-input>
          <NcDropdown>
            <NcButton :disabled="!isSomeSelected">
              <div class="flex gap-2 items-center">
                <component :is="iconMap.threeDotVertical" />
                {{ $t('labels.action') }}
              </div>
            </NcButton>
            <template #overlay>
              <NcMenu>
                <NcMenuItem @click="inviteUsersToWorkspace">
                  <GeneralIcon class="text-gray-800" icon="email" />
                  <span>{{ $t('labels.inviteUsersToWorkspace') }}</span>
                </NcMenuItem>
              </NcMenu>
            </template>
          </NcDropdown>
        </div>

        <NcButton @click="bulkAddMemberDlg = true">
          <component :is="iconMap.plus" />
          {{ $t('activity.addMembers') }}
        </NcButton>
      </div>

      <NcTable
        v-model:order-by="orderBy"
        :columns="columns"
        :data="sortedMembers"
        :bordered="false"
        :custom-row="customRow"
        data-testid="nc-org-members-list"
        class="flex-1 nc-org-members-list"
      >
        <template #headerCell="{ column }">
          <template v-if="column.key === 'select'">
            <NcCheckbox v-model:checked="selectAll" :disabled="!sortedMembers.length" />
          </template>
          <template v-else>
            {{ column.title }}
          </template>
        </template>

        <template #bodyCell="{ column, record: member, recordIndex }">
          <template v-if="column.key === 'select'">
            <NcCheckbox v-model:checked="selected[recordIndex]" />
          </template>
          <div v-if="column.key === 'email'" class="w-full flex gap-3 items-center">
            <GeneralUserIcon :email="member?.email" size="base" class="flex-none" />
            <div class="flex flex-col flex-1 max-w-[calc(100%_-_44px)]">
              <div class="flex gap-3">
                <NcTooltip
                  class="truncate text-gray-800 capitalize font-semibold"
                  :class="{
                    'max-w-1/2': member.cloud_org_roles,
                    'max-w-full': !member.cloud_org_roles,
                  }"
                  show-on-truncate-only
                >
                  <template #title>
                    {{ member.display_name || member.email.split('@')[0] }}
                  </template>
                  {{ member.display_name || member.email.split('@')[0] }}
                </NcTooltip>
                <RolesBadge v-if="member.cloud_org_roles" :border="false" :role="member.cloud_org_roles" :show-icon="false" />
              </div>
              <NcTooltip class="truncate max-w-full text-xs text-gray-600" show-on-truncate-only>
                <template #title>
                  {{ member.email }}
                </template>
                {{ member.email }}
              </NcTooltip>
            </div>
          </div>

          <div v-if="column.key === 'workspaceCount'" class="w-full">
            <NcDropdown :trigger="['hover']">
              <div class="w-full">
                {{ member.workspaceCount }}
              </div>

              <template #overlay>
                <div class="rounded-lg">
                  <div class="rounded-t-lg font-medium bg-gray-100 py-1.5 px-2">
                    {{ $t('labels.memberIn') }}
                  </div>
                  <div class="max-h-72 nc-scrollbar-md overflow-y-auto">
                    <div
                      v-for="x in member.workspaces"
                      :key="x.id"
                      class="flex gap-3 px-2 py-3 w-72 justify-between font-semibold items-center"
                    >
                      <div class="flex gap-3">
                        <!--
                            <GeneralWorkspaceIcon :workspace="x" hide-label />
-->
                        {{ x.title }}
                      </div>

                      <RolesBadge :border="false" :show-icon="true" icon-only role="owner" />
                    </div>
                  </div>
                </div>
              </template>
            </NcDropdown>
          </div>
          <div v-if="column.key === 'dateAdded'">
            <NcTooltip class="max-w-full">
              <template #title>
                {{ parseStringDateTime(member?.created_at) }}
              </template>
              <span>
                {{ timeAgo(member?.created_at) }}
              </span>
            </NcTooltip>
          </div>
          <div v-if="column.key === 'lastActive'">
            <NcTooltip class="max-w-full">
              <template #title>
                {{ parseStringDateTime(member?.created_at) }}
              </template>
              <span>
                {{ timeAgo(member?.created_at) }}
              </span>
            </NcTooltip>
          </div>

          <div v-if="column.key === 'action'" class="flex justify-end" @click.stop>
            <NcDropdown>
              <NcButton size="small" type="secondary">
                <component :is="iconMap.threeDotVertical" />
              </NcButton>
              <template #overlay>
                <NcMenu>
                  <NcMenuItem data-testid="nc-admin-org-user-assign-admin" @click="inviteUserToWorkspace(member.email)">
                    <GeneralIcon class="text-gray-800" icon="send" />
                    <span>{{ $t('activity.inviteToWorkspace') }}</span>
                  </NcMenuItem>

                  <!--                      <NcMenuItem data-testid="nc-admin-org-user-delete">
                        <GeneralIcon class="text-gray-800" icon="signout" />
                        <span>{{ $t('labels.signOutUser') }}</span>
                      </NcMenuItem>

                      <a-menu-divider class="my-1.5" />

                      <NcMenuItem class="!hover:bg-red-50" data-testid="nc-admin-org-user-delete">
                        <div class="text-red-500">
                          <GeneralIcon class="group-hover:text-accent -ml-0.25 -mt-0.75 mr-0.5" icon="delete" />
                          {{ $t('labels.deactivateUser') }}
                        </div>
                      </NcMenuItem> -->
                </NcMenu>
              </template>
            </NcDropdown>
          </div>
        </template>
      </NcTable>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.ant-input::placeholder {
  @apply text-gray-500;
}

.ant-input:placeholder-shown {
  @apply text-gray-500 !text-md;
}

.ant-input-affix-wrapper {
  @apply px-4 rounded-lg py-2 w-84 border-1 focus:border-brand-500 border-gray-200 !ring-0;
}
</style>
