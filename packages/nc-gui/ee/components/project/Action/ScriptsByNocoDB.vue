<script setup lang="ts">
const { isUIAllowed } = useRoles()

const scriptStore = useScriptStore()

const { isMarketVisible } = storeToRefs(scriptStore)

const { isSharedBase } = storeToRefs(useBase())

const { appInfo } = useGlobal()

const { isEEFeatureBlocked, showUpgradeToUseScripts } = useEeConfig()

const openMarketPlace = () => {
  if (!appInfo.value?.ee) {
    showUpgradeToUseScripts()
    return
  }

  isMarketVisible.value = true
}

const isActionVisible = computed(() => {
  return isUIAllowed('scriptCreateOrEdit') && !isSharedBase.value
})
</script>

<template>
  <div v-if="isActionVisible" class="relative">
    <ProjectActionItem
      :label="$t('labels.scriptsByNocoDB')"
      :subtext="$t('msg.subText.scriptsByNocoDB')"
      class="nc-base-view-all-scripts-btn"
      data-testid="proj-view-btn__add-new-template-script"
      @click="openMarketPlace"
    >
      <template #icon>
        <GeneralIcon icon="ncScript" class="!h-8 !w-8 text-nc-content-maroon-dark" />
      </template>
    </ProjectActionItem>
    <LazyPaymentUpgradeBadge :feature-enabled-callback="() => !isEEFeatureBlocked" remove-click class="absolute right-2 top-2" />
  </div>
</template>
