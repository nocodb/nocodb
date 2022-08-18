<script setup lang="ts">
import type { TabItem } from '~/composables'
import { TabMetaInj, provide, useSidebar, useTabs } from '#imports'
import { TabType, useGlobal } from '~/composables'
import MdiAirTableIcon from '~icons/mdi/table-large'
import MdiView from '~icons/mdi/eye-circle-outline'
import MdiAccountGroup from '~icons/mdi/account-group'

const { tabs, activeTabIndex, activeTab, closeTab } = useTabs()

const { isLoading } = useGlobal()

provide(TabMetaInj, activeTab)

const icon = (tab: TabItem) => {
  switch (tab.type) {
    case TabType.TABLE:
      return MdiAirTableIcon
    case TabType.VIEW:
      return MdiView
    case TabType.AUTH:
      return MdiAccountGroup
  }
}

const { isOpen, toggle } = useSidebar()
</script>

<template>
  <div class="h-full w-full nc-container">
    <div class="h-full w-full flex flex-col">
      <div class="flex items-end !min-h-[50px] bg-primary/100">
        <div v-if="!isOpen" class="nc-sidebar-left-toggle-icon hover:after:bg-primary/75 group nc-sidebar-add-row py-2 px-3">
          <MdiMenu
            class="cursor-pointer transform transition-transform duration-500 text-white"
            :class="{ 'rotate-180': !isOpen }"
            @click="toggle(!isOpen)"
          />
        </div>

        <a-tabs v-model:activeKey="activeTabIndex" class="nc-root-tabs" type="editable-card" @edit="closeTab(activeTabIndex)">
          <a-tab-pane v-for="(tab, i) in tabs" :key="i">
            <template #tab>
              <div class="flex align-center gap-2">
                <component :is="icon(tab)" class="text-sm" />

                {{ tab.title }}
              </div>
            </template>
          </a-tab-pane>
        </a-tabs>
        <span class="flex-1" />
        <div class="flex justify-center align-self-center mr-2">
          <div v-show="isLoading" class="flex items-center gap-2 ml-3 text-white">
            {{ $t('general.loading') }}

            <MdiReload :class="{ 'animate-infinite animate-spin': isLoading }" />
          </div>
        </div>
      </div>

      <div class="w-full min-h-[300px] flex-auto">
        <NuxtPage />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.nc-container {
  height: 100vh;
  flex: 1 1 100%;
}

:deep(.nc-root-tabs) {
  & > .ant-tabs-nav {
    @apply !mb-0 before:(!border-b-0);
    .ant-tabs-extra-content {
      @apply !bg-white/0;
    }

    & > .ant-tabs-nav-wrap > .ant-tabs-nav-list {
      .ant-tabs-nav-add {
        @apply !hidden;
      }

      & > .ant-tabs-tab-active {
        @apply font-weight-medium;
      }

      & > .ant-tabs-tab {
        @apply border-0;
      }

      & > .ant-tabs-tab:not(.ant-tabs-tab-active) {
        //@apply bg-gray-100 text-gray-500;
        @apply bg-white/10 text-white/90;
        .ant-tabs-tab-remove {
          @apply !text-white;
        }
      }
    }
  }
}

.nc-add-project-menu {
  :deep(.ant-dropdown-menu-item-group-list) {
    @apply !mx-0;
  }

  :deep(.ant-dropdown-menu-item-group-title) {
    @apply border-b-1;
  }

  :deep(.ant-dropdown-menu-item-group-list) {
    @apply m-0;
  }

  :deep(.ant-dropdown-menu-item) {
    @apply !py-0 active:(ring ring-pink-500);
  }
}

:deep(.ant-menu-item-selected) {
  @apply text-inherit !bg-inherit;
}

:deep(.ant-menu-horizontal),
:deep(.ant-menu-item::after),
:deep(.ant-menu-submenu::after) {
  @apply !border-none;
}
</style>
