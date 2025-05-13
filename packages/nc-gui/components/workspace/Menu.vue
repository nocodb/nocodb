<script lang="ts" setup>
const isMiniSidebar = inject(IsMiniSidebarInj, undefined)

const { appInfo } = useGlobal()
</script>

<template>
  <div v-if="isMiniSidebar" data-testid="nc-workspace-menu" class="nc-workspace-menu nc-mini-sidebar-ws-item">
    <a href="https://github.com/nocodb/nocodb" target="_blank" rel="noopener noreferrer">
      <NcTooltip :disabled="!appInfo?.version || isEeUI" placement="right" close-on-click>
        <template #title>{{ appInfo?.version }}</template>

        <GeneralWorkspaceIcon
          :workspace="{
            id: 'nc',
            meta: {},
          }"
          icon-bg-color="#F4F4F5"
          show-nocodb-icon
          class="flex-none border-1 border-nc-border-gray-medium"
          size="mini-sidebar"
        />
      </NcTooltip>
    </a>
  </div>
  <div v-else class="flex flex-row flex-grow pl-0.5 pr-1 py-0.5 rounded-md w-full" style="max-width: calc(100% - 2.5rem)">
    <div class="flex-grow min-w-20">
      <div
        data-testid="nc-workspace-menu"
        class="flex items-center nc-workspace-menu overflow-hidden py-1.25 pr-0.25 justify-center w-full ml-2"
      >
        <a
          class="transition-all duration-200 transform w-24 min-w-10"
          href="https://github.com/nocodb/nocodb"
          target="_blank"
          rel="noopener noreferrer"
        >
          <NcTooltip :disabled="!appInfo?.version || isEeUI">
            <template #title>{{ appInfo?.version }}</template>
            <img alt="NocoDB" src="~/assets/img/brand/nocodb.png" />
          </NcTooltip>
        </a>
        <div class="flex flex-grow"></div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.nc-workspace-menu-item {
  @apply flex items-center pl-2 py-2 gap-2 text-sm hover:text-black;
}
</style>
