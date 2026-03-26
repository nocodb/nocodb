<script lang="ts" setup>
import { WorkspaceUserRoles } from 'nocodb-sdk'

definePageMeta({
  hideHeader: true,
})

const $route = useRoute()

const { appInfo, signedIn, signOut } = useGlobal()

const { isUIAllowed } = useRoles()

const { isPaymentEnabled, isEEFeatureBlocked, showEEFeatures } = useEeConfig()

const workspaceStore = useWorkspace()

const { workspacesList } = storeToRefs(workspaceStore)
const { loadWorkspaces } = workspaceStore

const isSetupPageAllowed = computed(() => isUIAllowed('superAdminSetup') && (!isEeUI || !appInfo.value.isCloud))

const { emailConfigured, storageConfigured, loadSetupApps } = useProvideAccountSetupStore()

watchEffect(() => {
  if (isSetupPageAllowed.value) {
    loadSetupApps()
  }
})

const isPending = computed(() => !emailConfigured.value || !storageConfigured.value)

const filteredWorkspaces = computed(() => workspacesList.value.filter((w) => w.roles === WorkspaceUserRoles.OWNER))

const loadingWorkspaces = ref(false)

const backRoute = computed(() => ncBackRoute().get())

const selectedKeys = computed(() => [$route.params.nestedPage ?? $route.params.page])

const openKeys = ref([])

const logout = async () => {
  await signOut({
    skipRedirect: false,
    redirectToSignin: true,
  })
}

onMounted(() => {
  loadingWorkspaces.value = true
  loadWorkspaces().then(() => {
    loadingWorkspaces.value = false
  })
})
</script>

