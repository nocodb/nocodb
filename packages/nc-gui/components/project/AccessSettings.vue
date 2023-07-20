<script lang="ts" setup>
import type { WorkspaceUserType } from 'nocodb-sdk'
import { Empty } from 'ant-design-vue'
import { storeToRefs, stringToColour, timeAgo } from '#imports'

const rolesLabel = {
  [ProjectRole.Creator]: 'Creator',
  [ProjectRole.Owner]: 'Owner',
  [ProjectRole.Editor]: 'Editor',
  [ProjectRole.Commenter]: 'Commenter',
  [ProjectRole.Viewer]: 'Viewer',
}

const { getProjectUsers, createProjectUser, updateProjectUser } = useProjects()
const { activeProjectId } = storeToRefs(useProjects())

const collaborators = ref<WorkspaceUserType[]>([])
const userSearchText = ref('')

const isLoading = ref(false)

const loadCollaborators = async () => {
  isLoading.value = true

  try {
    const { users } = await getProjectUsers({
      projectId: activeProjectId.value!,
      page: 1,
      limit: 100,
      searchText: userSearchText.value,
    })

    collaborators.value = users.map((user: any) => ({
      ...user,
      projectRoles: user.roles,
      roles: user.roles ?? user.workspace_roles,
    }))
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }

  isLoading.value = false
}

onMounted(() => {
  loadCollaborators()
})

const getRolesLabel = (roles?: string) => {
  return (
    roles
      ?.split(/\s*,\s*/)
      ?.map((role) => rolesLabel[role])
      .join(', ') ?? ''
  )
}

const updateCollaborator = async (collab) => {
  try {
    if (collab.projectRoles) {
      await updateProjectUser(activeProjectId.value!, collab)
    } else {
      await createProjectUser(activeProjectId.value!, collab)
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}
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
      <div
        v-if="!collaborators?.length"
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
                  collab.email.slice(0, 2)
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
                <a-select v-model:value="collab.roles" class="w-30 !rounded px-1" @change="updateCollaborator(collab)">
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
