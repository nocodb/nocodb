<script lang="ts" setup>
import { iconMap, navigateTo, useRoles } from '#imports'

definePageMeta({
  hideHeader: true,
})

const { isUIAllowed } = useRoles()

const $route = useRoute()

const { appInfo, signedIn, signOut } = useGlobal()

const selectedKeys = computed(() => [
  /^\/account\/users\/?$/.test($route.fullPath)
    ? isUIAllowed('superAdminUserManagement')
      ? 'list'
      : 'settings'
    : $route.params.nestedPage ?? $route.params.page,
])

const openKeys = ref([/^\/account\/users/.test($route.fullPath) && 'users'])

const logout = async () => {
  await signOut(false)
  navigateTo('/signin')
}
</script>

<template>
  <NuxtLayout name="empty">
    <div class="mx-auto h-full">
      <div class="h-full overflow-y-auto flex">
        <!-- Side tabs -->

        <div class="h-full bg-white nc-user-sidebar fixed">
          <NcMenu
            v-model:openKeys="openKeys"
            v-model:selectedKeys="selectedKeys"
            :inline-indent="16"
            class="tabs-menu h-full"
            mode="inline"
          >
            <div
              v-if="!$route.params.baseType"
              v-e="['c:navbar:home']"
              data-testid="nc-noco-brand-icon"
              class="transition-all duration-200 px-2 mx-2 mt-1.5 cursor-pointer transform hover:bg-gray-100 my-1 nc-noco-brand-icon h-8 rounded-md min-w-60"
              @click="navigateTo('/')"
            >
              <div class="flex flex-row gap-x-2 items-center h-8.5">
                <GeneralIcon icon="arrowLeft" class="-mt-0.1" />
                <div class="flex text-sm font-medium text-gray-800">{{ $t('labels.backToWorkspace') }}</div>
              </div>
            </div>

            <div class="text-sm text-gray-600 ml-4 p-2 mt-3 gray-600 font-medium">{{ $t('labels.account') }}</div>

            <NcMenuItem
              key="profile"
              class="item"
              :class="{
                active: $route.params.page === 'profile',
              }"
              @click="navigateTo('/account/profile')"
            >
              <div class="flex items-center space-x-2">
                <GeneralIcon icon="account" />

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
                <component :is="iconMap.code" />

                <div class="select-none">API {{ $t('title.tokens') }}</div>
              </div>
            </NcMenuItem>
            <NcMenuItem
              v-if="isUIAllowed('superAdminAppStore') && !isEeUI"
              key="apps"
              class="item"
              :class="{
                active: $route.params.page === 'apps',
              }"
              @click="navigateTo('/account/apps')"
            >
              <div class="flex items-center space-x-2">
                <component :is="iconMap.appStore" />

                <div class="select-none text-sm">{{ $t('title.appStore') }}</div>
              </div>
            </NcMenuItem>
            <a-sub-menu key="users" class="!bg-white !my-0">
              <template #icon>
                <MdiAccountSupervisorOutline />
              </template>
              <template #title>{{ $t('objects.users') }}</template>

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

        <div class="flex flex-col w-full ml-65">
          <div class="flex flex-row p-3 items-center h-14">
            <div class="flex-1" />

            <LazyGeneralReleaseInfo />

            <a-tooltip v-if="!appInfo.ee" placement="bottom" :mouse-enter-delay="1">
              <template #title>{{ $t('title.switchLanguage') }}</template>

              <div class="flex pr-4 items-center">
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
                  <div class="!py-1 !rounded-md bg-white overflow-hidden">
                    <div class="!rounded-b group" data-testid="nc-menu-accounts__sign-out">
                      <div v-e="['a:navbar:user:sign-out']" class="nc-account-dropdown-item group" @click="logout">
                        <component :is="iconMap.signout" class="group-hover:text-accent" />&nbsp;

                        <span class="prose group-hover:text-primary">
                          {{ $t('general.signOut') }}
                        </span>
                      </div>
                    </div>
                  </div>
                </template>
              </NcDropdown>
            </template>
          </div>
          <div
            class="flex flex-col container mx-auto"
            :style="{
              height: 'calc(100vh - 3.5rem)',
            }"
          >
            <div class="mt-2 h-full">
              <NuxtPage />
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

:deep(.item) {
  @apply select-none mx-2 !px-3 !text-sm !rounded-md !mb-1 !hover:(bg-brand-50 text-brand-500);
  width: calc(100% - 1rem);
}

:deep(.active) {
  @apply !bg-brand-50 !text-brand-500;
}

:deep(.ant-menu-submenu-title) {
  @apply select-none mx-2 !px-3 !text-sm !rounded-md !mb-1 !hover:(bg-brand-50 text-brand-500);
  width: calc(100% - 1rem);
}

:deep(.ant-menu) {
  @apply !pt-0 !rounded-none !border-gray-200;
}

.nc-account-dropdown-item {
  @apply flex flex-row px-4 items-center py-2 gap-x-2 hover:bg-gray-100 cursor-pointer;
}
</style>
