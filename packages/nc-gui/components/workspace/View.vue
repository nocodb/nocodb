<script lang="ts" setup>
import { useTitle } from '@vueuse/core'

const props = defineProps<{
  workspaceId?: string
}>()

const router = useRouter()
const route = router.currentRoute

const { isUIAllowed } = useRoles()

const workspaceStore = useWorkspace()
const { activeWorkspace, workspaces } = storeToRefs(workspaceStore)
const { loadCollaborators } = workspaceStore

// TODO: @pranavxc
// The Workspace setting is common for both the workspace and the organization.
// Hence we can reuse the same component for both the workspace and the organization.
//
const tab = computed({
  get() {
    return route.value.query?.tab ?? 'collaborators'
  },
  set(tab: string) {
    if (tab === 'collaborators') loadCollaborators()
    router.push({ query: { ...route.value.query, tab } })
  },
})

watch(
  () => activeWorkspace.value?.title,
  (title: string) => {
    if (!title) return

    const capitalizedTitle = title.charAt(0).toUpperCase() + title.slice(1)

    useTitle(capitalizedTitle)
  },
  {
    immediate: true,
  },
)

onMounted(() => {
  until(() => activeWorkspace.value?.id)
    .toMatch((v) => !!v)
    .then(() => {
      until(() => workspaces.value)
        .toMatch((v) => v.has(activeWorkspace.value.id))
        .then(() => {
          loadCollaborators()
        })
    })
})
</script>

<template>
  <div v-if="activeWorkspace" class="flex w-full px-6 max-w-[97.5rem] flex-col nc-workspace-settings">
    <div v-if="!props.workspaceId" class="flex gap-2 items-center min-w-0 p-6">
      <GeneralWorkspaceIcon :workspace="activeWorkspace" />
      <h1 class="text-3xl font-weight-bold tracking-[0.5px] mb-0 nc-workspace-title truncate min-w-10 capitalize">
        {{ activeWorkspace?.title }}
      </h1>
    </div>
    <div v-else>
      <div class="font-bold w-full !mb-5 text-2xl" data-rec="true">
        <div class="flex items-center gap-3">
          {{ $t('labels.workspaces') }}

          <span class="text-2xl"> / </span>
          <GeneralWorkspaceIcon :workspace="activeWorkspace" hide-label />
          <span class="text-base">
            {{ activeWorkspace?.title }}
          </span>
        </div>
      </div>
    </div>

    <NcTabs v-model:activeKey="tab">
      <template v-if="isUIAllowed('workspaceSettings')">
        <a-tab-pane key="collaborators" class="w-full">
          <template #tab>
            <div class="flex flex-row items-center px-2 pb-1 gap-x-1.5">
              <GeneralIcon icon="users" class="!h-3.5 !w-3.5" />
              Members
            </div>
          </template>
          <WorkspaceCollaboratorsList />
        </a-tab-pane>
      </template>

      <template v-if="isUIAllowed('workspaceManage')">
        <a-tab-pane key="settings" class="w-full">
          <template #tab>
            <div class="flex flex-row items-center px-2 pb-1 gap-x-1.5" data-testid="nc-workspace-settings-tab-settings">
              <GeneralIcon icon="settings" />
              Settings
            </div>
          </template>
          <WorkspaceSettings />
        </a-tab-pane>
      </template>
    </NcTabs>
  </div>
</template>

<style lang="scss" scoped>
.nc-workspace-avatar {
  @apply min-w-6 h-6 rounded-[6px] flex items-center justify-center text-white font-weight-bold uppercase;
  font-size: 0.7rem;
}

.tab {
  @apply flex flex-row items-center gap-x-2;
}

:deep(.ant-tabs-nav) {
  @apply !pl-0;
}

:deep(.ant-tabs-nav-list) {
  @apply !gap-5;
}
:deep(.ant-tabs-tab) {
  @apply !pt-0 !pb-2.5 !ml-0;
}
.ant-tabs-content {
  @apply !h-full;
}
.ant-tabs-content-top {
  @apply !h-full;
}
</style>
