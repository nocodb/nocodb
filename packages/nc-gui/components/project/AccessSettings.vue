<script lang="ts" setup>
import { WorkspaceUserRoles, type WorkspaceUserType } from 'nocodb-sdk'
import { Empty } from 'ant-design-vue'
import InfiniteLoading from 'v3-infinite-loading'
import { storeToRefs, stringToColour, timeAgo } from '#imports'

const rolesLabel = {
  [ProjectRole.Creator]: 'Creator',
  [ProjectRole.Owner]: 'Owner',
  [ProjectRole.Editor]: 'Editor',
  [ProjectRole.Commenter]: 'Commenter',
  [ProjectRole.Viewer]: 'Viewer',
  [WorkspaceUserRoles.CREATOR]: 'Creator',
  [WorkspaceUserRoles.OWNER]: 'Owner',
  [WorkspaceUserRoles.EDITOR]: 'Editor',
  [WorkspaceUserRoles.COMMENTER]: 'Commenter',
  [WorkspaceUserRoles.VIEWER]: 'Viewer',
}

const { getProjectUsers, createProjectUser, updateProjectUser } = useProjects()
const { activeProjectId } = storeToRefs(useProjects())

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
        roles: user.roles ?? user.workspace_roles,
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
  console.log('collaborators', collaborators.value)
})

const getRolesLabel = (roles?: string) => {
  return (
    roles
      ?.split(/\s*,\s*/)
      ?.map((role) => rolesLabel[role])
      .join(', ') ?? ''
  )
}

const updateCollaborator = async (collab, roles) => {
  try {
    if (collab.projectRoles) {
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
</script>

<template>
  <div class="nc-collaborator-table-container mt-4">
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
        <Empty description="No collaborators found" />
      </div>
      <div v-else class="nc-collaborators-list nc-scrollbar-md">
        <div class="nc-collaborators-list-header">
          <div class="flex w-1/2">Users</div>
          <div class="flex w-1/4">Date Joined</div>
          <div class="flex w-1/4">Access</div>
        </div>

        <div class="flex flex-col nc-scrollbar-md">
          <div v-for="(collab, i) of collaborators" :key="i" class="relative w-full nc-collaborators nc-collaborators-list-row">
            <div class="!py-0 w-1/2 email">
              <div class="flex items-center gap-2">
                <span class="color-band" :style="{ backgroundColor: stringToColour(collab.email) }">{{
                  collab?.email?.slice(0, 2)
                }}</span>
                {{ collab.email }}
              </div>
            </div>
            <div class="text-gray-500 text-xs w-1/4 created-at">
              {{ timeAgo(collab.created_at) }}
            </div>
            <div class="w-1/4 roles">
              <span v-if="collab.roles === ProjectRole.Owner" class="text-xs text-gray-500">
                {{ getRolesLabel(collab.roles) }}
              </span>

              <div v-else class="nc-collaborator-role-select">
                <a-select
                  v-model:value="collab.roles"
                  class="w-30 !rounded px-1"
                  :virtual="true"
                  @change="(value) => updateCollaborator(collab, value)"
                >
                  <template #suffixIcon>
                    <MdiChevronDown />
                  </template>
                  <a-select-option :value="ProjectRole.Creator"> Creator</a-select-option>
                  <a-select-option :value="ProjectRole.Editor"> Editor</a-select-option>
                  <a-select-option :value="ProjectRole.Commenter"> Commenter</a-select-option>
                  <a-select-option :value="ProjectRole.Viewer"> Viewer</a-select-option>
                </a-select>
              </div>
            </div>
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
.nc-collaborators-list {
  @apply border-gray-100 mt-1 flex flex-col w-full;
  height: calc(100vh - calc(var(--topbar-height) + 9rem));
}

.nc-collaborators-list-header {
  @apply flex flex-row justify-between items-center min-h-13 border-b-1 border-gray-75 pl-4 text-gray-500;
}
.nc-collaborators-list-row {
  @apply flex flex-row justify-between items-center min-h-16 border-b-1 border-gray-75 pl-4;
}

.color-band {
  @apply w-6 h-6 left-0 top-[10px] rounded-full flex justify-center uppercase text-white font-weight-bold text-xs items-center;
}

:deep(.nc-collaborator-role-select .ant-select-selector) {
  @apply !rounded;
}
</style>
