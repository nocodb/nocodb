<script setup lang="ts">
const { isUIAllowed } = useRoles()

const scriptStore = useScriptStore()

const { isMarketVisible } = storeToRefs(scriptStore)

const { isSharedBase } = storeToRefs(useBase())

const openMarketPlace = () => {
  isMarketVisible.value = true
}

const isActionVisible = computed(() => {
  return isUIAllowed('scriptCreateOrEdit') && !isSharedBase.value
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
  </div>
</template>
