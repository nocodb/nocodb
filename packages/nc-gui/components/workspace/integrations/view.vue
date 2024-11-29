<script lang="ts" setup>
import { useTitle } from '@vueuse/core'

const { isUIAllowed } = useRoles()

const workspaceStore = useWorkspace()

const { loadRoles } = useRoles()
const { activeWorkspace: _activeWorkspace } = storeToRefs(workspaceStore)
const { loadCollaborators } = workspaceStore

const { isFromIntegrationPage, integrationPaginationData, activeViewTab, loadIntegrations } = useProvideIntegrationViewStore()

const currentWorkspace = computedAsync(async () => {
  await loadRoles(undefined, {}, _activeWorkspace.value?.id)
  return _activeWorkspace.value
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
  isFromIntegrationPage.value = true

  until(() => currentWorkspace.value?.id)
    .toMatch((v) => !!v)
    .then(async () => {
      await Promise.all([loadCollaborators({ includeDeleted: true }, currentWorkspace.value!.id), loadIntegrations()])
    })
})

onBeforeMount(() => {
  isFromIntegrationPage.value = false
})
</script>

<template>
  <div v-if="currentWorkspace" class="flex w-full flex-col nc-workspace-integrations">
    <div class="flex gap-2 items-center min-w-0 p-2 h-[var(--topbar-height)] border-b-1 border-gray-200">
      <div class="flex-1 nc-breadcrumb nc-no-negative-margin pl-1">
        <div class="nc-breadcrumb-item capitalize">
          {{ currentWorkspace?.title }}
        </div>
        <GeneralIcon icon="ncSlash1" class="nc-breadcrumb-divider" />
        <h1 class="nc-breadcrumb-item active">
          {{ $t('general.integrations') }}
        </h1>
      </div>

      <SmartsheetTopbarCmdK />
    </div>
    <NcTabs v-model:activeKey="activeViewTab">
      <template #leftExtra>
        <div class="w-3"></div>
      </template>
      <template v-if="isUIAllowed('workspaceIntegrations')">
        <a-tab-pane key="integrations" class="w-full">
          <template #tab>
            <div class="tab-title" data-testid="nc-workspace-settings-tab-integrations">
              <GeneralIcon icon="integration" />
              {{ $t('general.integrations') }}
            </div>
          </template>
          <div class="h-[calc(100vh-92px)]">
            <WorkspaceIntegrationsTab show-filter />
          </div>
        </a-tab-pane>
      </template>
      <template v-if="isUIAllowed('workspaceIntegrations')">
        <a-tab-pane key="connections" class="w-full">
          <template #tab>
            <div class="tab-title" data-testid="nc-workspace-settings-tab-integrations">
              <GeneralIcon icon="gitCommit" />
              {{ $t('general.connections') }}
              <div
                v-if="integrationPaginationData?.totalRows"
                class="tab-info flex-none"
                :class="{
                  'bg-primary-selected': activeViewTab === 'connections',
                  'bg-gray-50': activeViewTab !== 'connections',
                }"
              >
                {{ integrationPaginationData.totalRows }}
              </div>
            </div>
          </template>
          <div class="h-[calc(100vh-92px)] p-6">
            <WorkspaceIntegrationsConnectionsTab />
          </div>
        </a-tab-pane>
      </template>
    </NcTabs>
    <WorkspaceIntegrationsEditOrAdd></WorkspaceIntegrationsEditOrAdd>
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
