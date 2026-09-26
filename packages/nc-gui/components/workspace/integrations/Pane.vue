<script lang="ts" setup>
// The workspace settings Integrations pane: the catalog, and the two views it
// drills into — every connection, and the environments behind them. Escape and
// a mask click step back out of a drill-in before they close the shell.
const props = defineProps<{
  /** Opens on a drill-in — the base Variables pane links straight to environments. */
  initialView?: 'main' | 'all-connections' | 'environments'
}>()

const { isUIAllowed, workspaceRoles } = useRoles()

const { activeWorkspace } = storeToRefs(useWorkspace())

const shell = useShell()

const { isFromIntegrationPage, eventBus, searchQuery, loadIntegrations } = useProvideIntegrationViewStore()

// Local, not the store's `activeViewTab`: that one writes `?tab=`, which the
// shell's host route does not own.
const viewMode = ref<'main' | 'all-connections' | 'environments'>(props.initialView ?? 'main')

function stepBack() {
  if (viewMode.value === 'environments') {
    viewMode.value = 'all-connections'
    return true
  }

  // Non-managers have no catalog to step back to.
  if (viewMode.value === 'all-connections' && isUIAllowed('integrationManage')) {
    viewMode.value = 'main'
    return true
  }

  return false
}

function onIntegrationEvent(event: string) {
  if (event === IntegrationStoreEvents.INTEGRATION_ADD) {
    viewMode.value = 'all-connections'
  }
}

watch(viewMode, () => {
  searchQuery.value = ''
})

// Non-managers can't create integrations, so the catalog is pointless for them:
// they land on the connections list, where per-user integrations offer their
// connect action. Enforced once workspace roles resolve.
watchEffect(() => {
  if (!Object.keys(workspaceRoles.value ?? {}).length) return

  if (!isUIAllowed('integrationManage') && viewMode.value === 'main') {
    viewMode.value = 'all-connections'
  }
})

onMounted(async () => {
  eventBus.on(onIntegrationEvent)

  shell?.registerBackHandler(stepBack)

  isFromIntegrationPage.value = true

  await until(() => activeWorkspace.value?.id).toBeTruthy()

  await loadIntegrations()
})

onBeforeUnmount(() => {
  eventBus.off(onIntegrationEvent)

  shell?.unregisterBackHandler(stepBack)

  isFromIntegrationPage.value = false
})
</script>

<template>
  <div class="nc-integrations-layout h-full" data-testid="nc-ws-settings-integrations">
    <WorkspaceIntegrationsTab
      v-if="viewMode === 'main'"
      show-filter
      show-active-connections
      @view-all-connections="viewMode = 'all-connections'"
    />

    <div v-else-if="viewMode === 'all-connections'" class="h-full flex flex-col nc-shell-gutter pb-6 pt-3">
      <div class="flex items-center justify-between gap-3 mb-3">
        <ShellDrillBack
          v-if="isUIAllowed('integrationManage')"
          :label="$t('general.backToIntegrations')"
          @back="viewMode = 'main'"
        />
        <div v-else />

        <WorkspaceIntegrationsAddConnectionDropdown v-if="isUIAllowed('integrationManage')" />
      </div>

      <div class="flex-1 min-h-0">
        <WorkspaceIntegrationsConnectionsTab :show-environments="isEeUI" @manage-environments="viewMode = 'environments'" />
      </div>
    </div>

    <div v-else-if="viewMode === 'environments'" class="h-full flex flex-col nc-shell-gutter pb-6 pt-3">
      <WorkspaceIntegrationsEnvironmentsManageEnvironments @back="viewMode = 'all-connections'" />
    </div>

    <WorkspaceIntegrationsEditOrAdd />
  </div>
</template>
