<script setup lang="ts">
const workspaceStore = useWorkspace()
const projectStore = useProject()

const { isLeftSidebarOpen } = storeToRefs(useSidebarStore())

const { isSharedBase } = storeToRefs(projectStore)
const { activeWorkspace, isWorkspaceLoading } = storeToRefs(workspaceStore)
</script>

<template>
  <div
    class="flex items-center px-2 nc-sidebar-header py-1.2 w-full border-b-1 border-gray-200 group"
    style="height: var(--topbar-height)"
  >
    <div v-if="!isWorkspaceLoading" class="flex flex-row items-center w-full">
      <div
        class="flex flex-row flex-grow hover:bg-gray-200 pl-2 pr-1 py-0.5 rounded-md w-full"
        style="max-width: calc(100% - 2.5rem)"
      >
        <a
          v-if="isSharedBase"
          class="w-[40px] min-w-[40px] transition-all duration-200 p-1 cursor-pointer transform hover:scale-105"
          href="https://github.com/nocodb/nocodb"
          target="_blank"
        >
          <img width="25" alt="NocoDB" src="~/assets/img/icons/256x256.png" />
        </a>

        <WorkspaceMenu v-if="!isSharedBase" :workspace="activeWorkspace" :is-open="true">
          <template #brandIcon>
            <GeneralWorkspaceIcon :workspace="activeWorkspace" />
          </template>
        </WorkspaceMenu>
      </div>
      <div class="flex flex-grow min-w-1"></div>

      <NcTooltip class="flex opacity-0 group-hover:opacity-100 transition-opacity duration-50" placement="bottom" hide-on-click>
        <template #title>
          {{
            isLeftSidebarOpen
              ? `${$t('general.hide')} ${$t('objects.sidebar').toLowerCase()}`
              : `${$t('general.show')} ${$t('objects.sidebar').toLowerCase()}`
          }}
        </template>
        <NcButton
          type="text"
          size="small"
          class="nc-sidebar-left-toggle-icon !text-gray-700 !hover:text-gray-800 !hover:bg-gray-200"
          @click="isLeftSidebarOpen = !isLeftSidebarOpen"
        >
          <div class="flex items-center text-inherit">
            <GeneralIcon
              icon="doubleLeftArrow"
              class="duration-150 transition-all !text-lg -mt-0.5"
              :class="{
                'transform rotate-180': !isLeftSidebarOpen,
              }"
            />
          </div>
        </NcButton>
      </NcTooltip>
    </div>
    <div v-else class="flex flex-row items-center w-full mt-2 ml-2.5 gap-x-3">
      <a-skeleton-input :active="true" class="!w-6 !h-6 !rounded overflow-hidden" />
      <a-skeleton-input :active="true" class="!w-40 !h-4 !rounded overflow-hidden" />
    </div>
  </div>
</template>
