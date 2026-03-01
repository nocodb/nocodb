<script lang="ts" setup>
import { useTitle } from '@vueuse/core'
import { PlanFeatureTypes, PlanTitles } from 'nocodb-sdk'

const props = defineProps<{
  workspaceId?: string
  tab?: string
}>()

const router = useRouter()
const route = router.currentRoute

const { t } = useI18n()

const { hideSidebar, isLeftSidebarOpen } = storeToRefs(useSidebarStore())

const { isUIAllowed, isBaseRolesLoaded, loadRoles } = useRoles()

const { appInfo, isMobileMode } = useGlobal()

const workspaceStore = useWorkspace()

const { activeWorkspace: _activeWorkspace, workspaces, deletingWorkspace, isTeamsEnabled } = storeToRefs(workspaceStore)
const { loadCollaborators, loadWorkspace } = workspaceStore

const orgStore = useOrg()
const { orgId, org } = storeToRefs(orgStore)

const {
  isWsAuditEnabled,
  handleUpgradePlan,
  isPaymentEnabled,
  getFeature,
  blockTeamsManagement,
  showUpgradeToUseTeams,
  isEEFeatureBlocked,
} = useEeConfig()

const { isFromIntegrationPage, integrationPaginationData, activeViewTab, loadIntegrations } = useProvideIntegrationViewStore()

