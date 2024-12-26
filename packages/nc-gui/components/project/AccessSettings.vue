<script lang="ts" setup>
import type { MetaType, Roles, WorkspaceUserRoles } from 'nocodb-sdk'
import { OrderedProjectRoles, OrgUserRoles, ProjectRoles, WorkspaceRolesToProjectRoles } from 'nocodb-sdk'

const props = defineProps<{
  baseId?: string
}>()

const basesStore = useBases()
const { getBaseUsers, createProjectUser, updateProjectUser, removeProjectUser } = basesStore
const { activeProjectId, bases, basesUser } = storeToRefs(basesStore)

const { orgRoles, baseRoles, loadRoles } = useRoles()

const { sorts, sortDirection, loadSorts, handleGetSortedData, saveOrUpdate: saveOrUpdateUserSort } = useUserSorts('Project')

const isSuper = computed(() => orgRoles.value?.[OrgUserRoles.SUPER_ADMIN])

const orgStore = useOrg()
const { orgId, org } = storeToRefs(orgStore)

const isAdminPanel = inject(IsAdminPanelInj, ref(false))

const { $api } = useNuxtApp()

const { t } = useI18n()

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
  meta: MetaType
}
const collaborators = ref<Collaborators[]>([])
const totalCollaborators = ref(0)
const userSearchText = ref('')

const isLoading = ref(false)
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

const isOwnerOrCreator = computed(() => {
  return baseRoles.value?.[ProjectRoles.OWNER] || baseRoles.value?.[ProjectRoles.CREATOR]
})

