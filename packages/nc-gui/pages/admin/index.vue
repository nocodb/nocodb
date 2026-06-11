<script lang="ts" setup>
import { OrgUserRoles } from 'nocodb-sdk'

definePageMeta({
  hideHeader: true,
})

const { orgRoles, isUIAllowed } = useRoles()

const { isEEFeatureBlocked } = useEeConfig()

const showLicenseTab = computed(() => isEeUI)

const isSuperAdmin = computed(() => !!orgRoles.value?.[OrgUserRoles.SUPER_ADMIN])

provide(IsAdminPanelInj, ref(true))

const route = useRoute()

type AdminTab =
  | 'dashboard'
  | 'workspaces'
  | 'bases'
  | 'setup'
  | 'external-integrations'
  | 'authentication'
  | 'license'
  | 'users-list'
  | 'settings'

const validTabs = computed<AdminTab[]>(() => {
  const tabs: AdminTab[] = [
    'dashboard',
    'workspaces',
    'bases',
    'setup',
    'external-integrations',
    'authentication',
    'users-list',
    'settings',
  ]

  if (showLicenseTab.value) {
    tabs.push('license')
  }

  return tabs
})

const router = useRouter()

const initialTab = validTabs.value.includes(route.query.tab as AdminTab) ? (route.query.tab as AdminTab) : 'dashboard'

const activeTab = ref<AdminTab>(initialTab)

watch(activeTab, (tab) => {
  router.replace({ query: { ...route.query, tab } })
})

const isSetupPageAllowed = computed(() => isUIAllowed('superAdminSetup'))

const { emailConfigured, storageConfigured, loadSetupApps } = useProvideAccountSetupStore()

watchEffect(() => {
  if (isSetupPageAllowed.value) {
    loadSetupApps()
  }
})

const isPending = computed(() => !emailConfigured.value || !storageConfigured.value)

const backRoute = computed(() => ncBackRoute().get())

// Guard: redirect if not super admin
watch(
  isSuperAdmin,
  () => {
    if (!isSuperAdmin.value) {
      navigateTo('/')
    }
  },
  { immediate: true },
)
</script>

<template>
  <NuxtLayout>
    <div v-if="isSuperAdmin" class="mx-auto h-full">
      <div class="h-full flex">
        <!-- Side tabs -->
        <div class="h-full bg-nc-bg-gray-sidebar nc-user-sidebar overflow-y-auto nc-scrollbar-thin min-w-[312px]">
          <NcMenu :selected-keys="[activeTab]" :inline-indent="16" class="tabs-menu h-full" mode="inline">
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
            <NcDivider class="!mt-0" />

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
              v-if="!isEEFeatureBlocked"
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
              v-if="isUIAllowed('ssoSettings') && !isEEFeatureBlocked"
              key="authentication"
              :class="{ active: activeTab === 'authentication' }"
              class="item"
              @click="activeTab = 'authentication'"
            >
              <div class="flex items-center space-x-2">
                <component :is="iconMap.ncLock" />
                <div class="select-none text-sm">{{ $t('title.sso') }}</div>
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
              v-if="!isEEFeatureBlocked"
              key="external-integrations"
              :class="{ active: activeTab === 'external-integrations' }"
              class="item"
              @click="activeTab = 'external-integrations'"
            >
              <div class="flex items-center space-x-2">
                <GeneralIcon icon="ncSliders" class="!h-4 !w-4" />
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
            <NcMenuItem
              v-if="showLicenseTab"
              key="license"
              :class="{ active: activeTab === 'license' }"
              class="item"
              @click="activeTab = 'license'"
            >
              <div class="flex items-center space-x-2">
                <GeneralIcon icon="ncKey2" class="h-4 w-4 flex-none" />
                <div class="select-none">{{ $t('title.license') }}</div>
              </div>
            </NcMenuItem>
          </NcMenu>
        </div>

        <!-- Content -->
        <div class="h-full flex-1 flex flex-col pt-2 overflow-y-auto nc-scrollbar-thin">
          <div class="h-full flex flex-col w-full">
            <div class="h-full">
              <AdminInstanceDashboard v-if="activeTab === 'dashboard'" />
              <AdminInstanceWorkspaces v-else-if="activeTab === 'workspaces'" />
              <AdminInstanceBases v-else-if="activeTab === 'bases'" />
              <AccountSetup v-else-if="activeTab === 'setup'" />
              <AccountExternalIntegrations v-else-if="activeTab === 'external-integrations'" />
              <AccountAuthentication v-else-if="activeTab === 'authentication'" />
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
</style>
