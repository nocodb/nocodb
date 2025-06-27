<script setup lang="ts">
const { isUIAllowed } = useRoles()

const automationStore = useAutomationStore()

const { isMarketVisible, isDetailsVisible, detailsScriptId } = storeToRefs(automationStore)

const openMarketPlace = () => {
  isMarketVisible.value = true
}
</script>

<template>
  <div class="flex">
    <ProjectActionItem
      v-if="isUIAllowed('scriptCreateOrEdit')"
      :label="$t('labels.scriptsByNocoDB')"
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
