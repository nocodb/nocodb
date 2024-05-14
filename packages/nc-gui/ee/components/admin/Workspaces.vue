<script lang="ts" setup>
import { WorkspaceUserRoles } from 'nocodb-sdk'

const { sorts, loadSorts, handleGetSortedData, toggleSort } = useUserSorts('Organization')

const { listWorkspaces, workspaces } = useOrganization()

const orgStore = useOrg()

const { orgId } = storeToRefs(orgStore)

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

onMounted(() => {
  loadSorts()
  listWorkspaces()
})
</script>

<template>
  <div class="flex flex-col items-center" data-test-id="nc-admin-workspaces">
    <LazyDlgInviteDlg v-model:model-value="addWorkspaceMemberDlg" :workspace-id="selectedWorkspaceId" type="workspace" />
    <LazyWorkspaceCreateDlg v-model:model-value="newWorkspaceDlg" :org-id="orgId" />
    <LazyDlgRenameWorkspace
      v-if="renameWorkspaceDlg"
      v-model:model-value="renameWorkspaceDlg"
      v-model:title="renameWorkspaceName"
      v-model:workspace-id="selectedWorkspaceId"
    />
    <div class="flex flex-col w-full px-6 max-w-[97.5rem]">
      <span class="font-bold w-full text-2xl" data-rec="true">
        {{ $t('labels.workspaces') }}
      </span>
      <div class="w-full justify-between mt-5 flex items-center">
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

      <div class="mt-5 h-full" data-testid="nc-org-members-list">
        <div class="flex flex-col overflow-hidden min-h-[calc(100%-8rem)]">
          <div class="flex flex-row bg-gray-50 max-h-11 items-center border-b-1">
            <LazyAccountHeaderWithSorter
              class="text-gray-500 w-[18rem] px-6 py-3 users-email-grid"
              :header="$t('labels.workspaceName')"
              :active-sort="sorts"
              field="title"
              :toggle-sort="toggleSort"
            />
            <div class="text-gray-500 w-[16rem] px-6 py-3 users-email-grid flex items-center space-x-2">
              <span>
                {{ $t('objects.owner') }}
              </span>
            </div>
            <LazyAccountHeaderWithSorter
              :active-sort="sorts"
              :header="$t('labels.numberOfMembers')"
              :toggle-sort="toggleSort"
              class="text-gray-500 w-full flex-1 px-6 py-3 flex items-center space-x-2"
              field="memberCount"
            />

            <LazyAccountHeaderWithSorter
              :active-sort="sorts"
              :header="$t('labels.numberOfBases')"
              :toggle-sort="toggleSort"
              class="text-gray-500 w-full flex-1 px-6 py-3 flex items-center space-x-2"
              field="baseCount"
            />

            <!--
            <LazyAccountHeaderWithSorter
              class="text-gray-500 w-52 flex-1 px-6 py-3 flex items-center space-x-2 cursor-pointer"
              :header="$t('labels.numberOfRecords')"
              :active-sort="sorts"
              field="workspace"
              :toggle-sort="toggleSort"
            />
            -->
            <div class="text-gray-500 text-right w-52 flex-1 px-6 py-3">{{ $t('labels.actions') }}</div>
          </div>
          <div class="flex flex-col nc-scrollbar-md">
            <NuxtLink
              v-for="(ws, i) of sortedWorkspaces"
              :key="i"
              :href="`${$route.params.page}/${ws.id}`"
              class="!underline-transparent !max-h-13 border-b-1 border-gray-200 !text-gray-800 !hover:text-gray-800"
            >
              <div class="workspace-row flex hover:bg-[#F0F3FF] flex-row last:border-b-0 border-b-1 py-1 items-center">
                <div class="!w-[18rem] gap-3 flex items-center px-6 py-3">
                  <GeneralWorkspaceIcon :workspace="ws" hide-label />
                  <NcTooltip class="max-w-full" show-on-truncate-only>
                    <template #title>
                      {{ ws.title }}
                    </template>
                    <span class="capitalize">
                      {{ ws.title }}
                    </span>
                  </NcTooltip>
                </div>
                <div class="flex gap-3 px-6 py-1.5 !w-[16rem] items-center">
                  <GeneralUserIcon :email="extractOwner(ws)?.email" size="base" />
                  <div class="flex flex-col">
                    <div class="flex gap-3">
                      <span class="text-gray-800 font-semibold">
                        {{ extractOwner(ws)?.display_name || extractOwner(ws)?.email.split('@')[0] }}
                      </span>
                    </div>
                    <span class="text-xs text-gray-600">
                      {{ extractOwner(ws)?.email }}
                    </span>
                  </div>
                </div>
                <div class="w-full flex-1 px-6 py-3">
                  <NcTooltip class="max-w-full" show-on-truncate-only>
                    <template #title>
                      {{ ws.memberCount }}
                    </template>
                    <span>
                      {{ ws.memberCount }}
                    </span>
                  </NcTooltip>
                </div>
                <div class="w-full flex-1 px-6 py-3 flex">
                  <NcTooltip class="max-w-full" show-on-truncate-only>
                    <template #title>
                      {{ ws.baseCount }}
                    </template>
                    <span>
                      {{ ws.baseCount }}
                    </span>
                  </NcTooltip>
                </div>
                <!--
               <div class="w-full flex-1 px-6 py-3 flex">
                 <NcTooltip class="max-w-full">
                   <template #title>
                     {{ ws.records }}
                   </template>
                   <span>
                     {{ ws.records }}
                   </span>
                 </NcTooltip>
               </div> -->
                <div class="w-52 flex-1 flex justify-end px-6 py-1.5">
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
              </div>
            </NuxtLink>
          </div>
        </div>
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
