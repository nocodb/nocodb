<script lang="ts" setup>
const workspaceStore = useWorkspace()

const { activeWorkspace } = storeToRefs(workspaceStore)

const { activePlanTitle, isPaymentEnabled, showEEFeatures, handleUpgradePlan, getPlanTitle } = useEeConfig()

const isFreePlan = computed(() => activePlanTitle.value === 'Free')

const { t } = useI18n()

const showUpgrade = () => {
  handleUpgradePlan({
    content: t('upgrade.upgradeGenericSubtitle'),
  })
}

const workspaceTitle = computed(() => {
  if (isEeUI) return activeWorkspace.value?.title
  return 'Default Workspace'
})
</script>

<template>
  <div class="flex items-center gap-2 px-2 sm:px-4 h-[var(--topbar-height)] flex-none border-b-1 border-nc-border-gray-medium">
    <GeneralOpenLeftSidebarBtn />
    <h1 class="text-bodyLgBold text-nc-content-gray capitalize truncate mb-0" data-testid="nc-ws-home-topbar-title">
      {{ workspaceTitle }}
    </h1>
    <div
      v-if="isEeUI && showEEFeatures"
      dir="ltr"
      class="hidden md:flex items-center justify-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium leading-none bg-nc-bg-gray-light text-nc-content-gray-subtle flex-shrink-0"
    >
      <span class="uppercase">{{ getPlanTitle(activePlanTitle) }} {{ $t('general.plan') }}</span>
      <template v-if="isFreePlan && isPaymentEnabled && showEEFeatures">
        <span class="text-nc-content-gray-muted">&middot;</span>
        <span class="text-primary cursor-pointer hover:underline" @click="showUpgrade">{{ $t('general.upgrade') }}</span>
      </template>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