const updateCollaborator = async (collab: any, roles: ProjectRoles) => {
  const currentCollaborator = collaborators.value.find((coll) => coll.id === collab.id)!

  try {
    if (!roles || (roles === ProjectRoles.NO_ACCESS && !isEeUI)) {
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
      accessibleRoles.value = OrderedProjectRoles.slice(0)
    } else if (currentRoleIndex !== -1) {
      accessibleRoles.value = OrderedProjectRoles.slice(currentRoleIndex)
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

const orderBy = computed<Record<string, SordDirectionType>>({
  get: () => {
    return sortDirection.value
  },
  set: (value: Record<string, SordDirectionType>) => {
    // Check if value is an empty object
    if (Object.keys(value).length === 0) {
      saveOrUpdateUserSort({})
      return
    }

    const [field, direction] = Object.entries(value)[0]

    saveOrUpdateUserSort({
      field,
      direction,
    })
  },
})

const columns = [
  {
    key: 'select',
    title: '',
    width: 70,
    minWidth: 70,
  },
  {
    key: 'email',
    title: t('objects.users'),
    minWidth: 220,
    dataIndex: 'email',
    showOrderBy: true,
  },
  {
    key: 'role',
    title: t('general.role'),
    basis: '30%',
    minWidth: 272,
    dataIndex: 'roles',
    showOrderBy: true,
  },
  {
    key: 'created_at',
    title: t('title.dateJoined'),
    basis: '25%',
    minWidth: 200,
  },
] as NcTableColumnProps[]

const customRow = (record: Record<string, any>) => ({
  class: `${selected[record.id] ? 'selected' : ''} user-row`,
})

const isOnlyOneOwner = computed(() => {
  return collaborators.value?.filter((collab) => collab.roles === ProjectRoles.OWNER).length === 1
})

const isDeleteOrUpdateAllowed = (user) => {
  return !(isOnlyOneOwner.value && user.roles === ProjectRoles.OWNER)
}
</script>

<template>
  <div
    class="nc-collaborator-table-container nc-access-settings-view flex flex-col"
    :class="{
      'h-[calc(100vh_-_100px)]': !isAdminPanel,
    }"
  >
    <div v-if="isAdminPanel">
      <div class="nc-breadcrumb px-2">
        <div class="nc-breadcrumb-item">
          {{ org.title }}
        </div>
        <GeneralIcon icon="ncSlash1" class="nc-breadcrumb-divider" />
        <NuxtLink
          :href="`/admin/${orgId}/bases`"
          class="!hover:(text-gray-800 underline-gray-600) flex items-center !text-gray-700 !underline-transparent max-w-1/4"
        >
          <div class="nc-breadcrumb-item">
            {{ $t('objects.projects') }}
          </div>
        </NuxtLink>
        <GeneralIcon icon="ncSlash1" class="nc-breadcrumb-divider" />
        <div class="nc-breadcrumb-item active truncate capitalize">
          {{ currentBase?.title }}
        </div>
      </div>
      <NcPageHeader>
        <template #icon>
          <div class="nc-page-header-icon flex justify-center items-center h-5 w-5">
            <GeneralBaseIconColorPicker readonly />
          </div>
        </template>
        <template #title>
          <span data-rec="true" class="capitalize">
            {{ currentBase?.title }}
          </span>
        </template>
      </NcPageHeader>
    </div>

    <div class="nc-content-max-w h-full flex flex-col items-center gap-6 px-6 pt-6">
      <div v-if="!isAdminPanel" class="w-full flex justify-between items-center max-w-full gap-3">
        <a-input
          v-model:value="userSearchText"
          :placeholder="$t('title.searchMembers')"
          :disabled="isLoading"
          allow-clear
          class="nc-input-border-on-value !max-w-90 !h-8 !px-3 !py-1 !rounded-lg"
        >
          <template #prefix>
            <GeneralIcon icon="search" class="mr-2 h-4 w-4 text-gray-500 group-hover:text-black" />
          </template>
        </a-input>

        <NcButton :disabled="isLoading" size="small" @click="isInviteModalVisible = true">
          <div class="flex items-center gap-1">
            <component :is="iconMap.plus" class="w-4 h-4" />
            {{ $t('activity.addMembers') }}
          </div>
        </NcButton>
      </div>

      <NcTable
        v-model:order-by="orderBy"
        :is-data-loading="isLoading"
        :columns="columns"
        :data="sortedCollaborators"
        :bordered="false"
        :custom-row="customRow"
        class="flex-1 nc-collaborators-list max-w-full"
      >
        <template #emptyText>
          <a-empty :description="$t('title.noMembersFound')" />
        </template>

        <template #headerCell="{ column }">
          <template v-if="column.key === 'select'">
            <NcCheckbox v-model:checked="selectAll" :disabled="!sortedCollaborators.length" />
          </template>
          <template v-else>
            {{ column.title }}
          </template>
        </template>

        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'select'">
            <NcCheckbox v-model:checked="selected[record.id]" />
          </template>

          <div v-if="column.key === 'email'" class="w-full flex gap-3 items-center users-email-grid">
            <GeneralUserIcon size="base" :user="record" class="flex-none" />
            <div class="flex flex-col flex-1 max-w-[calc(100%_-_44px)]">
              <div class="flex gap-3">
                <NcTooltip class="truncate max-w-full text-gray-800 capitalize font-semibold" show-on-truncate-only>
                  <template #title>
                    {{ record.display_name || record.email.slice(0, record.email.indexOf('@')) }}
                  </template>
                  {{ record.display_name || record.email.slice(0, record.email.indexOf('@')) }}
                </NcTooltip>
              </div>
              <NcTooltip class="truncate max-w-full text-xs text-gray-600" show-on-truncate-only>
                <template #title>
                  {{ record.email }}
                </template>
                {{ record.email }}
              </NcTooltip>
            </div>
          </div>
          <div v-if="column.key === 'role'">
            <template v-if="isDeleteOrUpdateAllowed(record) && isOwnerOrCreator && accessibleRoles.includes(record.roles)">
              <RolesSelector
                :role="record.roles"
                :roles="accessibleRoles"
                :inherit="
                  isEeUI && record.workspace_roles && WorkspaceRolesToProjectRoles[record.workspace_roles]
                    ? WorkspaceRolesToProjectRoles[record.workspace_roles]
                    : null
                "
                show-inherit
                :description="false"
                :on-role-change="(role) => updateCollaborator(record, role as ProjectRoles)"
              />
            </template>
            <template v-else>
              <RolesBadge :border="false" :role="record.roles" />
            </template>
          </div>
          <div v-if="column.key === 'created_at'">
            <NcTooltip class="max-w-full">
              <template #title>
                {{ parseStringDateTime(record.created_at) }}
              </template>
              <span>
                {{ timeAgo(record.created_at) }}
              </span>
            </NcTooltip>
          </div>
        </template>
      </NcTable>
    </div>

    <LazyDlgInviteDlg v-model:model-value="isInviteModalVisible" :base-id="currentBase?.id" type="base" />
  </div>
</template>

<style scoped lang="scss">
.color-band {
  @apply w-6 h-6 left-0 top-2.5 rounded-full flex justify-center uppercase text-white font-weight-bold text-xs items-center;
}

:deep(.nc-collaborator-role-select .ant-select-selector) {
  @apply !rounded;
}

.nc-page-header-icon {
  :deep(svg) {
    @apply h-4.5 w-4.5;
  }
}
</style>
