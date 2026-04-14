<script lang="ts" setup>
import { useTitle } from '@vueuse/core'
import { PlanFeatureTypes, PlanTitles } from 'nocodb-sdk'

const props = defineProps<{
  workspaceId?: string
  isNewWsPage?: boolean
}>()

const router = useRouter()
const route = router.currentRoute

const { t } = useI18n()

const { hideSidebar, isLeftSidebarOpen } = storeToRefs(useSidebarStore())

const { isUIAllowed, isBaseRolesLoaded, loadRoles } = useRoles()

const isAdminPanel = inject(IsAdminPanelInj, ref(false))

const { isMobileMode } = useGlobal()

const workspaceStore = useWorkspace()

const { activeWorkspace: _activeWorkspace, workspaces, deletingWorkspace } = storeToRefs(workspaceStore)
const { loadCollaborators, loadWorkspace } = workspaceStore

const orgStore = useOrg()
const { orgId, org } = storeToRefs(orgStore)

const { isWsAuditEnabled, handleUpgradePlan, blockTeamsManagement, showUpgradeToUseTeams, showEEFeatures } = useEeConfig()

const { isFromIntegrationPage, eventBus, searchQuery: storeSearchQuery, loadIntegrations } = useProvideIntegrationViewStore()

// Local ref for integrations view mode (main page vs all-connections page).
// Cannot use activeViewTab (which writes to route.query.tab) because the outer NcTabs
// also reads route.query.tab — changing it to 'connections' makes the outer pane blank.
const integrationsViewMode = ref<'main' | 'all-connections'>('main')

// After creating an integration, switch to all-connections view
// (the store sets activeViewTab='connections' which breaks outer NcTabs, so we handle it here)
const integrationEventBusHandler = (event: string) => {
  if (event === IntegrationStoreEvents.INTEGRATION_ADD) {
    integrationsViewMode.value = 'all-connections'
  }
}

eventBus.on(integrationEventBusHandler)

onBeforeUnmount(() => {
  eventBus.off(integrationEventBusHandler)
})

watch(integrationsViewMode, () => {
  storeSearchQuery.value = ''
})

