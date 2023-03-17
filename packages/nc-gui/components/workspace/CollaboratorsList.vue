<script lang="ts" setup>
import { WorkspaceUserRoles } from 'nocodb-sdk'
import { Empty } from 'ant-design-vue'
import { storeToRefs, stringToColour, timeAgo, useWorkspace, useWorkspaceStoreOrThrow } from '#imports'

const rolesLabel = {
  [WorkspaceUserRoles.CREATOR]: 'Creator',
  [WorkspaceUserRoles.OWNER]: 'Owner',
  [WorkspaceUserRoles.VIEWER]: 'Viewer',
}

const workspaceStore = useWorkspace()

const { removeCollaborator, updateCollaborator: _updateCollaborator } = workspaceStore

const { collaborators, isWorkspaceOwner } = storeToRefs(workspaceStore)

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
    await _updateCollaborator(collab.id, collab.roles)
    message.success('Successfully updated user role')
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}
</script>

<template>
  <div class="mt-4">
    <div class="px-6 pb-2">
      <div class="text-xl mb-2">Members</div>
      <div class="text-gray-500 text-xs">Manage who has access to this workspace</div>
    </div>

    <WorkspaceInviteSection v-if="isWorkspaceOwner" />
    <table v-if="collaborators?.length" class="nc-project-list-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Last Modified</th>
          <th>My Role</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(collab, i) of collaborators" :key="i">
          <td class="!py-0">
            <div class="flex items-center nc-project-title gap-2">
              <span class="color-band" :style="{ backgroundColor: stringToColour(collab.email) }">{{
                collab.email.slice(0, 2)
              }}</span>
              {{ collab.email }}
            </div>
          </td>
          <td class="text-gray-500 text-xs">
            {{ timeAgo(collab.created_at) }}
          </td>
          <td>
            <span v-if="collab.roles === WorkspaceUserRoles.OWNER" class="text-xs text-gray-500">
              {{ getRolesLabel(collab.roles) }}
            </span>

            <a-select v-else v-model:value="collab.roles" class="w-30" @change="updateCollaborator(collab)">
              <a-select-option :value="WorkspaceUserRoles.CREATOR"> Creator</a-select-option>
              <a-select-option :value="WorkspaceUserRoles.VIEWER"> Viewer</a-select-option>
            </a-select>
          </td>
          <td>
            <a-dropdown v-if="collab.roles !== WorkspaceUserRoles.OWNER" :trigger="['click']">
              <MdiDotsHorizontal
                class="outline-0 nc-workspace-menu transform transition-transform !text-gray-400 hover:(scale-130 !text-gray-500)"
              />
              <template #overlay>
                <a-menu>
                  <a-menu-item @click="removeCollaborator(collab.id)">
                    <div class="flex flex-row items-center py-3 gap-2">
                      <MdiDeleteOutline />
                      Remove Collaborator
                    </div>
                  </a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>
          </td>
        </tr>
      </tbody>
    </table>

    <a-empty v-else :image="Empty.PRESENTED_IMAGE_SIMPLE" description="Collaborator list is empty" />
  </div>
</template>

<style scoped lang="scss">
.nc-project-list-table {
  @apply min-w-[700px] !w-full;

  th {
    @apply .font-normal !text-gray-400 pb-4;
    border-bottom: 1px solid #e3e3e3;
  }

  td {
    @apply .font-normal pb-4;
    border-bottom: 1px solid #f5f5f5;
  }

  th,
  td {
    @apply text-left p-4;
  }

  th:first-child,
  td:first-child {
    @apply pl-6;
  }

  th:last-child,
  td:last-child {
    @apply pr-6;
  }
}

.nc-project-title {
  .color-band {
    @apply w-6 h-6 left-0 top-[10px] rounded-full flex justify-center uppercase text-white font-weight-bold text-xs items-center;
  }
}
</style>
