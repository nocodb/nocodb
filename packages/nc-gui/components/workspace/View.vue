<script lang="ts" setup>
import { useTitle } from '@vueuse/core'

const props = defineProps<{
  workspaceId?: string
}>()

const router = useRouter()
const route = router.currentRoute

const { isUIAllowed } = useRoles()

const workspaceStore = useWorkspace()

const { loadRoles } = useRoles()
const { activeWorkspace: _activeWorkspace, workspaces } = storeToRefs(workspaceStore)
const { loadCollaborators, loadWorkspace } = workspaceStore

const orgStore = useOrg()
const { orgId, org } = storeToRefs(orgStore)

const currentWorkspace = computedAsync(async () => {
  let ws
  if (props.workspaceId) {
    ws = workspaces.value.get(props.workspaceId)
    if (!ws) {
      await loadWorkspace(props.workspaceId)
      ws = workspaces.value.get(props.workspaceId)
    }
  } else {
    ws = _activeWorkspace.value
  }
  await loadRoles(undefined, {}, ws?.id)
  return ws
})

const tab = computed({
  get() {
    return route.value.query?.tab ?? 'collaborators'
  },
  set(tab: string) {
    if (tab === 'collaborators') loadCollaborators({} as any, props.workspaceId)
    router.push({ query: { ...route.value.query, tab } })
  },
})

watch(
  () => currentWorkspace.value?.title,
  (title) => {
    if (!title) return

    const capitalizedTitle = title.charAt(0).toUpperCase() + title.slice(1)

    useTitle(capitalizedTitle)
  },
  {
    immediate: true,
  },
)

onMounted(() => {
  until(() => currentWorkspace.value?.id)
    .toMatch((v) => !!v)
    .then(async () => {
      await loadCollaborators({} as any, currentWorkspace.value!.id)
    })
})
</script>

<template>
  <div v-if="currentWorkspace" class="flex w-full flex-col nc-workspace-settings">
    <div
      v-if="!props.workspaceId"
      class="min-w-0 p-2 h-[var(--topbar-height)] border-b-1 border-gray-200 flex items-center gap-3"
    >
      <div class="flex-1 nc-breadcrumb nc-no-negative-margin pl-1 nc-workspace-title">
        <div class="nc-breadcrumb-item capitalize">
          {{ currentWorkspace?.title }}
        </div>
        <GeneralIcon icon="ncSlash1" class="nc-breadcrumb-divider" />

        <h1 class="nc-breadcrumb-item active">
          {{ $t('title.teamAndSettings') }}
        </h1>
      </div>
      <SmartsheetTopbarCmdK />
    </div>
    <template v-else>
      <div class="nc-breadcrumb px-2">
        <div class="nc-breadcrumb-item">
          {{ org.title }}
        </div>
        <GeneralIcon icon="ncSlash1" class="nc-breadcrumb-divider" />

        <NuxtLink
          :href="`/admin/${orgId}/workspaces`"
          class="!hover:(text-gray-800 underline-gray-600) flex items-center !text-gray-700 !underline-transparent max-w-1/4"
        >
          <div class="nc-breadcrumb-item">
            {{ $t('labels.workspaces') }}
          </div>
        </NuxtLink>
        <GeneralIcon icon="ncSlash1" class="nc-breadcrumb-divider" />

        <div class="nc-breadcrumb-item active truncate capitalize">
          {{ currentWorkspace?.title }}
        </div>
      </div>
      <NcPageHeader>
        <template #icon>
          <div class="flex justify-center items-center h-6 w-6">
            <GeneralWorkspaceIcon :workspace="currentWorkspace" size="medium" />
          </div>
        </template>
        <template #title>
          <span data-rec="true" class="capitalize">
            {{ currentWorkspace?.title }}
          </span>
        </template>
      </NcPageHeader>
    </template>

    <NcTabs v-model:activeKey="tab">
      <template #leftExtra>
        <div class="w-3"></div>
      </template>
      <template v-if="isUIAllowed('workspaceCollaborators')">
        <a-tab-pane key="collaborators" class="w-full">
          <template #tab>
            <div class="tab-title">
              <GeneralIcon icon="users" class="h-4 w-4" />
              {{ $t('labels.members') }}
            </div>
          </template>
          <WorkspaceCollaboratorsList :workspace-id="currentWorkspace.id" />
        </a-tab-pane>
      </template>

      <template v-if="isUIAllowed('workspaceManage')">
        <a-tab-pane key="settings" class="w-full">
          <template #tab>
            <div class="tab-title" data-testid="nc-workspace-settings-tab-settings">
              <GeneralIcon icon="ncSettings" class="h-4 w-4" />
              {{ $t('labels.settings') }}
            </div>
          </template>
          <WorkspaceSettings :workspace-id="currentWorkspace.id" />
        </a-tab-pane>
      </template>
    </NcTabs>
  </div>
</template>

<style lang="scss" scoped>
.tab {
  @apply flex flex-row items-center gap-x-2;
}

:deep(.ant-tabs-nav) {
  @apply !pl-0;
}
:deep(.ant-tabs-tab) {
  @apply pt-2 pb-3;
}
:deep(.ant-tabs-content) {
  @apply nc-content-max-w;
}
.ant-tabs-content-top {
  @apply !h-full;
}
.tab-info {
  @apply flex pl-1.25 px-1.5 py-0.75 rounded-md text-xs;
}
.tab-title {
  @apply flex flex-row items-center gap-x-2 py-[1px];
}
</style>
