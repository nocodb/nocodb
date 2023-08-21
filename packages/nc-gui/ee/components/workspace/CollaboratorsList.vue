<script lang="ts" setup>
import { WorkspaceUserRoles } from 'nocodb-sdk'
import { Empty } from 'ant-design-vue'
import { storeToRefs, stringToColour, timeAgo, useWorkspace } from '#imports'

const workspaceStore = useWorkspace()

const { removeCollaborator, updateCollaborator: _updateCollaborator } = workspaceStore

const { collaborators, isWorkspaceOwner } = storeToRefs(workspaceStore)
const userSearchText = ref('')

const filterCollaborators = computed(() => {
  if (!userSearchText.value) return collaborators.value ?? []

  if (!collaborators.value) return []

  return collaborators.value.filter((collab) => collab.email!.includes(userSearchText.value))
})

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
  <div class="nc-collaborator-table-container mt-4 mx-6">
    <WorkspaceInviteSection v-if="isWorkspaceOwner" />
    <div class="w-full h-1 border-t-1 border-gray-100 opacity-50 mt-6"></div>
    <div class="w-full flex flex-row justify-between items-baseline mt-6.5 mb-2 pr-0.25 ml-2">
      <div class="text-xl">Collaborators</div>
      <a-input v-model:value="userSearchText" class="!max-w-90 !rounded-md" placeholder="Search collaborators">
        <template #prefix>
          <PhMagnifyingGlassBold class="!h-3.5 text-gray-500" />
        </template>
      </a-input>
    </div>
    <div v-if="!filterCollaborators?.length" class="w-full h-full flex flex-col items-center justify-center mt-36">
      <Empty description="No collaborators found" />
    </div>
    <table v-else class="nc-collaborators-list-table !nc-scrollbar-md">
      <thead>
        <tr>
          <th class="w-1/5">Users</th>
          <th class="w-1/5">Date Joined</th>
          <th class="w-1/5">Access</th>
          <th class="w-1/5"></th>
          <th class="w-1/5"></th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(collab, i) of filterCollaborators" :key="i" class="relative w-full nc-collaborators">
          <td class="!py-0 w-1/5 email">
            <div class="flex items-center gap-2">
              <span class="color-band" :style="{ backgroundColor: stringToColour(collab.email) }">{{
                collab.email.slice(0, 2)
              }}</span>
              <!--              <GeneralTruncateText>-->
              {{ collab.email }}
              <!--              </GeneralTruncateText>-->
            </div>
          </td>
          <td class="text-gray-500 text-xs w-1/5 created-at">
            {{ timeAgo(collab.created_at) }}
          </td>
          <td class="w-1/5 roles">
            <div v-if="collab.roles === WorkspaceUserRoles.OWNER" class="nc-collaborator-role-select">
              <NcSelect v-model:value="collab.roles" class="w-35 !rounded px-1" disabled>
                <template #suffixIcon>
                  <MdiChevronDown />
                </template>
                <a-select-option :value="WorkspaceUserRoles.OWNER">
                  <NcBadge color="purple">
                    <p class="badge-text">Owner</p>
                  </NcBadge>
                </a-select-option>
              </NcSelect>
            </div>

            <div v-else class="nc-collaborator-role-select">
              <NcSelect v-model:value="collab.roles" class="w-35 !rounded px-1" @change="updateCollaborator(collab)">
                <template #suffixIcon>
                  <MdiChevronDown />
                </template>
                <a-select-option :value="WorkspaceUserRoles.CREATOR">
                  <NcBadge color="blue">
                    <p class="badge-text">Creator</p>
                  </NcBadge>
                </a-select-option>
                <a-select-option :value="WorkspaceUserRoles.EDITOR">
                  <NcBadge color="green">
                    <p class="badge-text">Editor</p>
                  </NcBadge>
                </a-select-option>
                <a-select-option :value="WorkspaceUserRoles.COMMENTER">
                  <NcBadge color="orange">
                    <p class="badge-text">Commenter</p>
                  </NcBadge>
                </a-select-option>
                <a-select-option :value="WorkspaceUserRoles.VIEWER">
                  <NcBadge color="yellow">
                    <p class="badge-text">Viewer</p>
                  </NcBadge>
                </a-select-option>
              </NcSelect>
            </div>
          </td>
          <td class="w-1/5">
            <div class="-left-2.5 top-5">
              <a-dropdown v-if="collab.roles !== WorkspaceUserRoles.OWNER" :trigger="['click']">
                <MdiDotsVertical
                  class="h-5.5 w-5.5 rounded outline-0 p-0.5 nc-workspace-menu transform transition-transform !text-gray-400 cursor-pointer hover:(!text-gray-500 bg-gray-100)"
                />
                <template #overlay>
                  <a-menu>
                    <a-menu-item @click="removeCollaborator(collab.id)">
                      <div class="flex flex-row items-center py-2 text-s gap-1.5 text-red-500 cursor-pointer">
                        <MaterialSymbolsDeleteOutlineRounded />
                        Remove user
                      </div>
                    </a-menu-item>
                  </a-menu>
                </template>
              </a-dropdown>
            </div>
          </td>
          <td class="w-1/5 padding"></td>
          <td class="w-1/5 padding"></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped lang="scss">
.badge-text {
    @apply text-[14px] pt-1 text-center
}
.nc-collaborators-list-table {
  @apply min-w-[700px] !w-full border-gray-100 mt-1;

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
    @apply pr-1 w-5;
  }
}

.color-band {
  @apply w-6 h-6 left-0 top-[10px] rounded-full flex justify-center uppercase text-white font-weight-bold text-xs items-center;
}

:deep(.nc-collaborator-role-select .ant-select-selector) {
  @apply !rounded;
}

table {
  display: block;
  width: 100%;
}
thead {
  display: block;
  width: 100%;
}
tr {
  display: block;
  width: 100%;
}
tbody {
  display: block;
  width: 100%;
  height: calc(100vh - calc(var(--topbar-height) + 25rem));
  overflow-y: overlay;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-track {
    background: #f6f6f600 !important;
  }
  &::-webkit-scrollbar-thumb {
    background: #f6f6f600;
  }
  &::-webkit-scrollbar-thumb:hover {
    background: #f6f6f600;
  }
}
tbody {
  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-track {
    background: #f6f6f600 !important;
  }
  &::-webkit-scrollbar-thumb {
    background: rgb(215, 215, 215);
  }
  &::-webkit-scrollbar-thumb:hover {
    background: rgb(203, 203, 203);
  }
}
</style>
