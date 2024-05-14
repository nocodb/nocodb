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
    <div v-if="org" :key="org.title" class="mx-auto h-full">
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
              v-e="['c:navbar:home']"
              class="transition-all duration-200 px-2 mx-2 mt-1.5 cursor-pointer transform hover:bg-gray-100 my-1 nc-noco-brand-icon h-8 rounded-md min-w-60"
              data-testid="nc-noco-brand-icon"
              @click="navigateTo('/')"
            >
              <div class="flex flex-row gap-x-2 items-center h-8.5">
                <GeneralIcon class="-mt-0.1" icon="arrowLeft" />
                <div class="flex text-sm font-medium text-gray-800">{{ $t('labels.back') }}</div>
              </div>
            </div>
            <div class="text-sm ml-4 p-2 mt-3 flex justify-between gap-2">
              <div class="font-weight-bold">
                {{ org.title }}
              </div>
              <span class="text-gray-600 gray-600">{{ $t('labels.adminPanel') }}</span>
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
                <GeneralIcon class="!h-3.5 !w-3.5" icon="home" />

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
                <GeneralIcon class="!h-3.5 !w-3.5" icon="ncWorkspace" />

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
                <GeneralProjectIcon color="gray" />
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
                <GeneralIcon class="!h-3.5 !w-3.5" icon="user" />
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
                <GeneralIcon class="!h-3.5 !w-3.5" icon="lock" />
                <div class="select-none">{{ $t('labels.ssoSettings') }}</div>
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
                <GeneralIcon class="!h-3.5 !w-3.5" icon="settings" />

                <div class="select-none">{{ $t('labels.settings') }}</div>
              </div>
            </NcMenuItem>
          </NcMenu>
        </div>

        <!-- Sub Tabs -->

        <div class="flex flex-col w-full ml-65 pt-5">
          <div
            :style="{
              height: 'calc(100vh - 3.5rem)',
            }"
            class="flex flex-col container mx-auto"
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
