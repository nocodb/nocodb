<script lang="ts" setup>
import { NC_DEFAULT_ORG_ID, OrgUserRoles, PlanFeatureTypes } from 'nocodb-sdk'

definePageMeta({
  hideHeader: true,
})

const { orgRoles, isUIAllowed } = useRoles()

const { appInfo } = useGlobal()

const {
  isEEFeatureBlocked,
  showEEFeatures,
  blockSSO,
  showUpgradeToUseSSO,
  blockTeamsManagement,
  showUpgradeToUseTeams,
  blockScim,
  showUpgradeToUseScim,
  isWsAuditEnabled,
} = useEeConfig()

const isSuperAdmin = computed(() => !!orgRoles.value?.[OrgUserRoles.SUPER_ADMIN])

const defaultOrgId = computed(() => (appInfo.value as any)?.defaultOrgId || NC_DEFAULT_ORG_ID)

const isNotCloud = computed(() => !appInfo.value.isCloud)

provide(IsAdminPanelInj, ref(true))

const route = useRoute()

type AdminTab =
  | 'dashboard'
  | 'workspaces'
  | 'bases'
  | 'setup'
  | 'setup-email'
  | 'setup-storage'
  | 'external-integrations'
  | 'authentication'
  | 'teams'
  | 'scim'
  | 'audit'
  | 'license'
  | 'users-list'
  | 'settings'

const validTabs: AdminTab[] = [
  'dashboard',
  'workspaces',
  'bases',
  'setup',
  'setup-email',
  'setup-storage',
  'external-integrations',
  'authentication',
  'teams',
  'scim',
  'audit',
  'license',
  'users-list',
  'settings',
]

const router = useRouter()

const initialTab = validTabs.includes(route.query.tab as AdminTab) ? (route.query.tab as AdminTab) : 'dashboard'

const activeTab = ref<AdminTab>(initialTab)

watch(activeTab, (tab) => {
  router.replace({ query: { ...route.query, tab } })
})

// Sync activeTab when route query changes (e.g. navigateTo from child components)
watch(
  () => route.query.tab,
  (tab) => {
    if (tab && validTabs.includes(tab as AdminTab) && tab !== activeTab.value) {
      activeTab.value = tab as AdminTab
    }
  },
)

const isSetupPageAllowed = computed(() => isUIAllowed('superAdminSetup') && (!isEeUI || !appInfo.value.isCloud))

const { emailConfigured, storageConfigured, categorizeApps, loadSetupApps } = useProvideAccountSetupStore()

watchEffect(() => {
  if (isSetupPageAllowed.value) {
    loadSetupApps()
  }
})

const isPending = computed(() => !emailConfigured.value || !storageConfigured.value)

const setupConfigAppId = computed(() => {
  const appName = route.query.app as string
  if (!appName) return null
  const category = activeTab.value === 'setup-email' ? 'email' : activeTab.value === 'setup-storage' ? 'storage' : null
  if (!category) return null
  return categorizeApps.value?.[category]?.find((a: any) => a.title === appName)?.id ?? null
})

const sidebarSelectedKey = computed(() => {
  if (activeTab.value.startsWith('setup-')) return 'setup'
  return activeTab.value
})

const backRoute = computed(() => ncBackRoute().get())

// Guard: redirect if not on-prem super admin
watch(
  [isSuperAdmin, isNotCloud],
  () => {
    if (!isSuperAdmin.value || !isNotCloud.value) {
      navigateTo('/')
    }
  },
  { immediate: true },
)
</script>

