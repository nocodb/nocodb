<script lang="ts" setup>
import {useWorkspaceStoreOrThrow} from "#imports";
import {OrgUserRoles, WorkspaceUserRoles} from "nocodb-sdk";
import {Empty} from 'ant-design-vue'

const rolesLabel = {
  [WorkspaceUserRoles.CREATOR]: 'Creator',
  [WorkspaceUserRoles.OWNER]: 'Owner',
  [WorkspaceUserRoles.VIEWER]: 'Viewer',
}

const {collaborators, loadCollaborators} = useWorkspaceStoreOrThrow()

// todo: make it customizable
const stringToColour = function (str: string) {
  let i
  let hash = 0
  for (i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  let colour = '#'
  for (i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xff
    colour += `00${value.toString(16)}`.substr(-2)
  }
  return colour
}

const getRolesLabel = (roles?: string) => {
  return roles?.split(/\s*,\s*/)?.map(role => rolesLabel[role]).join(', ') ?? ''
}
</script>

<template>
  <div>
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
        <td>{{ (i + 3) % 20 }} hours ago</td>
        <td>
          <space>
            {{ getRolesLabel(collab.roles) }}
          </space>
        </td>
        <td>
          <MdiDotsHorizontal class="!text-gray-400 nc-workspace-menu"/>
        </td>
      </tr>
      </tbody>
    </table>

    <a-empty v-else :image="Empty.PRESENTED_IMAGE_SIMPLE" description="Collaborator list is empty"/>
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