<template>
  <div>
    <NuxtLayout name="empty">
      <div class="mx-auto h-full">
        <div class="h-full flex">
          <!-- Side tabs -->

          <div class="h-full bg-nc-bg-gray-sidebar nc-user-sidebar overflow-y-auto nc-scrollbar-thin min-w-[312px]">
            <NcMenu
              v-model:open-keys="openKeys"
              v-model:selected-keys="selectedKeys"
              :inline-indent="16"
              class="tabs-menu h-full"
              mode="inline"
            >
              <div class="h-[var(--topbar-height)] flex items-center children:flex-none">
                <NcButton
                  v-if="!$route.params.baseType"
                  v-e="['c:navbar:home']"
                  type="text"
                  size="small"
                  class="transition-all duration-200 mx-2 cursor-pointer transform hover:bg-nc-bg-gray-light nc-noco-brand-icon"
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

              <div class="text-sm text-nc-content-gray-muted font-semibold ml-4 py-1.5 mt-2">{{ $t('labels.account') }}</div>

              <NcMenuItem
                key="profile"
                :class="{
                  active: $route.params.page === 'profile',
                }"
                class="item"
                @click="navigateTo('/account/profile')"
              >
                <div class="flex items-center space-x-2">
                  <GeneralIcon icon="ncUser" class="!h-4 !w-4" />

                  <div class="select-none">{{ $t('labels.profile') }}</div>
                </div>
              </NcMenuItem>

              <NcMenuItem
                key="tokens"
                :class="{
                  active: $route.params.page === 'tokens',
                }"
                class="item"
                @click="navigateTo('/account/tokens')"
              >
                <div class="flex items-center space-x-2">
                  <GeneralIcon icon="ncKey2" class="h-4 w-4 flex-none" />

                  <div class="select-none">{{ $t('title.apiTokens') }}</div>
                </div>
              </NcMenuItem>
              <NcMenuItem
                key="mcp"
                :class="{
                  active: $route.params.page === 'mcp',
                }"
                class="item"
                @click="navigateTo('/account/mcp')"
              >
                <div class="flex items-center space-x-2">
                  <GeneralIcon icon="mcp" class="h-4 w-4 flex-none" />

                  <div class="select-none">{{ $t('title.mcpServer') }}</div>
                </div>
              </NcMenuItem>
              <NcMenuItem
                key="external-integrations"
                :class="{
                  active: $route.params.page === 'external-integrations',
                }"
                class="item"
                @click="navigateTo('/account/external-integrations')"
              >
                <div class="flex items-center space-x-2">
                  <GeneralIcon icon="ncSliders" class="!h-4 !w-4" />

                  <div class="select-none">{{ $t('title.externalIntegrations') }}</div>
                </div>
              </NcMenuItem>
              <NcMenuItem
                v-if="isSetupPageAllowed && appInfo.isCloud"
                key="profile"
                class="item"
                :class="{
                  active: $route.path?.startsWith('/account/setup'),
                }"
                @click="navigateTo('/account/setup')"
              >
                <div class="flex items-center space-x-2 w-full">
                  <GeneralIcon icon="ncSliders" class="!h-4 !w-4" />

                  <div class="select-none">
                    {{ $t('labels.setup') }}
                  </div>
                  <span class="flex-grow" />
                  <NcTooltip v-if="isPending">
                    <template #title>
                      <span>
                        {{ $t('activity.pending') }}
                      </span>
                    </template>
                    <GeneralIcon icon="ncAlertCircle" class="text-nc-content-orange-medium w-4 h-4 nc-pending" />
                  </NcTooltip>
                </div>
              </NcMenuItem>

              <NcMenuItem
                v-if="isUIAllowed('ssoSettings') && !isEEFeatureBlocked"
                key="authentication"
                :class="{
                  active: $route.params.page === 'authentication',
                }"
                class="item"
                @click="navigateTo('/account/authentication')"
              >
                <div class="flex items-center space-x-2">
                  <component :is="iconMap.ncLock" />

                  <div class="select-none text-sm">{{ $t('title.sso') }}</div>
                  <LazyPaymentUpgradeBadge :feature-enabled-callback="() => !isEEFeatureBlocked" remove-click />
                </div>
              </NcMenuItem>

              <NcMenuItem
                v-if="appInfo.isCloud"
                v-e="['c:account:self-hosted']"
                key="self-hosted"
                :class="{
                  active: $route.params.page === 'self-hosted',
                }"
                class="item"
                @click="navigateTo('/account/self-hosted')"
              >
                <div class="flex items-center space-x-2">
                  <GeneralIcon icon="ncServer" class="!h-4 !w-4" />

                  <div class="select-none">{{ $t('title.selfHostedLicenses') }}</div>
                </div>
              </NcMenuItem>

              <NcMenuItem
                v-if="!appInfo.isCloud && !appInfo.disableEmailAuth"
                key="password-reset"
                :class="{
                  active: $route.params.nestedPage === 'password-reset',
                }"
                class="item"
                @click="navigateTo('/account/users/password-reset')"
              >
                <div class="flex items-center space-x-2">
                  <GeneralIcon icon="ncLock" class="!h-4 !w-4" />
                  <div class="select-none">{{ $t('title.resetPasswordMenu') }}</div>
                </div>
              </NcMenuItem>

              <NcDivider class="!mt-0" />

              <template v-if="isPaymentEnabled && showEEFeatures">
                <div class="text-sm text-nc-content-gray-muted font-semibold ml-4 py-1.5">{{ $t('labels.workspaces') }}</div>

                <template v-if="loadingWorkspaces">
                  <div class="w-full flex items-center justify-center">
                    <GeneralLoader :size="20" />
                  </div>
                </template>
                <template v-else>
                  <NcMenuItem
                    v-for="workspace in filteredWorkspaces"
                    :key="workspace.id"
                    class="item"
                    :class="{
                      active:
                        $route.params.workspaceId === workspace.id &&
                        $route.name === 'account-index-workspace-workspaceId-settings',
                    }"
                    @click="navigateTo(`/account/workspace/${workspace.id}/settings`)"
                  >
                    <div class="flex items-center space-x-2">
                      <GeneralWorkspaceIcon :workspace="workspace" size="account-sidebar" />

                      <div class="nc-workspace-title truncate capitalize">
                        {{ workspace.title }}
                      </div>
                    </div>
                  </NcMenuItem>
                </template>
              </template>
            </NcMenu>
          </div>

          <!-- Sub Tabs -->
          <div class="h-full flex-1 flex flex-col overflow-y-auto nc-scrollbar-thin">
            <div class="flex flex-row pt-2 px-2 items-center">
              <div class="flex-1">
                <LazyAccountBreadcrumb />
              </div>

              <LazyGeneralReleaseInfo />

              <NcTooltip placement="bottom" class="mr-4">
                <template #title> {{ $t('labels.community.communityTranslated') }}</template>

                <div class="flex items-center">
                  <LazyGeneralLanguage button class="cursor-pointer text-2xl hover:text-nc-content-gray" />
                </div>
              </NcTooltip>

              <template v-if="signedIn">
                <NcDropdown :trigger="['click']" overlay-class-name="nc-dropdown-user-accounts-menu">
                  <NcButton size="small" type="text">
                    <component
                      :is="iconMap.threeDotVertical"
                      class="md:text-lg cursor-pointer hover:text-nc-content-gray nc-menu-accounts"
                      data-testid="nc-menu-accounts"
                      @click.prevent
                    />
                  </NcButton>

                  <template #overlay>
                    <NcMenu variant="medium">
                      <NcMenuItem data-testid="nc-menu-accounts__sign-out" class="group" @click="logout">
                        <component :is="iconMap.signout" class="group-hover:text-accent" />
                        <span class="group-hover:text-primary">
                          {{ $t('general.signOut') }}
                        </span>
                      </NcMenuItem>
                    </NcMenu>
                  </template>
                </NcDropdown>
              </template>
            </div>
            <div
              :style="{
                height: 'calc(100vh - 3.5rem)',
              }"
              class="flex flex-col w-full"
            >
              <div class="h-full">
                <NuxtPage />
              </div>
            </div>
          </div>
        </div>
      </div>
    </NuxtLayout>
  </div>
