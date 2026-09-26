<script lang="ts" setup>
import { useTitle } from '@vueuse/core'
import { PlanFeatureTypes, PlanTitles } from 'nocodb-sdk'

// The org admin panel's view of one workspace. On the workspace itself these
// panes live on the settings page (`WorkspaceSettingsShell`).
const props = defineProps<{
  workspaceId?: string
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

const { isWsAuditEnabled, handleUpgradePlan, blockTeamsManagement, blockWorkspaceSso, showUpgradeToUseWorkspaceSso } =
  useEeConfig()

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
        triggerSource: 'ws-home-audit',
      })
    }

    if (tab === 'sso' && showUpgradeToUseWorkspaceSso({ triggerSource: 'ws-home-sso' })) {
      return
    }

    if (['collaborators', 'teams'].includes(tab) && isUIAllowed('workspaceCollaborators')) {
      loadCollaborators({} as any, props.workspaceId)
    }

    router.push({ query: { ...route.value.query, tab } })
  },
})

watch(
  () => currentWorkspace.value?.title,
  (wsTitle) => {
    if (!wsTitle) return

    useTitle(wsTitle.charAt(0).toUpperCase() + wsTitle.slice(1))
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
  async (newTab) => {
    await until(() => isBaseRolesLoaded.value).toBeTruthy()

    if (!isAdminPanel.value && !isUIAllowed('workspaceCollaborators') && isEeUI) {
      tab.value = 'settings'
    } else if (
      (!isWsAuditEnabled.value && newTab === 'audits') ||
      // blockTeamsManagement deliberately absent: a blocked plan now renders the
      // upgrade card on the teams tab rather than being bounced to collaborators
      ((!isEeUI || !hasTeamsEditPermission.value) && newTab === 'teams')
    ) {
      tab.value = 'collaborators'
    }
  },
  {
    immediate: true,
  },
)

onMounted(() => {
  hideSidebar.value = true
})

onBeforeUnmount(() => {
  hideSidebar.value = false
})
</script>

<template>
  <div v-if="currentWorkspace" class="flex w-full flex-col nc-workspace-settings h-full overflow-hidden">
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

    <NcTabs v-model:active-key="tab" class="flex-1 min-h-0">
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

          <PaymentUpgradeFeatureCard
            v-if="blockTeamsManagement"
            :feature="PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT"
            :title="$t('labels.baseNav.upgradeTitleTeams')"
            :detail="$t('labels.baseNav.upgradeDescTeams')"
            icon="ncBuilding"
            trigger-source="ws-teams-page"
          />
          <WorkspaceTeams v-else :workspace-id="currentWorkspace.id" :is-active="tab === 'teams'" />
        </a-tab-pane>
      </template>
      <template v-if="!isMobileMode">
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

        <template v-if="wsTabVisibility.usage">
          <a-tab-pane key="usage" class="w-full">
            <template #tab>
              <div class="tab-title" data-testid="nc-workspace-settings-tab-usage">
                <GeneralIcon icon="ncBarChart2" class="flex-none h-4 w-4" />
                {{ $t('general.usage') }}
              </div>
            </template>

            <WorkspaceUsage :workspace-id="currentWorkspace.id" />
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
              <div class="tab-title" data-testid="nc-workspace-settings-tab-sso">
                <GeneralIcon icon="sso" class="flex-none h-4 w-4" />
                {{ $t('title.sso') }}
                <LazyPaymentUpgradeBadge
                  :feature="PlanFeatureTypes.FEATURE_SSO"
                  :feature-enabled-callback="() => !blockWorkspaceSso"
                  remove-click
                />
              </div>
            </template>

            <WorkspaceSso v-if="!blockWorkspaceSso" class="!h-[calc(100vh-92px)]" />
            <div v-else>&nbsp;</div>
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
</style>
