<script setup lang="ts">
const { isRunning, runScript, stopExecution, code } = useScriptStoreOrThrow()

const automationStore = useAutomationStore()

const { updateAutomation } = automationStore

const { activeAutomation, activeAutomationId, isLoadingAutomation, isSettingsOpen } = storeToRefs(automationStore)

const { base } = storeToRefs(useBase())

const isSaving = ref(false)

const useDebouncedSaveCode = async () => {
  try {
    isSaving.value = true
    await updateAutomation(base.value.id, activeAutomationId.value, {
      script: code.value,
    })
  } finally {
    isSaving.value = false
  }
}

const toggleScriptSettings = () => {
  isSettingsOpen.value = !isSettingsOpen.value
}
</script>

<template>
  <div v-if="!isLoadingAutomation && activeAutomation" class="flex items-center gap-2">
    <NcButton size="small" type="primary" :disabled="isRunning" :loading="isRunning" @click="runScript">
      <div class="flex gap-2 items-center">
        <GeneralIcon icon="ncPlay" />
        Run
      </div>
    </NcButton>

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
    <NcButton
      :disabled="code === activeAutomation.script || isSaving"
      :loading="isSaving"
      size="small"
      type="primary"
      @click="useDebouncedSaveCode"
    >
      <div class="flex gap-2 items-center">Save script</div>
    </NcButton>
  </div>
</template>
