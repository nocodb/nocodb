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
const { orgId } = storeToRefs(orgStore)

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
  <div v-if="currentWorkspace" class="flex w-full max-w-[97.5rem] flex-col nc-workspace-settings">
    <div v-if="!props.workspaceId" class="min-w-0 py-3 px-2">
      <div class="nc-breadcrumb nc-workspace-title">
        <div class="nc-breadcrumb-item capitalize">
          {{ currentWorkspace?.title }}
        </div>
        <div class="nc-breadcrumb-divider">/</div>
        <h1 class="nc-breadcrumb-item active">
          {{ $t('title.teamAndSettings') }}
        </h1>
      </div>
    </div>
    <div v-else class="px-2">
      <div class="font-bold w-full !mb-5 text-2xl" data-rec="true">
        <div class="flex items-center gap-3">
          <NuxtLink
            :href="`/admin/${orgId}/workspaces`"
            class="!hover:(text-black underline-gray-600) flex items-center !text-black !underline-transparent ml-0.75 max-w-1/4"
          >
            <component :is="iconMap.arrowLeft" class="text-3xl" />

            {{ $t('labels.workspaces') }}
          </NuxtLink>

          <span class="text-2xl"> / </span>
          <GeneralWorkspaceIcon :workspace="currentWorkspace" hide-label />
          <span class="text-base capitalize">
            {{ currentWorkspace?.title }}
          </span>
        </div>
      </div>
    </div>

    <NcTabs v-model:activeKey="tab">
      <template #leftExtra>
        <div class="w-3"></div>
      </template>
      <template v-if="isUIAllowed('workspaceSettings')">
        <a-tab-pane key="collaborators" class="w-full">
          <template #tab>
            <div class="flex flex-row items-center pb-1 gap-x-1.5">
              <GeneralIcon icon="users" class="!h-3.5 !w-3.5" />
              Members
            </div>
          </template>
          <WorkspaceCollaboratorsList :workspace-id="currentWorkspace.id"/>
        </a-tab-pane>
      </template>

      <template v-if="isUIAllowed('workspaceManage')">
        <a-tab-pane key="settings" class="w-full">
          <template #tab>
            <div class="flex flex-row items-center pb-1 gap-x-1.5" data-testid="nc-workspace-settings-tab-settings">
              <GeneralIcon icon="settings" />
              Settings
            </div>
          </template>
          <WorkspaceSettings :workspace-id="currentWorkspace.id" />
        </a-tab-pane>
      </template>

      <template v-if="isUIAllowed('workspaceAuditList') && !props.workspaceId">
        <a-tab-pane key="audit" class="w-full">
          <template #tab>
            <div class="flex flex-row items-center pb-1 gap-x-1.5">
              <GeneralIcon icon="audit" class="!h-3.5 !w-3.5" />
              Audit Logs
            </div>
          </template>
          <div class="h-[calc(100vh-92px)] px-6">
            <WorkspaceAuditLogs :workspace-id="currentWorkspace.id" />
          </div>
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
