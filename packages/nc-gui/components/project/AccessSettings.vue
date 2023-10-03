<script lang="ts" setup>
import type { OrgUserRoles, WorkspaceUserRoles } from 'nocodb-sdk'
import { OrderedProjectRoles, ProjectRoles, WorkspaceRolesToProjectRoles } from 'nocodb-sdk'
import InfiniteLoading from 'v3-infinite-loading'
import { isEeUI, storeToRefs, timeAgo } from '#imports'

const basesStore = useBases()
const { getProjectUsers, createProjectUser, updateProjectUser, removeProjectUser } = basesStore
const { activeProjectId } = storeToRefs(basesStore)

const { baseRoles } = useRoles()

interface Collaborators {
  id: string
  email: string
  main_roles: OrgUserRoles
  roles: ProjectRoles
  workspace_roles: WorkspaceUserRoles
  created_at: string
}
const collaborators = ref<Collaborators[]>([])
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

  await loadCollaborators()

  if (prevUsersCount === collaborators.value?.length) {
    $state.complete()
    return
  }
  $state.loaded()
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
    loadCollaborators()
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
      <div v-else class="nc-collaborators-list !mt-10">
        <div class="h-160 nc-scrollbar-md rounded-lg border-1 w-250">
          <table>
            <thead class="bg-gray-50 h-10 sticky top-0">
              <th class="text-start w-80 text-gray-700 sticky top-0 pr-50">{{ $t('objects.users') }}</th>
              <th class="text-start w-80 text-gray-700 sticky top-0 pl-6">{{ $t('title.dateJoined') }}</th>
              <th class="text-start w-80 text-gray-700 sticky top-0 pr-13">{{ $t('general.access') }}</th>
            </thead>
            <tbody>
              <tr v-for="(collab, i) of collaborators" :key="i" class="border-b-1 py-1 h-14">
                <td class="flex gap-3 justify-start items-center h-14 w-75 ml-15">
                  <GeneralUserIcon size="base" :name="collab.email" :email="collab.email" />
                  <span class="truncate">
                    {{ collab.email }}
                  </span>
                </td>
                <td class="w-75 text-center pl-18">
                  <div class="flex justify-start w-35 ml-15">
                    {{ timeAgo(collab.created_at) }}
                  </div>
                </td>
                <td class="w-75">
                  <template v-if="accessibleRoles.includes(collab.roles)">
                    <div class="flex justify-center items-center">
                      <div class="w-25.5">
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
                    </div>
                  </template>
                  <template v-else>
                    <div class="flex justify-center">
                      <RolesBadge class="!bg-white !w-25" :role="collab.roles" />
                    </div>
                  </template>
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
