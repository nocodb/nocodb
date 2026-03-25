<script lang="ts" setup>
const workspaceStore = useWorkspace()

const { activeWorkspace } = storeToRefs(workspaceStore)

const { isMobileMode } = useGlobal()

const { activePlanTitle, isPaymentEnabled, handleUpgradePlan } = useEeConfig()

const { setActiveCmdView } = useCommand()

const isFreePlan = computed(() => activePlanTitle.value === 'Free')

const openSearch = () => {
  setActiveCmdView('cmd-k')
}

const showUpgrade = () => {
  handleUpgradePlan({})
}
</script>

<template>
  <div
    class="grid grid-cols-[1fr_auto] lg:grid-cols-3 items-center px-3 h-[var(--topbar-height)] flex-none border-b-1 border-nc-border-gray-medium"
  >
    <!-- Left -->
    <div class="flex items-center gap-2 min-w-0">
      <GeneralOpenLeftSidebarBtn />
      <h1 class="text-bodyLgBold text-nc-content-gray capitalize truncate mb-0" data-testid="nc-ws-home-topbar-title">
        {{ activeWorkspace?.title }}
      </h1>
      <div
        v-if="isEeUI"
        class="hidden md:flex items-center justify-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium leading-none bg-nc-bg-gray-light text-nc-content-gray-subtle flex-shrink-0"
      >
        <span class="uppercase">{{ activePlanTitle }} {{ $t('general.plan') }}</span>
        <template v-if="isFreePlan && isPaymentEnabled">
          <span class="text-nc-content-gray-muted">&middot;</span>
          <span class="text-primary cursor-pointer hover:underline" @click="showUpgrade">{{ $t('general.upgrade') }}</span>
        </template>
      </div>
    </div>

    <!-- Center -->
    <div class="hidden sm:flex justify-center min-w-0 pl-2 pr-0 lg:pr-2">
      <div
        class="flex items-center gap-2 px-3 py-1.5 rounded-lg border-1 border-nc-border-gray-medium bg-nc-bg-gray-light cursor-pointer hover:border-nc-border-gray-dark transition-colors w-full max-w-[400px]"
        data-testid="nc-ws-home-search"
        @click="openSearch"
      >
        <GeneralIcon icon="search" class="h-4 w-4 text-nc-content-gray-muted flex-none" />
        <span class="text-[13px] text-nc-content-gray-muted flex-1 truncate">{{ $t('activity.searchWorkspaceBases') }}...</span>
        <div class="flex items-center gap-0.5 flex-shrink-0">
          <kbd class="nc-ws-topbar-kbd">{{ renderCmdOrCtrlKey() }}</kbd>
          <kbd class="nc-ws-topbar-kbd">K</kbd>
        </div>
      </div>
    </div>

    <!-- Right spacer (only on lg+ for 3-col centering) -->
    <div class="hidden lg:block" />
  </div>
</template>

<style lang="scss" scoped>
.nc-ws-topbar-kbd {
  @apply inline-flex items-center justify-center
    min-w-5 h-5 px-1
    text-[11px] font-medium leading-none
    text-nc-content-gray-muted
    bg-nc-bg-default
    border-1 border-nc-border-gray-medium
    rounded;
}
</style>
