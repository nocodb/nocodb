<script lang="ts" setup>
definePageMeta({
  hideHeader: true,
})

const { isUIAllowed } = useRoles()

const $route = useRoute()

const { appInfo, signedIn, signOut } = useGlobal()

const { isFeatureEnabled } = useBetaFeatureToggle()

const selectedKeys = computed(() => {
  if (/^\/account\/users\/?$/.test($route.fullPath)) {
    if (isUIAllowed('superAdminUserManagement')) return ['list']
    if (!appInfo.value.disableEmailAuth) return ['settings']
    return ['tokens']
  }
  return [$route.params.nestedPage ?? $route.params.page]
})

const isSetupPageAllowed = computed(() => isUIAllowed('superAdminSetup') && (!isEeUI || appInfo.value.isOnPrem))

const { emailConfigured, storageConfigured, loadSetupApps } = useProvideAccountSetupStore()

const openKeys = ref([/^\/account\/users/.test($route.fullPath) && 'users'])

const logout = async () => {
  await signOut({
    skipRedirect: false,
    redirectToSignin: true,
  })
}
</script>

<template>
  <div>
    <NuxtLayout name="empty">
      <div class="mx-auto h-full">
        <div class="h-full flex">
          <!-- Side tabs -->

          <div class="h-full bg-white nc-user-sidebar overflow-y-auto nc-scrollbar-thin min-w-[312px]">
            <NcMenu
              v-model:openKeys="openKeys"
              v-model:selectedKeys="selectedKeys"
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
                  class="transition-all duration-200 mx-2 cursor-pointer transform hover:bg-gray-100 nc-noco-brand-icon"
                  data-testid="nc-noco-brand-icon"
                  @click="navigateTo('/')"
                >
                  <div class="flex flex-row gap-x-2 items-center">
                    <GeneralIcon icon="ncArrowLeft" />
                    <div class="flex text-small leading-[18px] font-semibold">{{ $t('labels.back') }}</div>
                  </div>
                </NcButton>
              </div>
              <NcDivider class="!mt-0" />

              <div class="text-sm text-gray-500 font-semibold ml-4 py-1.5 mt-2">{{ $t('labels.account') }}</div>

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
                  <GeneralIcon icon="ncCode" class="h-4 w-4 flex-none" />

                  <div class="select-none">{{ $t('title.apiTokens') }}</div>
                </div>
              </NcMenuItem>              <NcMenuItem
                v-if="isSetupPageAllowed"
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
                  <GeneralIcon icon="ncAlertCircle" class="text-orange-500 w-4 h-4 nc-pending" />
                </NcTooltip>
              </div>
            </NcMenuItem>

              <NcMenuItem
                v-if="isUIAllowed('globalAudits')"
                key="audits"
                :class="{
                  active: $route.params.page === 'audits',
                }"
                class="item"
                @click="navigateTo('/account/audits')"
              >
                <div class="flex items-center space-x-2">
                  <component :is="iconMap.audit" />

                  <div class="select-none text-sm">{{ $t('title.audits') }}</div>
                </div>
              </NcMenuItem>
              <NcMenuItem
                v-if="isUIAllowed('ssoSettings')"
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
                </div>
              </NcMenuItem>

              <a-sub-menu
                v-if="!appInfo.disableEmailAuth || isUIAllowed('superAdminAppSettings')"
                key="users"
                class="!bg-white !my-0"
              >
                <template #icon>
                  <GeneralIcon icon="ncUsers" class="!h-4 !w-4" />
                </template>
                <template #title>{{ $t('objects.users') }}</template>

                <template #expandIcon="{ isOpen }">
                  <NcButton type="text" size="xxsmall" class="">
                    <GeneralIcon
                      icon="chevronRight"
                      class="flex-none cursor-pointer transform transition-transform duration-200 text-[20px]"
                      :class="{ '!rotate-90': isOpen }"
                    />
                  </NcButton>
                </template>

                <NcMenuItem
                  v-if="isUIAllowed('superAdminUserManagement') && (!isEeUI || appInfo.isOnPrem)"
                  key="list"
                  :class="{
                    active: $route.params.nestedPage === 'list',
                  }"
                  class="text-xs item"
                  @click="navigateTo('/account/users/list')"
                >
                  <span class="ml-4">{{ $t('title.userManagement') }}</span>
                </NcMenuItem>
                <NcMenuItem
                  key="password-reset"
                  :class="{
                    active: $route.params.nestedPage === 'password-reset',
                  }"
                  class="text-xs item"
                  @click="navigateTo('/account/users/password-reset')"
                >
                  <span class="ml-4">{{ $t('title.resetPasswordMenu') }}</span>
                </NcMenuItem>
                <NcMenuItem
                  v-if="isUIAllowed('superAdminAppSettings') && (!isEeUI || appInfo.isOnPrem)"
                  key="settings"
                  :class="{
                    active: $route.params.nestedPage === 'settings',
                  }"
                  class="text-xs item"
                  @click="navigateTo('/account/users/settings')"
                >
                  <span class="ml-4">{{ $t('activity.settings') }}</span>
                </NcMenuItem>
              </a-sub-menu>
            </NcMenu>
          </div>

          <!-- Sub Tabs -->
          <div class="h-full flex-1 flex flex-col overflow-y-auto nc-scrollbar-thin">
            <div class="flex flex-row pt-2 px-2 items-center">
              <div class="flex-1">
                <LazyAccountBreadcrumb />
              </div>

              <LazyGeneralReleaseInfo />

              <a-tooltip
                v-if="!appInfo.ee || isFeatureEnabled(FEATURE_FLAG.LANGUAGE) || appInfo.isOnPrem"
                :mouse-enter-delay="1"
                placement="bottom"
                class="mr-4"
              >
                <template #title> Switch language</template>

                <div class="flex items-center">
                  <LazyGeneralLanguage class="cursor-pointer text-2xl hover:text-gray-800" />
                </div>
              </a-tooltip>

              <template v-if="signedIn">
                <NcDropdown :trigger="['click']" overlay-class-name="nc-dropdown-user-accounts-menu">
                  <NcButton size="small" type="text">
                    <component
                      :is="iconMap.threeDotVertical"
                      class="md:text-lg cursor-pointer hover:text-gray-800 nc-menu-accounts"
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
  @apply !h-[30px] !leading-[30px];
}

:deep(.ant-menu-submenu-arrow) {
  @apply !text-gray-400;
}

:deep(.ant-menu-submenu-selected .ant-menu-submenu-arrow) {
  @apply !text-inherit;
}

.tabs-menu {
  :deep(.item) {
    @apply select-none mx-2 !px-3 !text-sm !rounded-md !mb-1 text-gray-700 !hover:(bg-gray-200 text-gray-700) font-medium;
    width: calc(100% - 1rem);
  }

  :deep(.active) {
    @apply !bg-brand-50 !text-brand-500 !hover:(bg-brand-50 text-brand-500) font-semibold;
  }
}

:deep(.ant-menu-submenu-title) {
  @apply select-none mx-2 !pl-3 !pr-1 !text-sm !rounded-md !mb-1 !hover:(bg-gray-200 text-gray-700);
  width: calc(100% - 1rem);

  & + ul {
    @apply !-mt-1;
  }
}

:deep(.ant-menu) {
  @apply !pt-0 !rounded-none !border-gray-200;
}

.nc-account-dropdown-item {
  @apply flex flex-row px-4 items-center py-2 gap-x-2 hover:bg-gray-100 cursor-pointer;
}
</style>