const currentWorkspace = computedAsync(async () => {
  if (deletingWorkspace.value) return
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

const { hasTeamsEditPermission, wsTabVisibility } = useWorkspaceTabVisibility(currentWorkspace, { isAdminPanel })

const tab = computed({
  get() {
    return props.isNewWsPage
      ? routeNameToWsTab[route.value.name as string] || 'collaborators'
      : route.value.query?.tab ?? 'collaborators'
  },
  set(tab: string) {
    if (!isWsAuditEnabled.value && tab === 'audits') {
      return handleUpgradePlan({
        title: t('upgrade.upgradeToAccessWsAudit'),
        content: t('upgrade.upgradeToAccessWsAuditSubtitle', {
          plan: PlanTitles.ENTERPRISE,
        }),
        limitOrFeature: PlanFeatureTypes.FEATURE_AUDIT_WORKSPACE,
      })
    }

    if (isEeUI && tab === 'teams' && hasTeamsEditPermission.value && showUpgradeToUseTeams()) return

    if (['collaborators', 'teams'].includes(tab) && isUIAllowed('workspaceCollaborators')) {
      loadCollaborators({} as any, props.workspaceId)
    }

    if (props.isNewWsPage) {
      router.push({ name: wsTabToRouteName[tab] || 'index-typeOrId' })
    } else {
      router.push({ query: { ...route.value.query, tab } })
    }
  },
})

const tabTitleMap: Record<string, string> = {
  bases: t('objects.projects'),
  collaborators: t('labels.members'),
  teams: t('general.teams'),
  integrations: t('general.integrations'),
  billing: t('general.billing'),
  audits: t('title.audits'),
  sso: t('title.sso'),
  settings: t('labels.settings'),
}

watch(
  [() => currentWorkspace.value?.title, () => tab.value],
  ([wsTitle, activeTab]) => {
    if (!wsTitle) return

    const capitalizedTitle = wsTitle.charAt(0).toUpperCase() + wsTitle.slice(1)

    if (props.isNewWsPage) {
      const tabLabel = tabTitleMap[activeTab as string]
      useTitle(tabLabel ? `${tabLabel} - ${capitalizedTitle}` : capitalizedTitle)
    } else {
      useTitle(capitalizedTitle)
    }
  },
  {
    immediate: true,
  },
)

onMounted(() => {
  until(() => currentWorkspace.value?.id && isBaseRolesLoaded.value)
    .toMatch((v) => !!v)
    .then(async () => {
      if (isUIAllowed('workspaceCollaborators')) {
        await loadCollaborators({} as any, currentWorkspace.value!.id)
      }
    })
})

watch(
  () => tab.value,
  async (newTab, oldTab) => {
    if (newTab === 'integrations') {
      isFromIntegrationPage.value = true

      await until(() => currentWorkspace.value?.id)
        .toMatch((v) => !!v)
        .then(async () => {
          await loadIntegrations()
        })
    }

    if (oldTab === 'integrations') {
      isFromIntegrationPage.value = false
      integrationsViewMode.value = 'main'
    }

    await until(() => isBaseRolesLoaded.value).toBeTruthy()

    if (!isAdminPanel.value && !isUIAllowed('workspaceCollaborators') && showEEFeatures.value) {
      tab.value = 'settings'
    } else if (
      (!isWsAuditEnabled.value && newTab === 'audits') ||
      ((!isEeUI || !hasTeamsEditPermission.value || blockTeamsManagement.value) && newTab === 'teams')
    ) {
      tab.value = 'collaborators'
    }
  },
  {
    immediate: true,
  },
)

if (!props.isNewWsPage) {
  onMounted(() => {
    hideSidebar.value = true
  })

  onBeforeUnmount(() => {
    hideSidebar.value = false
  })
}
</script>

<template>
  <div v-if="currentWorkspace" class="flex w-full flex-col nc-workspace-settings h-full overflow-hidden">
    <div
      v-if="!props.workspaceId && !isNewWsPage"
      class="min-w-0 p-2 h-[var(--topbar-height)] border-b-1 border-nc-border-gray-medium flex items-center gap-2"
    >
      <GeneralOpenLeftSidebarBtn v-if="isMobileMode && !isLeftSidebarOpen" />
      <div
        class="flex-1 nc-breadcrumb nc-no-negative-margin pl-1 nc-workspace-title"
        :class="{
          'max-w-[calc(100%_-_52px)]': isMobileMode,
        }"
      >
        <div
          class="nc-breadcrumb-item capitalize truncate"
          :class="{
            '!text-bodyLgBold': isNewWsPage,
          }"
        >
          {{ currentWorkspace?.title }}
        </div>
        <template v-if="!isNewWsPage">
          <GeneralIcon icon="ncSlash1" class="nc-breadcrumb-divider" />

          <h1 class="nc-breadcrumb-item active truncate">
            {{ $t('title.teamAndSettings') }}
          </h1>
        </template>
      </div>

      <GeneralHideLeftSidebarBtn v-if="isMobileMode && isLeftSidebarOpen" />
    </div>
    <template v-else-if="!isNewWsPage">
      <div class="nc-breadcrumb px-2">
        <div class="nc-breadcrumb-item">
          {{ org.title }}
        </div>
        <GeneralIcon icon="ncSlash1" class="nc-breadcrumb-divider" />

        <NuxtLink
          :href="`/admin/${orgId}/workspaces`"
          class="!hover:(text-nc-content-gray underline-nc-border-gray-underline) flex items-center !text-nc-content-gray-subtle !underline-transparent max-w-1/4"
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

    <NcTabs v-model:active-key="tab" class="flex-1 min-h-0" :class="{ 'hide-tabs': isNewWsPage }">
      <template #leftExtra>
        <div class="w-3"></div>
      </template>
      <template v-if="wsTabVisibility.collaborators">
        <a-tab-pane key="collaborators" class="w-full h-full">
          <template #tab>
            <div class="tab-title">
              <GeneralIcon icon="users" class="h-4 w-4" />
              {{ $t('labels.members') }}
            </div>
          </template>

          <WorkspaceCollaboratorsList :workspace-id="currentWorkspace.id" :is-active="tab === 'collaborators'" />
        </a-tab-pane>

        <a-tab-pane v-if="wsTabVisibility.teams" key="teams" class="w-full h-full">
          <template #tab>
            <div class="tab-title">
              <GeneralIcon icon="ncBuilding" class="h-4 w-4" />
              {{ $t('general.teams') }}
              <LazyPaymentUpgradeBadge :feature="PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT" remove-click />
            </div>
          </template>

          <WorkspaceTeams :workspace-id="currentWorkspace.id" :is-active="tab === 'teams'" />
        </a-tab-pane>
      </template>
      <template v-if="!isMobileMode">
        <a-tab-pane v-if="isNewWsPage && wsTabVisibility.integrations" key="integrations" class="w-full h-full">
          <template #tab>
            <div class="tab-title">
              <GeneralIcon icon="integration" class="h-4 w-4" />
              {{ $t('general.integrations') }}
            </div>
          </template>
          <div class="nc-integrations-layout h-[calc(100vh-var(--topbar-height)-44px)] nc-content-max-w mx-auto">
            <!-- Main integrations page -->
            <template v-if="integrationsViewMode === 'main'">
              <div class="h-full">
                <WorkspaceIntegrationsTab
                  show-filter
                  show-title
                  show-active-connections
                  @view-all-connections="integrationsViewMode = 'all-connections'"
                />
              </div>
            </template>

            <!-- All connections page -->
            <template v-else-if="integrationsViewMode === 'all-connections'">
              <div class="h-full flex flex-col px-8 py-6">
                <NcButton
                  type="link"
                  size="small"
                  class="!text-nc-content-brand self-start !-ml-1.5 mb-4 !p-0 !h-auto !min-h-0"
                  inner-class="hover:underline"
                  @click="integrationsViewMode = 'main'"
                >
                  <GeneralIcon icon="arrowLeft" class="mr-1" />
                  {{ $t('general.backToIntegrations') }}
                </NcButton>

                <div class="flex items-center justify-between mb-2">
                  <h2 class="text-lg font-semibold text-nc-content-gray mb-0">
                    {{ $t('general.allConnections') }}
                  </h2>
                  <WorkspaceIntegrationsAddConnectionDropdown />
                </div>

                <div class="flex-1 min-h-0">
                  <WorkspaceIntegrationsConnectionsTab />
                </div>
              </div>
            </template>

            <WorkspaceIntegrationsEditOrAdd />
          </div>
        </a-tab-pane>

        <template v-if="wsTabVisibility.billing">
          <a-tab-pane key="billing" class="w-full">
            <template #tab>
              <div class="tab-title" data-testid="nc-workspace-settings-tab-billing">
                <GeneralIcon icon="ncDollarSign" class="flex-none h-4 w-4" />
                {{ $t('general.billing') }}
              </div>
            </template>

            <PaymentBillingPage />
          </a-tab-pane>
        </template>

        <template v-if="wsTabVisibility.audits">
          <a-tab-pane key="audits" class="w-full">
            <template #tab>
              <div class="tab-title" data-testid="nc-workspace-settings-tab-audits">
                <GeneralIcon icon="audit" class="h-4 w-4" />
                {{ $t('title.audits') }}
                <LazyPaymentUpgradeBadge
                  :feature="PlanFeatureTypes.FEATURE_AUDIT_WORKSPACE"
                  :feature-enabled-callback="() => isWsAuditEnabled"
                  remove-click
                />
              </div>
            </template>
            <WorkspaceAudits v-if="isWsAuditEnabled" />
            <div v-else>&nbsp;</div>
          </a-tab-pane>
        </template>

        <template v-if="wsTabVisibility.sso">
          <a-tab-pane key="sso" class="w-full">
            <template #tab>
              <div class="tab-title" data-testid="nc-workspace-settings-tab-billing">
                <GeneralIcon icon="sso" class="flex-none h-4 w-4" />
                {{ $t('title.sso') }}
              </div>
            </template>

            <WorkspaceSso class="!h-[calc(100vh-92px)]" />
          </a-tab-pane>
        </template>
      </template>

      <a-tab-pane v-if="wsTabVisibility.settings" key="settings" class="w-full">
        <template #tab>
          <div class="tab-title" data-testid="nc-workspace-settings-tab-settings">
            <GeneralIcon icon="ncSettings" class="h-4 w-4" />
            {{ $t('labels.settings') }}
          </div>
        </template>

        <WorkspaceSettings :workspace-id="currentWorkspace.id" />
      </a-tab-pane>
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

:deep(.ant-tabs-tab + .ant-tabs-tab) {
  @apply !ml-3;
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

.hide-tabs {
  // Hide only the top-level tab nav (this element IS the .ant-tabs)
  > :deep(.ant-tabs-nav) {
    @apply !hidden;
  }
}
</style>
