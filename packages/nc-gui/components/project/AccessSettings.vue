<script lang="ts" setup>
import type { OrgUserRoles, WorkspaceUserRoles } from 'nocodb-sdk'
import { OrderedProjectRoles, ProjectRoles, WorkspaceRolesToProjectRoles } from 'nocodb-sdk'
import InfiniteLoading from 'v3-infinite-loading'
import { isEeUI, storeToRefs, stringToColour, timeAgo } from '#imports'

const projectsStore = useProjects()
const { getProjectUsers, createProjectUser, updateProjectUser, removeProjectUser } = projectsStore
const { activeProjectId } = storeToRefs(projectsStore)

const { projectRoles } = useRoles()

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
      projectId: activeProjectId.value!,
      page: currentPage.value,
      ...(!userSearchText.value ? {} : ({ searchText: userSearchText.value } as any)),
      limit: 20,
    })

    totalCollaborators.value = totalRows
    collaborators.value = [
      ...collaborators.value,
      ...users.map((user: any) => ({
        ...user,
        project_roles: user.roles,
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
    } else if (collab.project_roles) {
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
      (role) => projectRoles.value && Object.keys(projectRoles.value).includes(role),
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
    <ProjectInviteProjectCollabSection @invited="reloadCollabs" />

    <div v-if="isLoading" class="nc-collaborators-list items-center justify-center">
      <GeneralLoader size="xlarge" />
    </div>
    <template v-else>
      <div class="w-full flex flex-row justify-between items-baseline mt-6.5 mb-2 pr-0.25 ml-2">
        <a-input v-model:value="userSearchText" class="!max-w-90 !rounded-md" placeholder="Search collaborators">
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
        <Empty description="No Members found" />
      </div>
      <div v-else class="nc-collaborators-list nc-scrollbar-md">
        <div class="nc-collaborators-list-header">
          <div class="flex w-3/5">Users</div>
          <div class="flex w-2/5">Date Joined</div>
          <div class="flex w-1/5">Access</div>
          <div class="flex w-1/5"></div>
          <div class="flex w-1/5"></div>
        </div>

        <div class="flex flex-col nc-scrollbar-md">
          <div v-for="(collab, i) of collaborators" :key="i" class="relative w-full nc-collaborators nc-collaborators-list-row">
            <div class="!py-0 w-3/5 email truncate">
              <div class="flex items-center gap-2">
                <span class="color-band" :style="{ backgroundColor: stringToColour(collab.email) }">{{
                  collab?.email?.slice(0, 2)
                }}</span>
                <!--                <GeneralTruncateText> -->
                <span class="truncate">
                  {{ collab.email }}
                </span>
                <!--                </GeneralTruncateText> -->
              </div>
            </div>
            <div class="text-gray-500 text-xs w-2/5 created-at truncate">
              {{ timeAgo(collab.created_at) }}
            </div>
            <div class="w-1/5 roles">
              <div class="nc-collaborator-role-select p-2">
                <template v-if="accessibleRoles.includes(collab.roles)">
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
                </template>
                <template v-else>
                  <RolesBadge class="!bg-white" :role="collab.roles" />
                </template>
              </div>
            </div>
            <div class="w-1/5"></div>
            <div class="w-1/5"></div>
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
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.badge-text {
  @apply text-[14px] flex items-center justify-center gap-1 pt-0.5;
}

.nc-collaborators-list {
  @apply border-gray-100 mt-1 flex flex-col w-full;
  // todo: replace/remove 120px with proper value while updating invite ui
  height: calc(100vh - calc(var(--topbar-height) + 9rem + 120px));
}

.nc-collaborators-list-header {
  @apply flex flex-row justify-between items-center min-h-13 border-b-1 border-gray-100 pl-4 text-gray-500;
}

.nc-collaborators-list-row {
  @apply flex flex-row justify-between items-center min-h-16 border-b-1 border-gray-100 pl-4;
}

.color-band {
  @apply w-6 h-6 left-0 top-[10px] rounded-full flex justify-center uppercase text-white font-weight-bold text-xs items-center;
}

:deep(.nc-collaborator-role-select .ant-select-selector) {
  @apply !rounded;
}

:deep(.ant-select-selection-item) {
  @apply mt-0.75;
}
</style>
