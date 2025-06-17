<script setup lang="ts">
const { isRunning, runScript, stopExecution } = useScriptStoreOrThrow()

const automationStore = useAutomationStore()

const { activeAutomation, isLoadingAutomation, isSettingsOpen } = storeToRefs(automationStore)

const { isValidConfig } = useScriptStoreOrThrow()

const toggleScriptSettings = () => {
  isSettingsOpen.value = !isSettingsOpen.value
}
</script>

<template>
  <div v-if="!isLoadingAutomation && activeAutomation" class="flex items-center gap-2">
    <NcButton
      :class="{ '!bg-brand-50 !hover:bg-brand-100/70 !text-brand-500': isSettingsOpen }"
      type="secondary"
      size="small"
      @click="toggleScriptSettings"
    >
      <GeneralIcon icon="ncSettings2" />
    </NcButton>

    <NcButton v-if="isRunning" size="small" type="primary" @click="stopExecution">
      <div class="flex gap-2 items-center">Stop Execution</div>
    </NcButton>
    <NcTooltip :disabled="isValidConfig">
      <NcButton size="small" type="primary" :disabled="isRunning || !isValidConfig" :loading="isRunning" @click="runScript">
        <div class="flex gap-2 items-center">
          <GeneralIcon icon="ncPlay" />
          Run
        </div>
      </NcButton>

      <template #title> Setup script settings to run </template>
    </NcTooltip>
  </div>
</template>
