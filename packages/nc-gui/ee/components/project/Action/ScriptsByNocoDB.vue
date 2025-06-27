<script setup lang="ts">
const { isUIAllowed } = useRoles()

const automationStore = useAutomationStore()

const { isMarketVisible, isDetailsVisible, detailsScriptId } = storeToRefs(automationStore)

const { isSharedBase } = storeToRefs(useBase())

const { isFeatureEnabled } = useBetaFeatureToggle()

const isAutomationEnabled = computed(() => isFeatureEnabled(FEATURE_FLAG.NOCODB_SCRIPTS))

const openMarketPlace = () => {
  isMarketVisible.value = true
}

const isActionVisible = computed(() => {
  return isAutomationEnabled.value && isUIAllowed('scriptCreateOrEdit') && !isSharedBase.value
})
</script>

<template>
  <div v-if="isActionVisible" class="flex">
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

    <ScriptsMarket v-model:model-value="isMarketVisible" />
    <ScriptsDetails v-if="isDetailsVisible && detailsScriptId" v-model="isDetailsVisible" :script-id="detailsScriptId" />
  </div>
</template>