<template>
  <NuxtLayout>
    <div v-if="isSuperAdmin && isNotCloud" class="mx-auto h-full">
      <div class="h-full flex">
        <!-- Side tabs -->
        <div class="h-full bg-nc-bg-gray-sidebar nc-user-sidebar overflow-y-auto nc-scrollbar-thin min-w-[312px]">
          <NcMenu :selected-keys="[sidebarSelectedKey]" :inline-indent="16" class="tabs-menu h-full" mode="inline">
            <div class="h-[var(--topbar-height)] flex items-center children:flex-none">
              <NcButton
                v-e="['c:navbar:home']"
                type="text"
                size="small"
                class="transition-all duration-200 mx-2 cursor-pointer transform nc-noco-brand-icon"
                data-testid="nc-noco-brand-icon"
                @click="navigateTo(backRoute)"
              >
                <div class="flex flex-row gap-x-2 items-center">
                  <GeneralIcon icon="ncArrowLeft" />
                  <div class="flex text-small leading-[18px] font-semibold">{{ $t('labels.back') }}</div>
                </div>
              </NcButton>
            </div>
            <NcDivider class="!-mt-[1px]" />

            <div class="text-sm ml-2 p-2 mt-2 flex items-center justify-between gap-2">
              <div class="text-base font-bold text-nc-content-gray-emphasis">NocoDB</div>
              <span class="text-nc-content-gray-muted">{{ $t('labels.adminPanel') }}</span>
            </div>

            <!-- Overview -->
            <NcMenuItem
              key="dashboard"
              :class="{ active: activeTab === 'dashboard' }"
              class="item"
              @click="activeTab = 'dashboard'"
            >
              <div class="flex items-center space-x-2">
                <GeneralIcon class="!h-4 !w-4" icon="home1" />
                <div class="select-none">{{ $t('labels.dashboard') }}</div>
              </div>
            </NcMenuItem>

            <!-- Data -->
            <NcMenuItem
              key="workspaces"
              :class="{ active: activeTab === 'workspaces' }"
              class="item"
              @click="activeTab = 'workspaces'"
            >
              <div class="flex items-center space-x-2">
                <GeneralIcon
                  icon="ncWorkspace"
                  class="!h-4 !w-4"
                  :class="{
                    'fill-gray-200': activeTab !== 'workspaces',
                    'fill-brand-200': activeTab === 'workspaces',
                  }"
                />
                <div class="select-none">{{ $t('labels.workspaces') }}</div>
              </div>
            </NcMenuItem>

            <NcMenuItem key="bases" :class="{ active: activeTab === 'bases' }" class="item" @click="activeTab = 'bases'">
              <div class="flex items-center space-x-2">
                <GeneralProjectIcon :color="activeTab === 'bases' ? undefined : 'gray'" />
                <div class="select-none">{{ $t('objects.projects') }}</div>
              </div>
            </NcMenuItem>

            <!-- Users & Access -->
            <NcMenuItem
              v-if="isUIAllowed('superAdminUserManagement')"
              key="users-list"
              :class="{ active: activeTab === 'users-list' }"
              class="item"
              @click="activeTab = 'users-list'"
            >
              <div class="flex items-center space-x-2">
                <GeneralIcon icon="ncUsers" class="!h-4 !w-4" />
                <div class="select-none">{{ $t('title.userManagement') }}</div>
              </div>
            </NcMenuItem>

            <NcMenuItem
              v-if="isUIAllowed('ssoSettings') && showEEFeatures"
              key="authentication"
              :class="{ active: activeTab === 'authentication' }"
              class="item"
              @click="blockSSO ? showUpgradeToUseSSO() : (activeTab = 'authentication')"
            >
              <div class="flex items-center space-x-2">
                <component :is="iconMap.ncLock" />
                <div class="select-none text-sm">{{ $t('title.sso') }}</div>
                <LazyPaymentUpgradeBadge
                  :feature="PlanFeatureTypes.FEATURE_SSO"
                  :feature-enabled-callback="() => !blockSSO"
                  remove-click
                />
              </div>
            </NcMenuItem>

            <NcMenuItem
              v-if="showEEFeatures"
              key="teams"
              :class="{ active: activeTab === 'teams' }"
              class="item"
              @click="blockTeamsManagement ? showUpgradeToUseTeams({}) : (activeTab = 'teams')"
            >
              <div class="flex items-center space-x-2">
                <GeneralIcon icon="ncBuilding" class="!h-4 !w-4" />
                <div class="select-none">{{ $t('title.teams') }}</div>
                <LazyPaymentUpgradeBadge
                  :feature="PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT"
                  :feature-enabled-callback="() => !blockTeamsManagement"
                  remove-click
                />
              </div>
            </NcMenuItem>

            <NcMenuItem
              v-if="showEEFeatures"
              key="scim"
              :class="{ active: activeTab === 'scim' }"
              class="item"
              @click="blockScim ? showUpgradeToUseScim() : (activeTab = 'scim')"
            >
              <div class="flex items-center space-x-2">
                <GeneralIcon icon="sync" class="!h-4 !w-4" />
                <div class="select-none">SCIM</div>
                <LazyPaymentUpgradeBadge
                  :feature="PlanFeatureTypes.FEATURE_SCIM"
                  :feature-enabled-callback="() => !blockScim"
                  remove-click
                />
              </div>
            </NcMenuItem>

            <NcMenuItem
              v-if="showEEFeatures"
              key="audit"
              :class="{ active: activeTab === 'audit' }"
              class="item"
              @click="isWsAuditEnabled ? (activeTab = 'audit') : undefined"
            >
              <div class="flex items-center space-x-2">
                <GeneralIcon class="!h-4 !w-4" icon="ncFileText" />
                <div class="select-none">{{ $t('title.audit') }}</div>
                <LazyPaymentUpgradeBadge
                  :feature="PlanFeatureTypes.FEATURE_AUDIT_WORKSPACE"
                  :feature-enabled-callback="() => isWsAuditEnabled"
                  remove-click
                />
              </div>
            </NcMenuItem>

            <!-- Configuration -->
            <NcMenuItem
              v-if="isSetupPageAllowed"
              key="setup"
              :class="{ active: activeTab === 'setup' }"
              class="item"
              @click="activeTab = 'setup'"
            >
              <div class="flex items-center space-x-2 w-full">
                <GeneralIcon icon="ncSliders" class="!h-4 !w-4" />
                <div class="select-none">{{ $t('labels.setup') }}</div>
                <span class="flex-grow" />
                <NcTooltip v-if="isPending">
                  <template #title>
                    <span>{{ $t('activity.pending') }}</span>
                  </template>
                  <GeneralIcon icon="ncAlertCircle" class="text-nc-content-orange-medium w-4 h-4 nc-pending" />
                </NcTooltip>
              </div>
            </NcMenuItem>

            <NcMenuItem
              v-if="showEEFeatures"
              key="external-integrations"
              :class="{ active: activeTab === 'external-integrations' }"
              class="item"
              @click="activeTab = 'external-integrations'"
            >
              <div class="flex items-center space-x-2">
                <GeneralIcon icon="ncIntegrationDuo" class="!h-4 !w-4" />
                <div class="select-none">{{ $t('title.externalIntegrations') }}</div>
              </div>
            </NcMenuItem>

            <NcMenuItem
              v-if="isUIAllowed('superAdminAppSettings')"
              key="settings"
              :class="{ active: activeTab === 'settings' }"
              class="item"
              @click="activeTab = 'settings'"
            >
              <div class="flex items-center space-x-2">
                <GeneralIcon icon="settings" class="!h-4 !w-4" />
                <div class="select-none">{{ $t('activity.settings') }}</div>
              </div>
            </NcMenuItem>

            <!-- System -->
            <NcMenuItem key="license" :class="{ active: activeTab === 'license' }" class="item" @click="activeTab = 'license'">
              <div class="flex items-center space-x-2">
                <GeneralIcon icon="ncKey2" class="h-4 w-4 flex-none" />
                <div class="select-none">{{ $t('title.license') }}</div>
              </div>
            </NcMenuItem>
          </NcMenu>
        </div>

        <!-- Content -->
        <div class="h-full flex-1 flex flex-col overflow-y-auto nc-scrollbar-thin">
          <div class="h-full flex flex-col w-full">
            <div class="h-full">
              <AdminInstanceDashboard v-if="activeTab === 'dashboard'" />
              <AdminInstanceWorkspaces v-else-if="activeTab === 'workspaces'" />
              <AdminInstanceBases v-else-if="activeTab === 'bases'" />
              <AccountSetup v-else-if="activeTab === 'setup'" />
              <template v-else-if="activeTab === 'setup-email' || activeTab === 'setup-storage'">
                <LazyAccountSetupConfig v-if="setupConfigAppId" :id="setupConfigAppId" />
                <LazyAccountSetupList v-else :category="activeTab === 'setup-email' ? 'Email' : 'Storage'" />
              </template>
              <AccountExternalIntegrations v-else-if="activeTab === 'external-integrations'" />
              <AccountAuthentication v-else-if="activeTab === 'authentication'" />
              <AdminTeams v-else-if="activeTab === 'teams'" :org-id="defaultOrgId" />
              <AdminScim v-else-if="activeTab === 'scim'" :org-id="defaultOrgId" />
              <AccountAudit v-else-if="activeTab === 'audit'" />
              <AccountLicense v-else-if="activeTab === 'license'" />
              <AccountUserList v-else-if="activeTab === 'users-list'" />
              <AccountSignupSettings v-else-if="activeTab === 'settings'" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </NuxtLayout>
