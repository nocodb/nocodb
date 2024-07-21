<script lang="ts" setup>
import type { Roles, WorkspaceUserRoles } from 'nocodb-sdk'
import { OrderedProjectRoles, OrgUserRoles, ProjectRoles, WorkspaceRolesToProjectRoles } from 'nocodb-sdk'

const props = defineProps<{
  baseId?: string
}>()

const basesStore = useBases()
const { getBaseUsers, createProjectUser, updateProjectUser, removeProjectUser } = basesStore
const { activeProjectId, bases, basesUser } = storeToRefs(basesStore)

const { orgRoles, baseRoles, loadRoles } = useRoles()

const { sorts, loadSorts, handleGetSortedData, toggleSort } = useUserSorts('Project')

const isSuper = computed(() => orgRoles.value?.[OrgUserRoles.SUPER_ADMIN])

const orgStore = useOrg()
const { orgId } = storeToRefs(orgStore)

const isAdminPanel = inject(IsAdminPanelInj, ref(false))

const { $api } = useNuxtApp()

const currentBase = computedAsync(async () => {
  let base
  if (props.baseId) {
    await loadRoles(props.baseId)
    base = bases.value.get(props.baseId)
    if (!base) {
      base = await $api.base.read(props.baseId!)
    }
  } else {
    base = bases.value.get(activeProjectId.value)
  }
  return base
})

const isInviteModalVisible = ref(false)

interface Collaborators {
  id: string
  email: string
  main_roles: OrgUserRoles
  roles: ProjectRoles
  base_roles: Roles
  workspace_roles: WorkspaceUserRoles
  created_at: string
  display_name: string | null
}
const collaborators = ref<Collaborators[]>([])
const totalCollaborators = ref(0)
const userSearchText = ref('')

const isLoading = ref(false)
const isSearching = ref(false)
const accessibleRoles = ref<(typeof ProjectRoles)[keyof typeof ProjectRoles][]>([])

const filteredCollaborators = computed(() =>
  collaborators.value.filter(
    (collab) =>
      collab.display_name?.toLowerCase()?.includes(userSearchText.value.toLowerCase()) ||
      collab.email.toLowerCase().includes(userSearchText.value.toLowerCase()),
  ),
)

const sortedCollaborators = computed(() => {
  return handleGetSortedData(filteredCollaborators.value, sorts.value)
})

