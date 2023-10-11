<script lang="ts" setup>
import { useTitle } from '@vueuse/core'

const router = useRouter()
const route = router.currentRoute

const { isUIAllowed } = useRoles()

const workspaceStore = useWorkspace()
const { activeWorkspace, workspaces } = storeToRefs(workspaceStore)
const { loadCollaborators } = workspaceStore

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
  <div v-if="activeWorkspace" class="flex flex-col nc-workspace-settings">
    <div class="flex gap-2 items-center min-w-0 p-6">
      <GeneralWorkspaceIcon :workspace="activeWorkspace" />
      <h1 class="text-3xl font-weight-bold tracking-[0.5px] mb-0 nc-workspace-title truncate min-w-10 capitalize">
        {{ activeWorkspace?.title }}
      </h1>
    </div>

    <NcTabs v-model:activeKey="tab">
      <template v-if="isUIAllowed('workspaceSettings')">
        <a-tab-pane key="collaborators" class="w-full">
          <template #tab>
            <div class="flex flex-row items-center px-2 pb-1 gap-x-1.5">
              <PhUsersBold />
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

:deep(.ant-tabs-nav-list) {
  @apply !ml-3;
}
</style>
