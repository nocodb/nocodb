<script lang="ts" setup>
import { WorkspaceUserRoles } from 'nocodb-sdk'

const { t } = useI18n()

const route = useRoute()

const { sorts, sortDirection, loadSorts, handleGetSortedData, saveOrUpdate: saveOrUpdateSort } = useUserSorts('Organization')

const { listWorkspaces, workspaces } = useOrganization()

const orgStore = useOrg()

const { orgId, org } = storeToRefs(orgStore)

const searchInput = ref('')

const extractOwner = (workspace: any) => {
  return workspace.members.find((u: any) => {
    return u.roles === WorkspaceUserRoles.OWNER
  })
}

const filteredWorkspaces = computed(() =>
  workspaces.value.filter((ws) => ws.title.toLowerCase().includes(searchInput.value.toLowerCase())),
)

const sortedWorkspaces = computed(() => {
  return handleGetSortedData(filteredWorkspaces.value, sorts.value)
})

const newWorkspaceDlg = ref(false)

const renameWorkspaceDlg = ref(false)
const renameWorkspaceName = ref('')

const addWorkspaceMemberDlg = ref(false)
const selectedWorkspaceId = ref('')
const addMemberToWorkspace = (id: string) => {
  addWorkspaceMemberDlg.value = true
  selectedWorkspaceId.value = id
}

watch(newWorkspaceDlg, (val) => {
  if (!val) {
    listWorkspaces()
  }
})

watch(renameWorkspaceDlg, (val) => {
  if (!val) {
    selectedWorkspaceId.value = ''
    listWorkspaces()
  }
})

const renameWorkspace = (id: string, title: string) => {
  renameWorkspaceName.value = title
  selectedWorkspaceId.value = id
  renameWorkspaceDlg.value = true
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
    key: 'title',
    title: t('labels.workspaceName'),
    minWidth: 288,
    dataIndex: 'title',
    showOrderBy: true,
  },
  {
    key: 'owner',
    title: t('objects.owner'),
    basis: '25%',
    minWidth: 252,
  },
  {
    key: 'memberCount',
    title: t('labels.numberOfMembers'),
    minWidth: 180,
    width: 180,
    dataIndex: 'memberCount',
    showOrderBy: true,
  },
  {
    key: 'baseCount',
    title: t('labels.numberOfBases'),
    minWidth: 180,
    width: 180,
    dataIndex: 'baseCount',
    showOrderBy: true,
  },
  {
    key: 'action',
    title: t('labels.actions'),
    width: 220,
    minWidth: 220,
    justify: 'justify-end',
  },
] as NcTableColumnProps[]

const customRow = (ws: Record<string, any>) => ({
  onClick: () => {
    navigateTo(`${route.params.page}/${ws.id}`)
  },
})

onMounted(() => {
  loadSorts()
  listWorkspaces()
})
</script>

