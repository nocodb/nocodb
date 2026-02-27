<script setup lang="ts">
const { t } = useI18n()

const { isUIAllowed } = useRoles()

const scriptStore = useScriptStore()

const { openNewScriptModal: _openNewScriptModal } = scriptStore

const { openedProject } = storeToRefs(useBases())

const { isSharedBase } = storeToRefs(useBase())

const { appInfo } = useGlobal()

const { isEEFeatureBlocked, showUpgradeToUseScripts } = useEeConfig()

const label = computed(() => {
  return `${t('general.create')} ${t('objects.script')}`
})

async function openNewScriptModal() {
  if (!appInfo.value?.ee) {
    showUpgradeToUseScripts()
    return
  }

  _openNewScriptModal({
    baseId: openedProject.value?.id,
    loadScriptsOnClose: true,
    scrollOnCreate: true,
  })
}

const isActionVisible = computed(() => {
  return isUIAllowed('scriptCreateOrEdit') && !isSharedBase.value
})
</script>

<template>
  <div v-if="isActionVisible" class="relative">
    <ProjectActionItem
      class="nc-base-view-all-scripts-btn"
      :label="label"
      :subtext="$t('msg.subText.startFromScratch')"
      data-testid="proj-view-btn__add-new-script"
      @click="openNewScriptModal"
    >
      <template #icon>
        <GeneralIcon icon="ncScript" class="!h-8 !w-8 !text-nc-content-brand" />
      </template>
    </ProjectActionItem>
    <LazyPaymentUpgradeBadge :feature-enabled-callback="() => !isEEFeatureBlocked" class="absolute right-2 top-2" remove-click />
  </div>
</template>