const hasTeamsEditPermission = computed(() => {
  return isEeUI && isTeamsEnabled.value && isUIAllowed('teamCreate')
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

const tab = computed({
  get() {
    return route.value.query?.tab ?? 'collaborators'
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

    router.push({ query: { ...route.value.query, tab } })
  },
})

const isWorkspaceSsoAvail = computed(() => {
  if (isEeUI && appInfo.value?.isCloud && getFeature(PlanFeatureTypes.FEATURE_SSO)) {
    return true
  }
  return false
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
  until(() => currentWorkspace.value?.id && isBaseRolesLoaded.value)
    .toMatch((v) => !!v)
    .then(async () => {
      if (isUIAllowed('workspaceCollaborators')) {
        await loadCollaborators({} as any, currentWorkspace.value!.id)
      }
    })
})

watch(
  () => route.value.query?.tab,
  async (newTab) => {
    await until(() => isBaseRolesLoaded.value).toBeTruthy()

    if (!isUIAllowed('workspaceCollaborators') && !isEEFeatureBlocked.value) {
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

const { shouldShow: btbShouldShow } = useBackToBase()

// --- Inline mode (admin sidebar) ---

const adminPageTitle = computed(() => {
  if (!props.tab) return ''
  const tabTitles: Record<string, string> = {
    'ws-collaborators': t('labels.inviteUsersToWorkspace'),
    'ws-teams': t('labels.manageTeams'),
    'ws-integrations': t('general.integrations'),
    'ws-billing': t('general.billing'),
    'ws-audits': t('title.audits'),
    'ws-sso': t('title.sso'),
    'ws-settings': t('general.general'),
  }
  return tabTitles[props.tab] || ''
})

const isAdminSidebar = computed(() => !!props.tab)

provide('isAdminSidebar', isAdminSidebar)

// Load workspace data when tab changes (inline mode)
watch(
  () => props.tab,
  (newTab, oldTab) => {
    if (oldTab === 'ws-integrations') {
      isFromIntegrationPage.value = false
    }

    if (!newTab) return

    until(() => currentWorkspace.value?.id)
      .toMatch((v) => !!v)
      .then(async () => {
        if (['ws-collaborators', 'ws-teams'].includes(newTab) && isUIAllowed('workspaceCollaborators')) {
          await loadCollaborators({} as any, currentWorkspace.value!.id)
        }
        if (newTab === 'ws-integrations') {
          isFromIntegrationPage.value = true
          await loadIntegrations()
        }
      })
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (props.tab === 'ws-integrations') {
    isFromIntegrationPage.value = false
  }
})
</script>

<template>
  <!-- Inline mode: render content directly without NcTabs (used from admin sidebar) -->
  <div v-if="props.tab && currentWorkspace" class="h-full nc-base-view flex flex-col">
    <div
      class="flex flex-row px-2 py-2 gap-3 w-full border-b-1 border-nc-border-gray-medium h-[var(--topbar-height)]"
    >
      <div class="flex-1 flex flex-row items-center gap-x-3">
        <GeneralOpenLeftSidebarBtn />
        <span class="font-semibold text-sm text-nc-content-gray truncate">
          {{ adminPageTitle }}
        </span>
      </div>
    </div>
    <div
      class="flex-1 min-h-0 nc-admin-ws-content"
      :style="{ height: 'calc(100% - var(--topbar-height))' }"
    >
      <template v-if="props.tab === 'ws-collaborators'">
        <WorkspaceCollaboratorsList :workspace-id="currentWorkspace.id" :is-active="true" />
      </template>
      <template v-else-if="props.tab === 'ws-teams'">
        <WorkspaceTeams :workspace-id="currentWorkspace.id" :is-active="true" />
      </template>
      <template v-else-if="props.tab === 'ws-integrations'">
        <div class="h-full flex flex-col">
          <NcTabs v-model:active-key="activeViewTab">
            <template #leftExtra>
              <div class="w-3"></div>
            </template>
            <a-tab-pane key="integrations" class="w-full">
              <template #tab>
                <div class="tab-title">
                  <GeneralIcon icon="integration" />
                  {{ $t('general.integrations') }}
                </div>
              </template>
              <div class="h-full">
                <WorkspaceIntegrationsTab show-filter />
              </div>
            </a-tab-pane>
            <a-tab-pane key="connections" class="w-full">
              <template #tab>
                <div class="tab-title">
                  <GeneralIcon icon="gitCommit" />
                  {{ $t('general.connections') }}
                  <div
                    v-if="integrationPaginationData?.totalRows"
                    class="tab-info flex-none"
                    :class="{
                      'bg-primary-selected': activeViewTab === 'connections',
                      'bg-nc-bg-gray-extralight': activeViewTab !== 'connections',
                    }"
                  >
                    {{ integrationPaginationData.totalRows }}
                  </div>
                </div>
              </template>
              <div class="p-6 h-full">
                <WorkspaceIntegrationsConnectionsTab />
              </div>
            </a-tab-pane>
          </NcTabs>
          <WorkspaceIntegrationsEditOrAdd />
        </div>
      </template>
      <template v-else-if="props.tab === 'ws-billing'">
        <PaymentBillingPage />
      </template>
      <template v-else-if="props.tab === 'ws-audits'">
        <WorkspaceAudits />
      </template>
      <template v-else-if="props.tab === 'ws-sso'">
        <WorkspaceSso />
      </template>
      <template v-else-if="props.tab === 'ws-settings'">
        <WorkspaceSettings :workspace-id="currentWorkspace.id" />
      </template>
    </div>
  </div>

  <!-- Original NcTabs mode -->
  <div v-else-if="currentWorkspace" class="flex w-full flex-col nc-workspace-settings h-full overflow-hidden">
    <div
      v-if="!props.workspaceId"
      class="min-w-0 p-2 h-[var(--topbar-height)] border-b-1 border-nc-border-gray-medium flex items-center gap-2"
    >
      <GeneralOpenLeftSidebarBtn v-if="isMobileMode && !isLeftSidebarOpen" />
      <div
        class="flex-1 nc-breadcrumb nc-no-negative-margin pl-1 nc-workspace-title"
        :class="{
          'max-w-[calc(100%_-_52px)]': isMobileMode,
        }"
      >
        <div class="nc-breadcrumb-item capitalize truncate">
          {{ currentWorkspace?.title }}
        </div>
        <GeneralIcon icon="ncSlash1" class="nc-breadcrumb-divider" />

        <h1 class="nc-breadcrumb-item active truncate">
          {{ $t('title.teamAndSettings') }}
        </h1>
      </div>

      <GeneralHideLeftSidebarBtn v-if="isMobileMode && isLeftSidebarOpen" />
    </div>
    <template v-else>
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

    <!-- Back-to-base full-width bar: shown between breadcrumb and tabs (breadcrumb variant only) -->
    <DashboardBackToBaseBreadcrumbVariant />

    <NcTabs v-model:active-key="tab" class="flex-1 min-h-0">
      <template #leftExtra>
        <div class="w-3"></div>
      </template>
      <template v-if="isUIAllowed('workspaceCollaborators')">
        <a-tab-pane key="collaborators" class="w-full h-full">
          <template #tab>
            <div class="tab-title">
              <GeneralIcon icon="users" class="h-4 w-4" />
              {{ $t('labels.members') }}
            </div>
          </template>

          <WorkspaceCollaboratorsList :workspace-id="currentWorkspace.id" :is-active="tab === 'collaborators'" />
        </a-tab-pane>

        <a-tab-pane v-if="isEeUI && hasTeamsEditPermission" key="teams" class="w-full h-full">
          <template #tab>
            <div class="tab-title">
              <GeneralIcon icon="ncBuilding" class="h-4 w-4" />
              {{ $t('general.teams') }}
              <LazyPaymentUpgradeBadge :feature-enabled-callback="() => !isEEFeatureBlocked" remove-click />
            </div>
          </template>

          <WorkspaceTeams :workspace-id="currentWorkspace.id" :is-active="tab === 'teams'" />
        </a-tab-pane>
      </template>
      <template v-if="!isMobileMode">
        <template
          v-if="
            isEeUI && !props.workspaceId && !currentWorkspace?.fk_org_id && isPaymentEnabled && isUIAllowed('workspaceBilling')
          "
        >
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

        <template v-if="isEeUI && !props.workspaceId && isUIAllowed('workspaceAuditList')">
          <a-tab-pane key="audits" class="w-full">
            <template #tab>
              <div class="tab-title" data-testid="nc-workspace-settings-tab-audits">
                <GeneralIcon icon="audit" class="h-4 w-4" />
                {{ $t('title.audits') }}
                <LazyPaymentUpgradeBadge :feature-enabled-callback="() => isWsAuditEnabled" remove-click />
              </div>
            </template>
            <WorkspaceAudits v-if="isWsAuditEnabled" />
            <div v-else>&nbsp;</div>
          </a-tab-pane>
        </template>

        <template v-if="isWorkspaceSsoAvail && !currentWorkspace?.fk_org_id && isUIAllowed('workspaceSSO')">
          <a-tab-pane key="sso" class="w-full">
            <template #tab>
              <div class="tab-title" data-testid="nc-workspace-settings-tab-billing">
                <GeneralIcon icon="sso" class="flex-none h-4 w-4" />
                {{ $t('title.sso') }}
              </div>
            </template>

            <WorkspaceSso :class="btbShouldShow ? '!h-[calc(100vh-128px)]' : '!h-[calc(100vh-92px)]'" />
          </a-tab-pane>
        </template>
      </template>

      <a-tab-pane v-if="!isEEFeatureBlocked" key="settings" class="w-full">
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
  @apply pt-1.5 pb-2;
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

.nc-admin-ws-content {
  @apply max-w-[1100px] mx-auto w-full text-nc-content-gray-subtle;
  font-size: 13px;
}
</style>
