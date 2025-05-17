<script lang="ts" setup>
provide(IsMiniSidebarInj, ref(true))

const router = useRouter()

const route = router.currentRoute

const { appInfo, navigateToProject } = useGlobal()

const { meta: metaKey, control } = useMagicKeys()

const workspaceStore = useWorkspace()

const { activeWorkspaceId, isWorkspaceSettingsPageOpened, isIntegrationsPageOpened } = storeToRefs(workspaceStore)

const { navigateToWorkspaceSettings, navigateToIntegrations: _navigateToIntegrations } = workspaceStore

const { isSharedBase } = storeToRefs(useBase())

const { isUIAllowed } = useRoles()

const isProjectPageOpen = computed(() => {
  return (
    route.value.name?.startsWith('index-typeOrId-baseId-') ||
    route.value.name === 'index' ||
    route.value.name === 'index-typeOrId'
  )
})

watchEffect(() => {
  console.log('isProjectPageOpen', isProjectPageOpen.value, route.value.name, route.value.name === 'index')
})

const navigateToProjectPage = () => {
  navigateToProject({ workspaceId: activeWorkspaceId.value })
}

const navigateToSettings = () => {
  const cmdOrCtrl = isMac() ? metaKey.value : control.value

  // TODO: Handle cloud case properly
  navigateToWorkspaceSettings('', cmdOrCtrl)

  // if (appInfo.value.baseHostName) {
  //   window.location.href = `https://app.${appInfo.value.baseHostName}/dashboard`
  // } else {
  // }
}

const navigateToIntegrations = () => {
  const cmdOrCtrl = isMac() ? metaKey.value : control.value

  _navigateToIntegrations('', cmdOrCtrl)
}
</script>

<template>
  <div
    class="nc-mini-sidebar"
    :style="{
      outlineWidth: '1px',
    }"
  >
    <div class="flex flex-col gap-3 items-center">
      <WorkspaceMenu />

      <div
        class="nc-mini-sidebar-btn"
        data-testid="nc-sidebar-project-btn"
        :class="{
          active: isProjectPageOpen,
        }"
        @click="navigateToProjectPage"
      >
        <GeneralIcon icon="ncBaseOutline" class="h-5 w-5" />
      </div>
      <div
        v-if="isUIAllowed('workspaceSettings') || isUIAllowed('workspaceCollaborators')"
        v-e="['c:team:settings']"
        class="nc-mini-sidebar-btn"
        data-testid="nc-sidebar-team-settings-btn"
        :class="{
          active: isWorkspaceSettingsPageOpened,
        }"
        @click="navigateToSettings"
      >
        <GeneralIcon icon="ncSettings" class="h-5 w-5" />
      </div>
      <div
        v-if="isUIAllowed('workspaceSettings')"
        v-e="['c:integrations']"
        class="nc-mini-sidebar-btn"
        data-testid="nc-sidebar-integrations-btn"
        :class="{
          active: isIntegrationsPageOpened,
        }"
        @click="navigateToIntegrations"
      >
        <GeneralIcon icon="integration" class="h-5 w-5" />
      </div>
    </div>
    <div class="flex flex-col gap-3 items-center">
      <DashboardSidebarFeed v-if="appInfo.feedEnabled" />

      <DashboardSidebarUserInfo />
    </div>
  </div>
</template>

<style lang="scss">
.nc-mini-sidebar {
  @apply w-[var(--mini-sidebar-width)] flex-none bg-nc-bg-gray-light flex flex-col justify-between items-center px-2 py-3 border-r-1 border-nc-border-gray-medium z-12;

  .nc-mini-sidebar-btn {
    @apply cursor-pointer h-9 w-9 rounded p-2 flex items-center justify-center children:flex-none text-nc-content-gray-subtle transition-all duration-200;

    &:not(.active) {
      @apply hover:bg-nc-bg-gray-medium;
    }

    &.active {
      @apply bg-brand-100  text-brand-600;
    }
  }
}
</style>
