<script lang="ts" setup>
import { useTitle } from '@vueuse/core'
import { useGlobal, useI18n, useRoute } from '#imports'

const route = useRoute()

useShare()

const { te, t } = useI18n()

// todo: fix this
// const { hasSidebar, isOpen } = useSidebar('nc-left-sidebar')
const hasSidebar = ref(true)
const isOpen = ref(true)

const { signOut, user } = useGlobal()
const { clearWorkspaces } = useWorkspace()

const email = computed(() => user.value?.email ?? '---')

const refreshSidebar = ref(false)

useTitle(route.meta?.title && te(route.meta.title) ? `${t(route.meta.title)}` : 'NocoDB')

const isPublic = computed(() => route.meta?.public)

watch(hasSidebar, (val) => {
  if (!val) {
    refreshSidebar.value = true
    nextTick(() => {
      refreshSidebar.value = false
    })
  }
})

const logout = async () => {
  await signOut(false)
  await navigateTo('/signin')
  await clearWorkspaces()
}
</script>

<script lang="ts">
export default {
  name: 'DefaultLayout',
}
</script>

<template>
  <a-layout>
    <a-layout-header class="max-h-[var(--new-header-height)] !px-2">
      <div class="flex w-full h-full items-center nc-header-content">
        <div class="flex-1 min-w-0 w-50">
          <nuxt-link :to="isPublic ? '' : '/'">
            <img src="~/assets/img/brand/nocodb-full.png" class="h-11" />
          </nuxt-link>
        </div>

        <div v-if="$route.name === 'index-index'" class="flex gap-1">
          <!-- <a-button class="!text-inherit" data-testid="nc-dash-nav-workspaces"> Projects</a-button -->
          <!-- <a-button ghost class="!text-inherit" data-testid="nc-dash-nav-explore"> Template</a-button>
          <a-button ghost class="!text-inherit" data-testid="nc-dash-nav-help"> Help</a-button> -->
        </div>
        <div class="flex-1 min-w-0 flex justify-end gap-2">
          <div class="flex flex-row flex-grow">
            <slot name="navbar" />
          </div>
          <!-- <div v-if="isHomeScreen" class="nc-quick-action-wrapper" data-testid="nc-quick-action-wrapper">
            <MaterialSymbolsSearch class="nc-quick-action-icon" />
            <input class="" placeholder="Quick Actions" />

            <span class="nc-quick-action-shortcut">⌘ K</span>
          </div> -->

          <div v-if="!isPublic" class="flex items-center">
            <NotificationMenu class="mr-2" data-testid="nc-notification-bell-icon" />
          </div>

          <a-dropdown v-if="!isPublic" :trigger="['click']" overlay-class-name="nc-dropdown-user-accounts-menu">
            <div class="flex items-center gap-1 cursor-pointer" data-testid="nc-ws-account-menu-dropdown">
              <div
                class="h-8.5 w-8.5 rounded-full text-xs bg-secondary flex items-center justify-center font-weight-bold text-black uppercase"
              >
                {{ email ? email.split('@')[0].slice(0, 2) : 'A' }}
              </div>
              <MaterialSymbolsKeyboardArrowDownRounded />
            </div>

            <template #overlay>
              <a-menu class="!py-0 leading-8 !rounded min-w-40">
                <a-menu-item key="0" data-testid="nc-menu-accounts__user-settings" class="!rounded-t">
                  <nuxt-link v-e="['c:navbar:user:email']" class="nc-base-menu-item group !no-underline" to="/account/users">
                    <MdiAccountCircleOutline class="mt-1 group-hover:text-accent" />&nbsp;
                    <div class="prose group-hover:text-primary">
                      <div>{{ $t('labels.account') }}</div>
                      <div class="text-xs text-gray-500">{{ email }}</div>
                    </div>
                  </nuxt-link>
                </a-menu-item>

                <a-menu-divider class="!m-0" />
                <!-- <a-menu-item v-if="isUIAllowed('superAdminAppStore')" key="0" class="!rounded-t">
                  <nuxt-link
                    v-e="['c:settings:appstore', { page: true }]"
                    class="nc-base-menu-item group !no-underline"
                    to="/admin/users"
                  >
                    <MdiShieldAccountOutline class="mt-1 group-hover:text-accent" />&nbsp;
                    <span class="prose group-hover:text-primary">{{ $t('title.accountManagement') }}</span>
                  </nuxt-link>
                </a-menu-item> -->

                <a-menu-divider class="!m-0" />

                <a-menu-item key="1" class="!rounded-b group" data-testid="nc-menu-accounts__sign-out">
                  <div
                    v-e="['a:navbar:user:sign-out']"
                    class="nc-base-menu-item group"
                    data-testid="nc-logout-btn"
                    @click="logout"
                  >
                    <MdiLogout class="group-hover:text-accent" />&nbsp;

                    <span class="prose group-hover:text-primary">
                      {{ $t('general.signOut') }}
                    </span>
                  </div>
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </div>
      </div>
    </a-layout-header>
    <!--    todo: change class name -->
    <a-layout class="nc-root">
      <a-layout-sider
        v-if="hasSidebar"
        ref="sidebar"
        :collapsed="!isOpen"
        width="250"
        collapsed-width="50"
        class="relative shadow-md h-full z-1 nc-left-sidebar h-[calc(100vh_-_var(--new-header-height))] !shadow-none border-gray-100 border-r-1 !overflow-x-hidden"
        :trigger="null"
        collapsible
        theme="light"
      >
        <slot name="sidebar" />
      </a-layout-sider>
      <div class="w-full h-[calc(100vh_-_var(--new-header-height))]">
        <slot></slot>
      </div>
    </a-layout>
  </a-layout>
