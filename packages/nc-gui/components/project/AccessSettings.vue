<script lang="ts" setup>
import type { OrgUserRoles, WorkspaceUserRoles } from 'nocodb-sdk'
import { OrderedProjectRoles, ProjectRoles, WorkspaceRolesToProjectRoles } from 'nocodb-sdk'
import InfiniteLoading from 'v3-infinite-loading'
import { isEeUI, storeToRefs, stringToColour, timeAgo } from '#imports'

const basesStore = useBases()
const { getProjectUsers, createProjectUser, updateProjectUser, removeProjectUser } = basesStore
const { activeProjectId } = storeToRefs(basesStore)

const { baseRoles } = useRoles()

const collaborators = ref<
  {
    id: string
    email: string
    main_roles: OrgUserRoles
    roles: ProjectRoles
    workspace_roles: WorkspaceUserRoles
    created_at: string
  }[]
>([])
const totalCollaborators = ref(0)
const userSearchText = ref('')
const currentPage = ref(0)

const isLoading = ref(false)
const isSearching = ref(false)
const accessibleRoles = ref<(typeof ProjectRoles)[keyof typeof ProjectRoles][]>([])

const loadCollaborators = async () => {
  try {
    currentPage.value += 1

    const { users, totalRows } = await getProjectUsers({
      baseId: activeProjectId.value!,
      page: currentPage.value,
      ...(!userSearchText.value ? {} : ({ searchText: userSearchText.value } as any)),
      limit: 20,
    })

    totalCollaborators.value = totalRows
    collaborators.value = [
      ...collaborators.value,
      ...users.map((user: any) => ({
        ...user,
        base_roles: user.roles,
        roles:
          user.roles ??
          (user.workspace_roles
            ? WorkspaceRolesToProjectRoles[user.workspace_roles as WorkspaceUserRoles] ?? ProjectRoles.NO_ACCESS
            : ProjectRoles.NO_ACCESS),
      })),
    ]
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const loadListData = async ($state: any) => {
  const prevUsersCount = collaborators.value?.length || 0
  if (collaborators.value?.length === totalCollaborators.value) {
    $state.complete()
    return
  }
  $state.loading()
  // const oldPagesCount = currentPage.value || 0

  onMounted(async () => {
    await loadCollaborators()
    console.log(collaborators)
  })

  if (prevUsersCount === collaborators.value?.length) {
    $state.complete()
    return
  }
  $state.loaded()
}

const reloadCollabs = async () => {
  currentPage.value = 0
  collaborators.value = []
  await loadCollaborators()
}

const updateCollaborator = async (collab: any, roles: ProjectRoles) => {
  try {
    if (
      !roles ||
      (roles === ProjectRoles.NO_ACCESS && !isEeUI) ||
      (collab.workspace_roles && WorkspaceRolesToProjectRoles[collab.workspace_roles as WorkspaceUserRoles] === roles && isEeUI)
    ) {
      await removeProjectUser(activeProjectId.value!, collab)
      if (
        collab.workspace_roles &&
        WorkspaceRolesToProjectRoles[collab.workspace_roles as WorkspaceUserRoles] === roles &&
        isEeUI
      ) {
        collab.roles = WorkspaceRolesToProjectRoles[collab.workspace_roles as WorkspaceUserRoles]
      } else {
        collab.roles = ProjectRoles.NO_ACCESS
      }
    } else if (collab.base_roles) {
      collab.roles = roles
      await updateProjectUser(activeProjectId.value!, collab)
    } else {
      collab.roles = roles
      await createProjectUser(activeProjectId.value!, collab)
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    reloadCollabs()
  }
}

watchDebounced(
  userSearchText,
  async () => {
    isSearching.value = true

    currentPage.value = 0
    totalCollaborators.value = 0
    collaborators.value = []

    try {
      await loadCollaborators()
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    } finally {
      isSearching.value = false
    }
  },
  {
    debounce: 300,
    maxWait: 600,
  },
)

onMounted(async () => {
  isLoading.value = true
  try {
    await loadCollaborators()
    const currentRoleIndex = OrderedProjectRoles.findIndex(
      (role) => baseRoles.value && Object.keys(baseRoles.value).includes(role),
    )
    if (currentRoleIndex !== -1) {
      accessibleRoles.value = OrderedProjectRoles.slice(currentRoleIndex + 1)
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <div class="nc-collaborator-table-container mt-4 nc-access-settings-view">
    <div v-if="isLoading" class="nc-collaborators-list items-center justify-center">
      <GeneralLoader size="xlarge" />
    </div>
    <template v-else>
      <div class="w-full flex flex-row justify-between items-baseline mt-6.5 mb-2 pr-0.25 ml-2">
        <a-input v-model:value="userSearchText" class="!max-w-90 !rounded-md" :placeholder="$t('title.searchMembers')">
          <template #prefix>
            <PhMagnifyingGlassBold class="!h-3.5 text-gray-500" />
          </template>
        </a-input>
      </div>

      <div v-if="isSearching" class="nc-collaborators-list items-center justify-center">
        <GeneralLoader size="xlarge" />
      </div>

      <div
        v-else-if="!collaborators?.length"
        class="nc-collaborators-list w-full h-full flex flex-col items-center justify-center mt-36"
      >
        <Empty description="$t('title.noMembersFound')" />
      </div>
      <div v-else class="nc-collaborators-list !mt-10 rounded-md">
        <div class="h-200 overflow-y-auto nc-scrollbar-md">
          <table>
            <thead class="bg-gray-50 border-1 h-10">
              <th class="text-start w-1/4 text-gray-700">{{ $t('objects.users') }}</th>
              <th class="text-start w-1/4 text-gray-700">{{ $t('title.dateJoined') }}</th>
              <th class="text-start w-1/4 text-gray-700">{{ $t('general.access') }}</th>
              <th class="text-start w-1/4 text-gray-700">Actions</th>
            </thead>
            <tbody>
              <tr v-for="(collab, i) of collaborators" :key="i" class="border-b-1 py-1 h-14">
                <td class="flex gap-3 justify-start items-center h-14 pl-8">
                  <GeneralUserIcon size="base" :email="collab.email" />
                  <span class="truncate">
                    {{ collab.email }}
                  </span>
                </td>
                <td class="w-1/4 text-center">
                  {{ timeAgo(collab.created_at) }}
                </td>
                <td class="w-1/4">
                  <template v-if="accessibleRoles.includes(collab.roles)">
                    <div class="flex justify-center items-center">
                      <RolesSelector
                        :role="collab.roles"
                        :roles="accessibleRoles"
                        :inherit="
                          isEeUI && collab.workspace_roles && WorkspaceRolesToProjectRoles[collab.workspace_roles]
                            ? WorkspaceRolesToProjectRoles[collab.workspace_roles]
                            : null
                        "
                        :description="false"
                        :on-role-change="(role: ProjectRoles) => updateCollaborator(collab, role)"
                      />
                    </div>
                  </template>
                  <template v-else>
                    <RolesBadge class="!bg-white" :role="collab.roles" />
                  </template>
                </td>
                <td class="w-1/4">
                  <div class="flex justify-center items-center">
                    <NcDropdown v-if="collab.roles !== ProjectRoles.OWNER" :trigger="['click']">
                      <MdiDotsVertical
                        class="border-1 !text-gray-600 h-5.5 w-5.5 rounded outline-0 p-0.5 nc-workspace-menu transform transition-transform !text-gray-400 cursor-pointer hover:(!text-gray-500 bg-gray-100)"
                      />
                      <template #overlay>
                        <NcMenu>
                          <NcMenuItem class="!text-red-500 !hover:bg-red-50" @click="removeProjectUser(activeProjectId!, collab)">
                            <MaterialSymbolsDeleteOutlineRounded />
                            Remove user
                          </NcMenuItem>
                        </NcMenu>
                      </template>
                    </NcDropdown>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <InfiniteLoading v-bind="$attrs" @infinite="loadListData">
          <template #spinner>
            <div class="flex flex-row w-full justify-center mt-2">
              <GeneralLoader />
            </div>
          </template>
          <template #complete>
            <span></span>
          </template>
        </InfiniteLoading>
      </div>
      <!-- </div> -->
    </template>
  </div>
</template>

<style scoped lang="scss">
.badge-text {
  @apply text-[14px] flex items-center justify-center gap-1 pt-0.5;
}

.nc-collaborators-list {
  @apply border-1 shadow-sm border-gray-100 mt-1 flex flex-col w-full;
  // todo: replace/remove 120px with proper value while updating invite ui
  height: calc(100vh - calc(var(--topbar-height) + 9rem + 120px));
}

.nc-collaborators-list-header {
  @apply flex flex-row justify-between items-center min-h-10 border-b-1  border-gray-100 pl-4;
}

.nc-collaborators-list-row {
  @apply flex flex-row justify-between items-center min-h-16 border-b-1  border-gray-100 pl-4;
}

.color-band {
  @apply w-6 h-6 left-0 top-2.5 rounded-full flex justify-center uppercase text-white font-weight-bold text-xs items-center;
}

:deep(.nc-collaborator-role-select .ant-select-selector) {
  @apply !rounded;
}

:deep(.ant-select-selection-item) {
  @apply mt-0.75;
}
</style>
