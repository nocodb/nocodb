<script lang="ts" setup>
definePageMeta({
  hideHeader: true,
})

const { isUIAllowed } = useRoles()

const $route = useRoute()

const orgStore = useOrg()

const { org } = storeToRefs(orgStore)

const { loadOrg } = orgStore

provide(IsAdminPanelInj, ref(true))

const selectedKeys = computed(() => [
  /^\/admin\/users\/?$/.test($route.fullPath)
    ? isUIAllowed('superAdminUserManagement')
      ? 'list'
      : 'settings'
    : $route.params.nestedPage ?? $route.params.page,
])

const openKeys = ref([/^\/admin\/users/.test($route.fullPath) && 'users'])

onMounted(async () => {
  await loadOrg()
})
</script>

<template>
  <NuxtLayout>
    <div v-if="org" class="mx-auto h-full">
      <div class="h-full flex">
        <!-- Side tabs -->
        <div class="h-full bg-white nc-user-sidebar overflow-y-auto nc-scrollbar-thin min-w-[312px]">
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
                class="transition-all duration-200 mx-2 cursor-pointer transform nc-noco-brand-icon"
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

            <div :key="org.title" class="text-sm ml-2 p-2 mt-2 flex items-center justify-between gap-2">
              <div class="text-base font-bold text-nc-content-gray-emphasis">
                {{ org.title }}
              </div>
              <span class="text-nc-content-gray-muted">{{ $t('labels.adminPanel') }}</span>
            </div>

            <NcMenuItem
              key="dashboard"
              :class="{
                active:
                  $route.params.page === '' || (!$route.params.page && !$route.params?.workspaceId && !$route.params?.baseId),
              }"
              class="item"
              @click="navigateTo(`/admin/${$route.params.orgId}`)"
            >
              <div class="flex items-center space-x-2">
                <GeneralIcon class="!h-4 !w-4" icon="home1" />

                <div class="select-none">{{ $t('labels.dashboard') }}</div>
              </div>
            </NcMenuItem>
            <NcMenuItem
              key="workspaces"
              :class="{
                active: $route.params.page === 'workspaces' || $route.params?.workspaceId,
              }"
              class="item"
              @click="navigateTo(`/admin/${$route.params.orgId}/workspaces`)"
            >
              <div class="flex items-center space-x-2">
                <GeneralIcon
                  icon="ncWorkspace"
                  class="!h-4 !w-4"
                  :class="{
                    'fill-gray-200': !($route.params.page === 'workspaces' || $route.params?.workspaceId),
                    'fill-brand-200': $route.params.page === 'workspaces' || $route.params?.workspaceId,
                  }"
                />

                <div class="select-none">{{ $t('labels.workspaces') }}</div>
              </div>
            </NcMenuItem>

            <NcMenuItem
              key="bases"
              :class="{
                active: $route.params.page === 'bases' || $route.params?.baseId,
              }"
              class="item"
              @click="navigateTo(`/admin/${$route.params.orgId}/bases`)"
            >
              <div class="flex items-center space-x-2">
                <GeneralProjectIcon :color="$route.params.page === 'bases' || $route.params?.baseId ? undefined : 'gray'" />
                <div class="select-none">{{ $t('objects.projects') }}</div>
              </div>
            </NcMenuItem>
            <NcMenuItem
              key="members"
              :class="{
                active: $route.params.page === 'members',
              }"
              class="item"
              @click="navigateTo(`/admin/${$route.params.orgId}/members`)"
            >
              <div class="flex items-center space-x-2">
                <GeneralIcon class="!h-4 !w-4" icon="ncUsers" />
                <div class="select-none">{{ $t('labels.members') }}</div>
              </div>
            </NcMenuItem>

            <NcMenuItem
              key="sso"
              :class="{
                active: $route.params.page === 'sso',
              }"
              class="item"
              data-test-id="nc-org-sso-settings"
              @click="navigateTo(`/admin/${$route.params.orgId}/sso`)"
            >
              <div class="flex items-center space-x-2">
                <GeneralIcon class="!h-4 !w-4" icon="ncLock" />
                <div class="select-none">{{ $t('title.sso') }}</div>
              </div>
            </NcMenuItem>
            <NcMenuItem
              key="billing"
              :class="{
                active: $route.params.page === 'billing',
              }"
              class="item"
              data-test-id="nc-org-billing-settings"
              @click="navigateTo(`/admin/${$route.params.orgId}/billing`)"
            >
              <div class="flex items-center space-x-2">
                <GeneralIcon class="!h-4 !w-4" icon="ncDollarSign" />
                <div class="select-none">{{ $t('general.billing') }}</div>
              </div>
            </NcMenuItem>

            <NcMenuItem
              key="settings"
              :class="{
                active: $route.params.page === 'settings',
              }"
              class="item"
              @click="navigateTo(`/admin/${$route.params.orgId}/settings`)"
            >
              <div class="flex items-center space-x-2">
                <GeneralIcon class="h-4 w-4" icon="ncSettings" />

                <div class="select-none">{{ $t('labels.settings') }}</div>
              </div>
            </NcMenuItem>
          </NcMenu>
        </div>

        <!-- Sub Tabs -->
        <div class="h-full flex-1 flex flex-col pt-2 overflow-y-auto nc-scrollbar-thin">
          <div class="h-full flex flex-col w-full">
            <div class="h-full">
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
