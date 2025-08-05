<script setup lang="ts">
const { isRunning, runScript, stopExecution } = useScriptStoreOrThrow()

const automationStore = useAutomationStore()

const { activeAutomation, isLoadingAutomation, isSettingsOpen } = storeToRefs(automationStore)

const { isValidConfig, shouldShowSettings, restartScript } = useScriptStoreOrThrow()

const toggleScriptSettings = () => {
  isSettingsOpen.value = !isSettingsOpen.value
}
</script>

<template>
  <div v-if="!isLoadingAutomation && activeAutomation" class="flex items-center gap-2">
    <NcButton
      v-if="shouldShowSettings"
      :class="{ '!bg-brand-50 !hover:bg-brand-100/70 !text-brand-500': isSettingsOpen }"
      type="secondary"
      size="small"
      @click="toggleScriptSettings"
    >
      <GeneralIcon icon="ncSettings2" />
    </NcButton>

    <template v-if="isRunning">
      <NcButton type="text" size="small" class="!text-nc-content-brand !hover:bg-white" :loading="isRunning">
        Running Script ...
      </NcButton>
      <div class="flex items-center">
        <NcButton type="secondary" size="small" class="!rounded-r-none" @click="stopExecution">
          <div class="flex gap-2 items-center">
            <GeneralIcon icon="ncStopCircle" />
            Stop
          </div>
        </NcButton>
        <NcButton type="secondary" size="small" class="!rounded-l-none !border-l-0" @click="restartScript">
          <GeneralIcon icon="ncRotateCcw" />
        </NcButton>
      </div>
    </template>
    <NcTooltip v-else :disabled="isValidConfig">
      <NcButton size="small" :disabled="isRunning || !isValidConfig" :loading="isRunning" @click="runScript">
        <div class="flex gap-2 items-center">
          <GeneralIcon icon="ncPlay" />
          Run
        </div>
      </NcButton>

      <template #title> Setup script settings to run </template>
    </NcTooltip>
  </div>
</template>