</template>

<style lang="scss" scoped>
:deep(.nc-user-sidebar .ant-menu-sub.ant-menu-inline) {
  @apply bg-transparent;
}

:deep(.nc-user-sidebar .ant-menu-item-only-child),
:deep(.ant-menu-submenu-title) {
  @apply !h-[28px] !leading-[28px];
}

:deep(.ant-menu-submenu-arrow) {
  @apply !text-nc-content-gray-disabled;
}

:deep(.ant-menu-submenu-selected .ant-menu-submenu-arrow) {
  @apply !text-inherit;
}

.tabs-menu {
  @apply bg-nc-bg-gray-sidebar;

  :deep(.item) {
    @apply select-none mx-2 !px-3 !text-bodyDefaultSm font-medium !rounded-md !mb-0.5 text-nc-content-gray-subtle !hover:(bg-nc-bg-gray-medium text-nc-content-gray-subtle) font-medium;
    width: calc(100% - 1rem);
  }

  :deep(.nc-menu-item-inner),
  :deep(.nc-submenu-title) {
    @apply !text-bodyDefaultSm font-medium;
  }
}

:deep(.ant-menu-submenu-title) {
  @apply select-none mx-2 !pl-3 !pr-1 !text-bodyDefaultSm !rounded-md !mb-0.5 !hover:(bg-nc-bg-gray-medium text-nc-content-gray-subtle);
  width: calc(100% - 1rem);

  & + ul {
    @apply !-mt-1;
  }
}

:deep(.ant-menu) {
  @apply !pt-0 !rounded-none !border-nc-border-gray-medium;
}

.nc-account-dropdown-item {
  @apply flex flex-row px-4 items-center py-2 gap-x-2 hover:bg-nc-bg-gray-light cursor-pointer;
}
</style>

<style lang="scss">
.nc-user-sidebar {
  .tabs-menu .active {
    @apply !bg-nc-bg-brand !text-nc-content-brand-disabled !hover:(bg-nc-bg-brand text-nc-content-brand-disabled) dark:(!bg-nc-bg-gray-medium !hover:bg-nc-bg-gray-medium) font-semibold;
  }
}
</style>
