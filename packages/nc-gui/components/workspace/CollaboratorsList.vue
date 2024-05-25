<script lang="ts" setup>
import { OrderedWorkspaceRoles, WorkspaceUserRoles } from 'nocodb-sdk'

const props = defineProps<{
  workspaceId?: string
}>()

const { workspaceRoles } = useRoles()

const workspaceStore = useWorkspace()

const { removeCollaborator, updateCollaborator: _updateCollaborator, loadWorkspace } = workspaceStore

const { collaborators, activeWorkspace, workspacesList } = storeToRefs(workspaceStore)

const currentWorkspace = computedAsync(async () => {
  if (props.workspaceId) {
    const ws = workspacesList.value.find((workspace) => workspace.id === props.workspaceId)
    if (!ws) {
      await loadWorkspace(props.workspaceId)

      return workspacesList.value.find((workspace) => workspace.id === props.workspaceId)
    }
  }
  return activeWorkspace.value ?? workspacesList.value[0]
})

const { sorts, loadSorts, handleGetSortedData, toggleSort } = useUserSorts('Workspace')

const userSearchText = ref('')

const isAdminPanel = inject(IsAdminPanelInj, ref(false))

const { isUIAllowed } = useRoles()

const inviteDlg = ref(false)

const filterCollaborators = computed(() => {
  if (!userSearchText.value) return collaborators.value ?? []

  if (!collaborators.value) return []

  return collaborators.value.filter(
    (collab) =>
      collab.display_name?.toLowerCase().includes(userSearchText.value.toLowerCase()) ||
      collab.email?.toLowerCase().includes(userSearchText.value.toLowerCase()),
  )
})

const selected = reactive<{
  [key: number]: boolean
}>({})

const toggleSelectAll = (value: boolean) => {
  filterCollaborators.value.forEach((_, i) => {
    selected[i] = value
  })
}

const sortedCollaborators = computed(() => {
  return handleGetSortedData(filterCollaborators.value, sorts.value)
})

const selectAll = computed({
  get: () =>
    Object.values(selected).every((v) => v) &&
    Object.keys(selected).length > 0 &&
    Object.values(selected).length === sortedCollaborators.value.length,
  set: (value) => {
    toggleSelectAll(value)
  },
})

