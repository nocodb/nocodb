<script setup lang="ts">
import type { TabItem } from '~/lib'
import { TabType } from '~/lib'
import { TabMetaInj, iconMap, provide, useGlobal, useSidebar, useTabs } from '#imports'

const { tabs, activeTabIndex, activeTab, closeTab } = useTabs()

const { isLoading } = useGlobal()

provide(TabMetaInj, activeTab)

const icon = (tab: TabItem) => {
  switch (tab.type) {
    case TabType.TABLE:
      return iconMap['mdi-table-large']
    case TabType.VIEW:
      return iconMap['mdi-eye-circle-outline']
    case TabType.AUTH:
      return iconMap['mdi-account-group']
  }
}

const { isOpen, toggle } = useSidebar('nc-left-sidebar')

function onEdit(targetKey: number, action: 'add' | 'remove' | string) {
  if (action === 'remove') closeTab(targetKey)
}
</script>

<template>
  <div class="h-full w-full nc-container">
    <div class="h-full w-full flex flex-col">
      <div class="flex items-end !min-h-[var(--header-height)] !bg-primary nc-tab-bar">
        <div
          v-if="!isOpen"
          class="nc-sidebar-left-toggle-icon hover:after:(bg-primary bg-opacity-75) group nc-sidebar-add-row py-2 px-3"
        >
          <MdiMenu
            v-e="['c:grid:toggle-navdraw']"
            class="cursor-pointer transform transition-transform duration-500 text-white"
            :class="{ 'rotate-180': !isOpen }"
            @click="toggle(!isOpen)"
          />
        </div>

        <a-tabs v-model:activeKey="activeTabIndex" class="nc-root-tabs" type="editable-card" @edit="onEdit">
          <a-tab-pane v-for="(tab, i) of tabs" :key="i">
            <template #tab>
              <div class="flex items-center gap-2 max-w-[110px]">
                <div class="flex items-center">
                  <component :is="icon(tab)" class="text-sm" />
                </div>

                <a-tooltip v-if="tab.title?.length > 12" placement="bottom">
                  <div class="truncate">{{ tab.title }}</div>

                  <template #title>
                    <div>{{ tab.title }}</div>
                  </template>
                </a-tooltip>

                <div v-else>{{ tab.title }}</div>
              </div>
            </template>
          </a-tab-pane>
        </a-tabs>

        <span class="flex-1" />

        <div class="flex justify-center self-center mr-2 min-w-[115px]">
          <div v-show="isLoading" class="flex items-center gap-2 ml-3 text-gray-200">
            {{ $t('general.loading') }}

            <MdiLoading class="animate-infinite animate-spin" />
          </div>
        </div>

        <LazyGeneralFullScreen class="nc-fullscreen-icon" />
      </div>

      <div class="w-full min-h-[300px] flex-auto">
        <NuxtPage :page-key="$route.params.type" />
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

    .ant-tabs-nav-add {
      @apply !hidden;
    }

    .ant-tabs-nav-more {
      @apply text-white;
    }

    & > .ant-tabs-nav-wrap > .ant-tabs-nav-list {
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

:deep(.ant-menu-item-selected) {
  @apply text-inherit !bg-inherit;
}

:deep(.ant-menu-horizontal),
:deep(.ant-menu-item::after),
:deep(.ant-menu-submenu::after) {
  @apply !border-none;
}

:deep(.ant-tabs-tab-remove) {
  @apply mt-[3px];
}
</style>