</template>

<style lang="scss" scoped>
:deep(.nc-user-sidebar .ant-menu-sub.ant-menu-inline) {
  @apply bg-transparent;
}

:deep(.nc-user-sidebar .ant-menu-item-only-child),
:deep(.ant-menu-submenu-title) {
  @apply !h-[30px] !leading-[30px];
}

:deep(.ant-menu-submenu-arrow) {
  @apply !text-gray-400;
}

:deep(.ant-menu-submenu-selected .ant-menu-submenu-arrow) {
  @apply !text-inherit;
}

.tabs-menu {
  @apply bg-nc-bg-gray-sidebar;

  :deep(.item) {
    @apply select-none mx-2 !px-3 !text-sm !rounded-md !mb-1 text-nc-content-gray-subtle !hover:(bg-nc-bg-gray-medium text-nc-content-gray-subtle) font-medium;
    width: calc(100% - 1rem);
  }

  :deep(.active) {
    @apply !bg-nc-bg-brand !text-nc-content-brand !hover:(bg-nc-bg-brand text-nc-content-brand) font-semibold;
  }
}

:deep(.ant-menu-submenu-title) {
  @apply select-none mx-2 !px-3 !text-sm !rounded-md !mb-1 !hover:(bg-nc-bg-brand text-nc-content-brand);
  width: calc(100% - 1rem);
}

:deep(.ant-menu) {
  @apply !pt-0 !rounded-none !border-nc-border-gray-medium;
}

:deep(.nc-page-header) {
  @apply !h-[calc(var(--topbar-height)+1px)];
}
</style>
