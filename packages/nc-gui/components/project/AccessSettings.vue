<script lang="ts" setup>
import type { WorkspaceUserType } from 'nocodb-sdk'
import { OrderedProjectRoles, ProjectRoles, RoleColors, RoleLabels } from 'nocodb-sdk'
import InfiniteLoading from 'v3-infinite-loading'
import { isEeUI, storeToRefs, stringToColour, timeAgo, useGlobal } from '#imports'

const { user } = useGlobal()
const projectsStore = useProjects()
const { getProjectUsers, createProjectUser, updateProjectUser, removeProjectUser } = projectsStore
const { activeProjectId } = storeToRefs(projectsStore)

const collaborators = ref<WorkspaceUserType[]>([])
const totalCollaborators = ref(0)
const userSearchText = ref('')
const currentPage = ref(0)

const isLoading = ref(false)
const isSearching = ref(false)

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
        projectRoles: user.roles,
        // TODO: Remove this hack and make the values consistent with the backend
        roles: user.roles ?? (RoleLabels[user.workspace_roles as string] as string)?.toLowerCase() ?? ProjectRoles.NO_ACCESS,
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

onMounted(async () => {
  isLoading.value = true
  try {
    await loadCollaborators()
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isLoading.value = false
  }
})

const updateCollaborator = async (collab, roles) => {
  try {
    if (!roles || roles === 'inherit' || (roles === ProjectRoles.NO_ACCESS && !isEeUI)) {
      await removeProjectUser(activeProjectId.value!, collab)
      collab.projectRoles = null
    } else if (collab.projectRoles) {
      await updateProjectUser(activeProjectId.value!, collab)
    } else {
      await createProjectUser(activeProjectId.value!, collab)
      collab.projectRoles = roles
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
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

const reloadCollabs = async () => {
  currentPage.value = 0
  collaborators.value = []
  await loadCollaborators()
}

const userProjectRole = computed<(typeof ProjectRoles)[keyof typeof ProjectRoles]>(() => {
  const projectUser = collaborators.value?.find((collab) => collab.id === user.value?.id)
  return projectUser?.projectRoles
})

const accessibleRoles = computed<(typeof ProjectRoles)[keyof typeof ProjectRoles][]>(() => {
  const currentRoleIndex = OrderedProjectRoles.findIndex((role) => role === userProjectRole.value)
  if (currentRoleIndex === -1) return []
  return OrderedProjectRoles.slice(currentRoleIndex + 1)
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
        <a-empty description="No collaborators found" />
      </div>
      <div v-else class="nc-collaborators-list nc-scrollbar-md">
        <div class="nc-collaborators-list-header">
          <div class="flex w-1/5">Users</div>
          <div class="flex w-1/5">Date Joined</div>
          <div class="flex w-1/5">Access</div>
          <div class="flex w-1/5"></div>
          <div class="flex w-1/5"></div>
        </div>

        <div class="flex flex-col nc-scrollbar-md">
          <div v-for="(collab, i) of collaborators" :key="i" class="relative w-full nc-collaborators nc-collaborators-list-row">
            <div class="!py-0 w-1/5 email">
              <div class="flex items-center gap-2">
                <span class="color-band" :style="{ backgroundColor: stringToColour(collab.email) }">{{
                  collab?.email?.slice(0, 2)
                }}</span>
                <!--                <GeneralTruncateText> -->
                {{ collab.email }}
                <!--                </GeneralTruncateText> -->
              </div>
            </div>
            <div class="text-gray-500 text-xs w-1/5 created-at">
              {{ timeAgo(collab.created_at) }}
            </div>
            <div class="w-1/5 roles">
              <div class="nc-collaborator-role-select">
                <NcSelect
                  v-model:value="collab.roles"
                  class="w-35 !rounded px-1"
                  :virtual="true"
                  :placeholder="$t('labels.noAccess')"
                  :disabled="collab.id === user?.id || (collab.roles && !accessibleRoles.includes(collab.roles))"
                  @change="(value) => updateCollaborator(collab, value)"
                >
                  <template #suffixIcon>
                    <MdiChevronDown />
                  </template>
                  <a-select-option v-if="collab.id === user?.id" :value="userProjectRole">
                    <NcBadge :color="RoleColors[userProjectRole]">
                      <p class="badge-text">{{ RoleLabels[userProjectRole] }}</p>
                    </NcBadge>
                  </a-select-option>
                  <a-select-option v-if="collab.roles && !accessibleRoles.includes(collab.roles)" :value="collab.roles">
                    <NcBadge :color="RoleColors[collab.roles]">
                      <p class="badge-text">{{ RoleLabels[collab.roles] }}</p>
                    </NcBadge>
                  </a-select-option>
                  <template v-for="role of accessibleRoles" :key="`role-option-${role}`">
                    <a-select-option :value="role">
                      <NcBadge :color="RoleColors[role]">
                        <p class="badge-text">{{ RoleLabels[role] }}</p>
                      </NcBadge>
                    </a-select-option>
                  </template>
                  <a-select-option v-if="isEeUI" value="inherit">
                    <NcBadge color="white">
                      <p class="badge-text">Inherit</p>
                    </NcBadge>
                  </a-select-option>
                </NcSelect>
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
  @apply text-[14px] pt-1 text-center;
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