</template>

<style scoped lang="scss">
.nc-workspace-avatar {
  @apply min-w-6 h-6 rounded-[6px] flex items-center justify-center text-white font-weight-bold uppercase;
  font-size: 0.7rem;
}

.nc-workspace-list {
  .nc-workspace-list-item {
    @apply flex gap-2 items-center;
  }

  :deep(.ant-menu-item) {
    @apply relative;

    & .color-band {
      @apply opacity-0 absolute w-2 h-7 -left-1 top-[6px] bg-[#4351E8] rounded-[99px] trasition-opacity;
    }
  }

  :deep(.ant-menu-item-selected, .ant-menu-item-active) .color-band {
    @apply opacity-100;
  }

  .nc-workspace-menu {
    @apply opacity-0 transition-opactity;
  }

  :deep(.ant-menu-item:hover) .nc-workspace-menu {
    @apply opacity-100;
  }
}

:deep(.nc-workspace-list .ant-menu-item) {
  @apply !my-0;
}

.nc-workspace-group {
  .nc-workspace-group-item {
    &:hover {
      @apply bg-primary bg-opacity-3 text-primary;
    }

    &.active {
      @apply bg-primary bg-opacity-8 text-primary;
    }

    @apply h-[40px] px-4 flex items-center gap-2 cursor-pointer;

    .nc-icon {
      @apply w-6;
    }
  }
}

// todo:  apply globally at windicss level
.nc-root {
  @apply text-[#4B5563];
}

.nc-collab-list {
  .nc-collab-list-item {
    @apply flex gap-2 py-2 px-4 items-center;

    .nc-collab-avatar {
      @apply w-6 h-6 rounded-full flex items-center justify-center text-white font-weight-bold uppercase;
      font-size: 0.7rem;
    }
  }
}

:deep(.ant-tabs-nav-list) {
  @apply ml-6;
}

.ant-layout-header {
  @apply !h-20 bg-transparent;
  border-bottom: 1px solid #f5f5f5;
}

.nc-quick-action-wrapper {
  @apply relative;

  input {
    @apply h-10 w-60 bg-gray-100 rounded-md pl-9 pr-5 mr-2;
  }

  .nc-quick-action-icon {
    @apply absolute left-2 top-6;
  }

  .nc-quick-action-shortcut {
    @apply text-gray-400 absolute right-4 top-0;
  }
}

:deep(.ant-tabs-tab:not(ant-tabs-tab-active)) {
  @apply !text-gray-500;
}

:deep(.ant-tabs-content) {
  @apply !min-h-25 !h-full;
}
</style>