<template>
  <div class="flex flex-col h-full" data-test-id="nc-admin-workspaces">
    <LazyDlgInviteDlg v-model:model-value="addWorkspaceMemberDlg" :workspace-id="selectedWorkspaceId" type="workspace" />
    <LazyWorkspaceCreateDlg v-model:model-value="newWorkspaceDlg" :org-id="orgId" />
    <LazyDlgRenameWorkspace
      v-if="renameWorkspaceDlg"
      v-model:model-value="renameWorkspaceDlg"
      v-model:title="renameWorkspaceName"
      v-model:workspace-id="selectedWorkspaceId"
    />
    <div class="h-full flex flex-col w-full">
      <div class="nc-breadcrumb px-2">
        <div class="nc-breadcrumb-item">
          {{ org.title }}
        </div>
        <GeneralIcon icon="ncSlash1" class="nc-breadcrumb-divider" />
        <div class="nc-breadcrumb-item active">
          {{ $t('labels.workspaces') }}
        </div>
      </div>
      <NcPageHeader>
        <template #icon>
          <GeneralIcon class="flex-none !h-5 !w-5" icon="ncWorkspace" />
        </template>
        <template #title>
          <span data-rec="true">
            {{ $t('labels.workspaces') }}
          </span>
        </template>
      </NcPageHeader>

      <div class="nc-content-max-w flex-1 max-h-[calc(100vh_-_100px)] overflow-y-auto nc-scrollbar-thin flex flex-col gap-6 p-6">
        <div class="w-full justify-between flex items-center">
          <a-input v-model:value="searchInput" placeholder="Search for a workspace">
            <template #prefix>
              <component :is="iconMap.search" class="w-4 text-gray-500 h-4" />
            </template>
          </a-input>
          <div class="flex items-center gap-6">
            <NcButton type="secondary" @click="newWorkspaceDlg = true">
              <component :is="iconMap.plus" />
              {{ $t('activity.newWorkspace') }}
            </NcButton>
          </div>
        </div>

        <NcTable
          v-model:order-by="orderBy"
          :columns="columns"
          :data="sortedWorkspaces"
          :bordered="false"
          :custom-row="customRow"
          data-testid="nc-org-members-list"
          class="flex-1 nc-org-workspace-list"
        >
          <template #bodyCell="{ column, record: ws }">
            <div v-if="column.key === 'title'" class="w-full gap-3 flex items-center">
              <GeneralWorkspaceIcon :workspace="ws" hide-label />
              <NcTooltip class="truncate max-w-[calc(100%_-_28px)]" show-on-truncate-only>
                <template #title>
                  {{ ws.title }}
                </template>
                <span class="capitalize font-semibold text-gray-800">
                  {{ ws.title }}
                </span>
              </NcTooltip>
            </div>

            <div v-if="column.key === 'owner'" class="w-full flex gap-3 items-center">
              <GeneralUserIcon :email="extractOwner(ws)?.email" size="base" class="flex-none" />
              <div class="flex flex-col flex-1 max-w-[calc(100%_-_44px)]">
                <div class="flex gap-3">
                  <NcTooltip class="truncate max-w-full text-gray-800 capitalize font-semibold" show-on-truncate-only>
                    <template #title>
                      {{ extractOwner(ws)?.display_name || extractOwner(ws)?.email.split('@')[0] }}
                    </template>
                    {{ extractOwner(ws)?.display_name || extractOwner(ws)?.email.split('@')[0] }}
                  </NcTooltip>
                </div>
                <NcTooltip class="truncate max-w-full text-xs text-gray-600" show-on-truncate-only>
                  <template #title>
                    {{ extractOwner(ws)?.email }}
                  </template>
                  {{ extractOwner(ws)?.email }}
                </NcTooltip>
              </div>
            </div>
            <div v-if="column.key === 'memberCount'">
              {{ ws.memberCount }}
            </div>
            <div v-if="column.key === 'baseCount'">
              {{ ws.baseCount }}
            </div>
            <div v-if="column.key === 'action'" class="flex justify-end" @click.stop>
              <NcButton class="!rounded-r-none" size="small" type="secondary" @click.prevent="addMemberToWorkspace(ws.id)">
                <div class="flex items-center gap-2">
                  <component :is="iconMap.accountPlus" />
                  {{ $t('labels.addMember') }}
                </div>
              </NcButton>
              <NcDropdown>
                <NcButton class="!rounded-l-none !border-l-0" size="small" type="secondary">
                  <component :is="iconMap.threeDotVertical" />
                </NcButton>
                <template #overlay>
                  <NcMenu>
                    <NcMenuItem data-testid="nc-admin-org-workspace-rename-ws" @click="renameWorkspace(ws.id, ws.title)">
                      <GeneralIcon class="text-gray-800" icon="rename" />
                      <span>{{ $t('general.rename') }}</span>
                    </NcMenuItem>
                    <NuxtLink
                      :href="`${$route.params.page}/${ws.id}`"
                      class="!underline-transparent !text-gray-800 !hover:text-gray-800"
                    >
                      <NcMenuItem data-testid="nc-admin-org-user-delete">
                        <GeneralIcon class="text-gray-800" icon="user" />
                        <span>{{ $t('activity.manageUsers') }}</span>
                      </NcMenuItem>
                    </NuxtLink>
                    <!--
                        <a-menu-divider class="my-1.5" />

                        <NcMenuItem class="!hover:bg-red-50" data-testid="nc-admin-org-user-delete">
                          <div class="text-red-500">
                            <GeneralIcon class="group-hover:text-accent -ml-0.25 -mt-0.75 mr-0.5" icon="slash" />
                            {{ $t('activity.deactivate') }}
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
