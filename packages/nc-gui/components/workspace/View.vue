<script lang="ts" setup>
import type { WorkspaceType } from 'nocodb-sdk'

const router = useRouter()
const route = router.currentRoute

const { isWorkspaceOwnerOrCreator, isWorkspaceOwner, activeWorkspace } = storeToRefs(useWorkspace())

const { appInfo } = useGlobal()

const tab = computed({
  get() {
    return route.value.query?.tab ?? 'collaborators'
  },
  set(tab: string) {
    router.push({ query: { ...route.value.query, tab } })
  },
})

const getWorkspaceColor = (workspace: WorkspaceType) => workspace.meta?.color || stringToColour(workspace.id!)
</script>

<template>
  <div v-if="activeWorkspace" class="flex flex-col">
    <div class="flex gap-2 items-center min-w-0 p-6">
      <span class="nc-workspace-avatar !w-8 !h-8" :style="{ backgroundColor: getWorkspaceColor(activeWorkspace) }">
        {{ activeWorkspace?.title?.slice(0, 2) }}
      </span>
      <h1 class="text-3xl font-weight-bold tracking-[0.5px] mb-0 nc-workspace-title truncate min-w-10">
        {{ activeWorkspace?.title }}
      </h1>
    </div>

    <NcTabs v-model:activeKey="tab">
      <template v-if="isWorkspaceOwnerOrCreator">
        <a-tab-pane key="collaborators" class="w-full">
          <template #tab>
            <div class="flex flex-row items-center px-2 pb-1 gap-x-1.5">
              <PhUsersBold />
              Collaborators
            </div>
          </template>
          <WorkspaceCollaboratorsList />
        </a-tab-pane>
      </template>

      <template v-if="isWorkspaceOwner && appInfo.ee">
        <a-tab-pane key="billing" class="w-full">
          <template #tab>
            <div class="flex flex-row items-center px-2 pb-1 gap-x-1.5">
              <MaterialSymbolsCreditCardOutline />
              Billing
            </div>
          </template>
          <WorkspaceBilling />
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