const updateCollaborator = async (collab: any, roles: WorkspaceUserRoles) => {
  if (!currentWorkspace.value || !currentWorkspace.value.id) return
  console.log(WorkspaceUserRoles.OWNER)
  try {
    await _updateCollaborator(collab.id, roles, currentWorkspace.value.id)
    message.success('Successfully updated user role')

    collaborators.value?.forEach((collaborator) => {
      if (collaborator.id === collab.id) {
        collaborator.roles = roles
      }
    })
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const accessibleRoles = computed<WorkspaceUserRoles[]>(() => {
  const currentRoleIndex = OrderedWorkspaceRoles.findIndex(
    (role) => workspaceRoles.value && Object.keys(workspaceRoles.value).includes(role),
  )
  if (currentRoleIndex === -1) return []
  return OrderedWorkspaceRoles.slice(currentRoleIndex + 1).filter((r) => r)
})

onMounted(async () => {
  loadSorts()
})
</script>

<template>
  <DlgInviteDlg v-if="currentWorkspace" v-model:model-value="inviteDlg" :workspace-id="currentWorkspace?.id" type="workspace" />
  <div class="nc-collaborator-table-container mt-4 h-[calc(100vh-10rem)] max-w-350">
    <div class="w-full flex justify-between mt-6.5 mb-2">
      <a-input v-model:value="userSearchText" class="!max-w-90 !rounded-md mr-4" placeholder="Search members">
        <template #prefix>
          <PhMagnifyingGlassBold class="!h-3.5 text-gray-500" />
        </template>
      </a-input>
      <NcButton data-testid="nc-add-member-btn" @click="inviteDlg = true">
        <div class="flex items-center gap-2">
          <component :is="iconMap.plus" class="!h-4 !w-4" />
          {{ $t('labels.addMember') }}
        </div>
      </NcButton>
    </div>
    <div v-if="!filterCollaborators?.length" class="w-full h-full flex flex-col items-center justify-center">
      <a-empty description="No members found" />
    </div>
    <div v-else class="nc-collaborators-list mt-6 h-full">
      <div class="flex flex-col rounded-lg overflow-hidden border-1 max-h-[calc(100%-4rem)]">
        <div class="flex flex-row bg-gray-50 min-h-11 items-center border-b-1">
          <div class="py-3 px-6"><NcCheckbox v-model:checked="selectAll" /></div>
          <LazyAccountHeaderWithSorter
            class="text-gray-700 w-[30rem] users-email-grid"
            :header="$t('objects.users')"
            :active-sort="sorts"
            field="email"
            :toggle-sort="toggleSort"
          />

          <LazyAccountHeaderWithSorter
            class="text-gray-700 w-full flex-1 px-6 py-3"
            :header="$t('general.access')"
            :active-sort="sorts"
            field="roles"
            :toggle-sort="toggleSort"
          />

          <div class="text-gray-700 w-full flex-1 px-6 py-3">{{ $t('title.dateJoined') }}</div>
          <div class="text-gray-700 w-full text-right flex-1 px-6 py-3">{{ $t('labels.actions') }}</div>
        </div>
        <div class="flex flex-col nc-scrollbar-md">
          <div
            v-for="(collab, i) of sortedCollaborators"
            :key="i"
            :class="{
              'bg-[#F0F3FF]': selected[i],
            }"
            class="user-row flex hover:bg-[#F0F3FF] flex-row last:border-b-0 border-b-1 py-1 min-h-14 items-center"
          >
            <div class="py-3 px-6">
              <NcCheckbox v-model:checked="selected[i]" />
            </div>

            <div class="flex gap-3 w-[30rem] items-center users-email-grid">
              <GeneralUserIcon :email="collab.email" size="base" />
              <div class="flex flex-col">
                <div class="flex gap-3">
                  <span class="text-gray-800 capitalize font-semibold">
                    {{ collab.display_name || collab?.email?.slice(0, collab.email.indexOf('@')) }}
                  </span>
                </div>
                <span class="text-xs text-gray-600">
                  {{ collab.email }}
                </span>
              </div>
            </div>
            <div class="w-full flex-1 px-6 py-3">
              <div class="w-[30px]">
                <template v-if="accessibleRoles.includes(collab.roles as WorkspaceUserRoles)">
                  <RolesSelector
                    :description="false"
                    :on-role-change="(role) => updateCollaborator(collab, role as WorkspaceUserRoles)"
                    :role="collab.roles"
                    :roles="accessibleRoles"
                    class="cursor-pointer"
                  />
                </template>
                <template v-else>
                  <RolesBadge :border="false" :role="collab.roles" class="cursor-default" />
                </template>
              </div>
            </div>
            <div class="w-full flex-1 px-6 py-3">
              <NcTooltip class="max-w-full">
                <template #title>
                  {{ parseStringDateTime(collab.created_at) }}
                </template>
                <span>
                  {{ timeAgo(collab.created_at) }}
                </span>
              </NcTooltip>
            </div>
            <div class="w-full justify-end flex-1 flex px-6 py-3">
              <NcDropdown v-if="collab.roles !== WorkspaceUserRoles.OWNER">
                <NcButton size="small" type="secondary">
                  <component :is="iconMap.threeDotVertical" />
                </NcButton>
                <template #overlay>
                  <NcMenu>
                    <template v-if="isAdminPanel">
                      <NcMenuItem data-testid="nc-admin-org-user-delete">
                        <GeneralIcon class="text-gray-800" icon="signout" />
                        <span>{{ $t('labels.signOutUser') }}</span>
                      </NcMenuItem>

                      <a-menu-divider class="my-1.5" />
                    </template>
                    <NcMenuItem
                      v-if="isUIAllowed('transferWorkspaceOwnership')"
                      data-testid="nc-admin-org-user-assign-admin"
                      @click="updateCollaborator(collab, WorkspaceUserRoles.OWNER)"
                    >
                      <GeneralIcon class="text-gray-800" icon="user" />
                      <span>{{ $t('labels.assignAs') }}</span>
                      <RolesBadge :border="false" :show-icon="false" role="owner" />
                    </NcMenuItem>

                    <NcMenuItem
                      class="!text-red-500 !hover:bg-red-50"
                      @click="removeCollaborator(collab.id, currentWorkspace?.id)"
                    >
                      <MaterialSymbolsDeleteOutlineRounded />
                      Remove user
                    </NcMenuItem>
                  </NcMenu>
                </template>
              </NcDropdown>
            </div>
          </div>
        </div>
        <div v-if="sortedCollaborators.length === 1" class="pt-12 pb-4 px-2 flex flex-col items-center gap-6 text-center">
          <div class="text-2xl text-gray-800 font-bold">
            {{ $t('placeholder.inviteYourTeam') }}
          </div>
          <div class="text-sm text-gray-700">
            {{ $t('placeholder.inviteYourTeamLabel') }}
          </div>
          <img alt="Invite Team" class="!w-[30rem] flex-none" src="~assets/img/placeholder/invite-team.png" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.ant-input::placeholder {
  @apply text-gray-500;
}

.ant-input:placeholder-shown {
  @apply text-gray-500 !text-md;
}

.ant-input-affix-wrapper {
  @apply px-4 rounded-lg py-2 w-84 border-1 focus:border-brand-500 border-gray-200 !ring-0;
}

.badge-text {
  @apply text-[14px] pt-1 text-center;
}

.nc-collaborators-list-table {
  @apply min-w-[700px] !w-full border-gray-100 mt-1;
}

.last:last-child {
  border-bottom: none;
}
</style>