const loadCollaborators = async () => {
  try {
    if (!currentBase.value) return
    const { users, totalRows } = await getBaseUsers({
      baseId: currentBase.value.id!,
      ...(!userSearchText.value ? {} : ({ searchText: userSearchText.value } as any)),
      force: true,
    })

    totalCollaborators.value = totalRows
    collaborators.value = [
      ...users
        .filter((u: any) => !u?.deleted)
        .map((user: any) => ({
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

const updateCollaborator = async (collab: any, roles: ProjectRoles) => {
  const currentCollaborator = collaborators.value.find((coll) => coll.id === collab.id)!

  try {
    if (
      !roles ||
      (roles === ProjectRoles.NO_ACCESS && !isEeUI) ||
      (currentCollaborator.workspace_roles &&
        WorkspaceRolesToProjectRoles[currentCollaborator.workspace_roles as WorkspaceUserRoles] === roles &&
        isEeUI)
    ) {
      await removeProjectUser(currentBase.value.id!, currentCollaborator as unknown as User)
      if (
        currentCollaborator.workspace_roles &&
        WorkspaceRolesToProjectRoles[currentCollaborator.workspace_roles as WorkspaceUserRoles] === roles &&
        isEeUI
      ) {
        currentCollaborator.roles = WorkspaceRolesToProjectRoles[currentCollaborator.workspace_roles as WorkspaceUserRoles]
      } else {
        currentCollaborator.roles = ProjectRoles.NO_ACCESS
      }
      currentCollaborator.base_roles = null
    } else if (currentCollaborator.base_roles) {
      currentCollaborator.roles = roles
      await updateProjectUser(currentBase.value.id!, currentCollaborator as unknown as User)
    } else {
      currentCollaborator.roles = roles
      currentCollaborator.base_roles = roles
      await createProjectUser(currentBase.value.id!, currentCollaborator as unknown as User)
    }

    let currentBaseUsers = basesUser.value.get(currentBase.value.id)

    if (currentBaseUsers?.length) {
      currentBaseUsers = currentBaseUsers.map((user) => {
        if (user.id === currentCollaborator.id) {
          user.roles = currentCollaborator.roles as any
        }
        return user
      })

      basesUser.value.set(currentBase.value.id, currentBaseUsers)
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
    loadCollaborators()
  }
}

onMounted(async () => {
  isLoading.value = true
  try {
    await loadCollaborators()
    const currentRoleIndex = OrderedProjectRoles.findIndex(
      (role) => baseRoles.value && Object.keys(baseRoles.value).includes(role),
    )
    if (isSuper.value) {
      accessibleRoles.value = OrderedProjectRoles.slice(1)
    } else if (currentRoleIndex !== -1) {
      accessibleRoles.value = OrderedProjectRoles.slice(currentRoleIndex + 1)
    }
    loadSorts()
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isLoading.value = false
  }
})

const selected = reactive<{
  [key: string]: boolean
}>({})

const toggleSelectAll = (value: boolean) => {
  filteredCollaborators.value.forEach((_) => {
    selected[_.id] = value
  })
}

// const isSomeSelected = computed(() => Object.values(selected).some((v) => v))

const selectAll = computed({
  get: () =>
    Object.values(selected).every((v) => v) &&
    Object.keys(selected).length > 0 &&
    Object.values(selected).length === filteredCollaborators.value.length,
  set: (value) => {
    toggleSelectAll(value)
  },
})
watch(isInviteModalVisible, () => {
  if (!isInviteModalVisible.value) {
    loadCollaborators()
  }
})

watch(currentBase, () => {
  loadCollaborators()
})
</script>

<template>
  <div
    :class="{
      'px-6 ': isAdminPanel,
    }"
    class="nc-collaborator-table-container mt-4 nc-access-settings-view h-[calc(100vh-8rem)]"
  >
    <div v-if="isAdminPanel" class="font-bold w-full !mb-5 text-2xl" data-rec="true">
      <div class="flex items-center gap-3">
        <NuxtLink
          :href="`/admin/${orgId}/bases`"
          class="!hover:(text-black underline-gray-600) flex items-center !text-black !underline-transparent ml-0.75 max-w-1/4"
        >
          <component :is="iconMap.arrowLeft" class="text-3xl" />

          {{ $t('objects.projects') }}
        </NuxtLink>

        <span class="text-2xl"> / </span>
        <GeneralBaseIconColorPicker readonly />
        <span class="text-base">
          {{ currentBase?.title }}
        </span>
      </div>
    </div>
    <LazyDlgInviteDlg v-model:model-value="isInviteModalVisible" :base-id="currentBase?.id" type="base" />
    <div v-if="isLoading" class="nc-collaborators-list items-center justify-center">
      <GeneralLoader size="xlarge" />
    </div>
    <template v-else>
      <div class="w-full flex flex-row justify-between items-center max-w-350 mt-6.5 mb-2 pr-0.25">
        <a-input v-model:value="userSearchText" :placeholder="$t('title.searchMembers')" class="!max-w-90 !rounded-md mr-4">
          <template #prefix>
            <PhMagnifyingGlassBold class="!h-3.5 text-gray-500" />
          </template>
        </a-input>

        <NcButton size="small" @click="isInviteModalVisible = true">
          <div class="flex items-center gap-1">
            <component :is="iconMap.plus" class="w-4 h-4" />
            {{ $t('activity.addMembers') }}
          </div>
        </NcButton>
      </div>

      <div v-if="isSearching" class="nc-collaborators-list items-center justify-center">
        <GeneralLoader size="xlarge" />
      </div>

      <div
        v-else-if="!filteredCollaborators?.length"
        class="nc-collaborators-list w-full h-full flex flex-col items-center justify-center"
      >
        <a-empty :description="$t('title.noMembersFound')" />
      </div>
      <div v-else class="nc-collaborators-list mt-6 h-full">
        <div class="flex flex-col overflow-hidden max-w-350 max-h-[calc(100%-8rem)]">
          <div class="flex flex-row bg-gray-50 min-h-12 items-center border-b-1">
            <div class="py-3 px-6"><NcCheckbox v-model:checked="selectAll" /></div>

            <LazyAccountHeaderWithSorter
              class="users-email-grid"
              :header="$t('objects.users')"
              :active-sort="sorts"
              field="email"
              :toggle-sort="toggleSort"
            />

            <LazyAccountHeaderWithSorter
              class="user-access-grid"
              :header="$t('general.role')"
              :active-sort="sorts"
              field="roles"
              :toggle-sort="toggleSort"
            />

            <div class="text-gray-700 date-joined-grid">{{ $t('title.dateJoined') }}</div>
          </div>

          <div class="flex flex-col nc-scrollbar-md">
            <div
              v-for="(collab, i) of sortedCollaborators"
              :key="i"
              :class="{
                'bg-[#F0F3FF]': selected[collab.id],
              }"
              class="user-row flex hover:bg-[#F0F3FF] flex-row border-b-1 py-1 min-h-14 items-center"
            >
              <div class="py-3 px-6">
                <NcCheckbox v-model:checked="selected[collab.id]" />
              </div>
              <div class="flex gap-3 items-center users-email-grid">
                <GeneralUserIcon size="base" :email="collab.email" />
                <div class="flex flex-col">
                  <div class="flex gap-3">
                    <span class="text-gray-800 capitalize font-semibold">
                      {{ collab.display_name || collab.email.slice(0, collab.email.indexOf('@')) }}
                    </span>
                  </div>
                  <span class="text-xs text-gray-600">
                    {{ collab.email }}
                  </span>
                </div>
              </div>
              <div class="user-access-grid">
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
                    :on-role-change="(role) => updateCollaborator(collab, role as ProjectRoles)"
                  />
                </template>
                <template v-else>
                  <RolesBadge :border="false" :role="collab.roles" />
                </template>
              </div>
              <div class="date-joined-grid">
                <NcTooltip class="max-w-full">
                  <template #title>
                    {{ parseStringDateTime(collab.created_at) }}
                  </template>
                  <span>
                    {{ timeAgo(collab.created_at) }}
                  </span>
                </NcTooltip>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
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

.color-band {
  @apply w-6 h-6 left-0 top-2.5 rounded-full flex justify-center uppercase text-white font-weight-bold text-xs items-center;
}

:deep(.nc-collaborator-role-select .ant-select-selector) {
  @apply !rounded;
}

:deep(.ant-select-selection-item) {
  @apply mt-0.75;
}

.users-email-grid {
  @apply flex-grow ml-4 w-1/2;
}

.date-joined-grid {
  @apply w-1/4 flex items-start;
}

.user-access-grid {
  @apply w-1/4 flex justify-start;
}

.user-row {
  @apply w-full;
}
.user-row:last-child {
  @apply border-b-0;
}
</style>
