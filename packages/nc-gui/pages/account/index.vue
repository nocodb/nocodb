<script lang="ts" setup>
definePageMeta({
  hideHeader: true,
})

const { isUIAllowed } = useRoles()

const $route = useRoute()

const { appInfo, signedIn, signOut } = useGlobal()

const { isFeatureEnabled } = useBetaFeatureToggle()

const selectedKeys = computed(() => [
  /^\/account\/users\/?$/.test($route.fullPath)
    ? isUIAllowed('superAdminUserManagement')
      ? 'list'
      : 'settings'
    : $route.params.nestedPage ?? $route.params.page,
])

const openKeys = ref([/^\/account\/users/.test($route.fullPath) && 'users'])

const logout = async () => {
  await signOut({
    redirectToSignin: true,
  })
}

const isSetupPageAllowed = computed(() => isUIAllowed('superAdminSetup') && (!isEeUI || appInfo.value.isOnPrem))

const { emailConfigured, storageConfigured, loadSetupApps } = useProvideAccountSetupStore()

watchEffect(() => {
  if (isSetupPageAllowed.value) {
    loadSetupApps()
  }
})

const isPending = computed(() => !emailConfigured.value || !storageConfigured.value)
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

              <div class="text-sm text-nc-content-gray-muted font-semibold ml-4 py-1.5 mt-2">{{ $t('labels.account') }}</div>
              <NcMenuItem
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
                key="profile"
                class="item"
                :class="{
                  active: $route.params.page === 'profile',
                }"
                @click="navigateTo('/account/profile')"
              >
                <div class="flex items-center space-x-2">
                  <GeneralIcon icon="ncUser" class="!h-4 !w-4" />

                  <div class="select-none">{{ $t('labels.profile') }}</div>
                </div>
              </NcMenuItem>
              <NcMenuItem
                key="tokens"
                class="item"
                :class="{
                  active: $route.params.page === 'tokens',
                }"
                @click="navigateTo('/account/tokens')"
              >
                <div class="flex items-center space-x-2">
                  <MdiShieldKeyOutline />

                  <div class="select-none">{{ $t('title.tokens') }}</div>
                </div>
              </NcMenuItem>
              <NcMenuItem
                v-if="isUIAllowed('superAdminAppStore') && !isEeUI"
                key="apps"
                class="item w-full"
                :class="{
                  active: $route.params.page === 'apps',
                }"
                @click="navigateTo('/account/apps')"
              >
                <div class="flex items-center gap-2 w-full">
                  <component :is="iconMap.appStore" />

                  <div class="select-none text-sm">{{ $t('title.appStore') }}</div>
                  <span class="flex-grow" />
                  <NcToolti>
                    <template #title>
                      <span>
                        App store will soon be removed. Email & Storage plugins are now available in Accounts/Setup page. Rest of
                        the plugins here will be moved to integrations.
                      </span>
                    </template>
                    <GeneralIcon icon="ncAlertCircle" class="text-orange-500 w-4 h-4 nc-pending" />
                  </NcToolti>
                </div>
              </NcMenuItem>
              <a-sub-menu key="users" class="!bg-white !my-0">
                <template #icon>
                  <GeneralIcon icon="ncUsers" class="!h- !w-4" />
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
                  v-if="isUIAllowed('superAdminUserManagement') && !isEeUI"
                  key="list"
                  class="text-xs item"
                  :class="{
                    active: $route.params.nestedPage === 'list',
                  }"
                  @click="navigateTo('/account/users/list')"
                >
                  <span class="ml-4">{{ $t('title.userManagement') }}</span>
                </NcMenuItem>
                <NcMenuItem
                  key="password-reset"
                  class="text-xs item"
                  :class="{
                    active: $route.params.nestedPage === 'password-reset',
                  }"
                  @click="navigateTo('/account/users/password-reset')"
                >
                  <span class="ml-4">{{ $t('title.resetPasswordMenu') }}</span>
                </NcMenuItem>
                <NcMenuItem
                  v-if="isUIAllowed('superAdminAppSettings') && !isEeUI"
                  key="settings"
                  class="text-xs item"
                  :class="{
                    active: $route.params.nestedPage === 'settings',
                  }"
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
                placement="bottom"
                :mouse-enter-delay="1"
                class="mr-4"
              >
                <template #title>{{ $t('title.switchLanguage') }}</template>

                <div class="flex items-center">
                  <LazyGeneralLanguage class="cursor-pointer text-2xl hover:text-gray-800" />
                </div>
              </a-tooltip>

              <template v-if="signedIn">
                <NcDropdown :trigger="['click']" overlay-class-name="nc-dropdown-user-accounts-menu">
                  <NcButton type="text" size="small">
                    <component
                      :is="iconMap.threeDotVertical"
                      data-testid="nc-menu-accounts"
                      class="md:text-lg cursor-pointer hover:text-gray-800 nc-menu-accounts"
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
              class="flex flex-col w-full"
              :style="{
                height: 'calc(100vh - 3.5rem)',
              }"
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
    @apply select-none mx-2 !px-3 !text-sm !rounded-md !mb-1 text-nc-content-gray-subtle !hover:(bg-nc-bg-gray-medium text-nc-content-gray-subtle) font-medium;
    width: calc(100% - 1rem);
  }

  :deep(.active) {
    @apply !bg-nc-bg-brand !text-nc-content-brand-disabled !hover:(bg-nc-bg-brand text-nc-content-brand-disabled ) font-semibold;
  }
}

:deep(.ant-menu-submenu-title) {
  @apply select-none mx-2 !pl-3 !pr-1 !text-sm !rounded-md !mb-1 !hover:(bg-nc-bg-gray-medium text-nc-content-gray-subtle);
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
