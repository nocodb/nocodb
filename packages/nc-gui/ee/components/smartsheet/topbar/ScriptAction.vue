<script setup lang="ts">
const { isRunning, runScript, stopExecution, playground } = useScriptStoreOrThrow()

const automationStore = useAutomationStore()

const { activeAutomation, isLoadingAutomation, isSettingsOpen } = storeToRefs(automationStore)

const { isValidConfig, shouldShowSettings, restartScript } = useScriptStoreOrThrow()

const { selectedPageSize, selectedOrientation, pageSizes, orientations, printPlayground, isGenerating } =
  useScriptPlaygroundPrint()

const showPrintDropdown = ref(false)

const toggleScriptSettings = () => {
  isSettingsOpen.value = !isSettingsOpen.value
}

const handlePrint = async () => {
  await printPlayground()
  showPrintDropdown.value = false
}

const hasPrintableContent = computed(() => {
  return playground.value && playground.value.length > 0
})
</script>

<template>
  <div v-if="!isLoadingAutomation && activeAutomation" class="flex items-center gap-2">
    <NcButton
      v-if="shouldShowSettings"
      :class="{ '!bg-nc-bg-brand !hover:bg-brand-100/70 !text-nc-content-brand is-settings-open': isSettingsOpen }"
      type="secondary"
      size="small"
      data-testid="nc-script-settings-btn"
      @click="toggleScriptSettings"
    >
      <GeneralIcon icon="ncSettings2" />
    </NcButton>

    <NcDropdown v-model:visible="showPrintDropdown" :disabled="!hasPrintableContent || isGenerating">
      <NcTooltip :disabled="hasPrintableContent && !isGenerating">
        <NcButton
          type="secondary"
          size="small"
          :disabled="!hasPrintableContent || isGenerating"
          :loading="isGenerating"
          data-testid="nc-script-print-btn"
        >
          <div class="flex gap-2 items-center">
            <GeneralIcon v-if="!isGenerating" icon="ncPrinter" />
            {{ isGenerating ? $t('labels.generatingPDF') : $t('labels.print') }}
          </div>
        </NcButton>
        <template #title>
          {{ isGenerating ? $t('labels.generatingPDF') : $t('labels.executeScriptToPrint') }}
        </template>
      </NcTooltip>

      <template #overlay>
        <NcMenu variant="medium" class="nc-print-page-size-menu">
          <NcMenuItemLabel class="!capitalize"> {{ $t('labels.pageSize') }} </NcMenuItemLabel>
          <NcMenuItem v-for="pageSize in pageSizes" :key="pageSize.type" class="!py-2" @click="selectedPageSize = pageSize.type">
            <div class="flex items-center justify-between w-full gap-2">
              <span>{{ pageSize.type }}</span>
              <GeneralIcon v-if="selectedPageSize === pageSize.type" icon="check" class="text-nc-content-brand" />
            </div>
          </NcMenuItem>
          <NcDivider />
          <NcMenuItemLabel class="!capitalize"> {{ $t('labels.orientation') }} </NcMenuItemLabel>
          <NcMenuItem
            v-for="orientation in orientations"
            :key="orientation.type"
            class="!py-2"
            @click="selectedOrientation = orientation.type"
          >
            <div class="flex items-center flex-1 justify-between w-full gap-2">
              <span class="w-full flex-1">{{ orientation.type }}</span>
              <GeneralIcon v-if="selectedOrientation === orientation.type" icon="check" class="text-nc-content-brand" />
            </div>
          </NcMenuItem>
          <NcDivider />

          <NcMenuItem @click="handlePrint">
            <div class="flex items-center gap-2 text-nc-content-brand">
              <GeneralLoader v-if="isGenerating" />
              <GeneralIcon v-else icon="ncPrinter" />
              <span class="font-semibold">
                {{ $t('labels.generatePDF') }}
              </span>
            </div>
          </NcMenuItem>
        </NcMenu>
      </template>
    </NcDropdown>

    <template v-if="isRunning">
      <NcButton
        type="text"
        size="small"
        class="!text-nc-content-brand !hover:bg-nc-bg-default"
        :loading="isRunning"
        data-testid="nc-script-running-indicator"
      >
        Running Script ...
      </NcButton>
      <div class="flex items-center">
        <NcButton type="secondary" size="small" class="!rounded-r-none" data-testid="nc-script-stop-btn" @click="stopExecution">
          <div class="flex gap-2 items-center">
            <GeneralIcon icon="ncStopCircle" />
            Stop
          </div>
        </NcButton>
        <NcButton
          type="secondary"
          size="small"
          class="!rounded-l-none !border-l-0"
          data-testid="nc-script-restart-btn"
          @click="restartScript"
        >
          <GeneralIcon icon="ncRotateCcw" />
        </NcButton>
      </div>
    </template>
    <NcTooltip v-else :disabled="isValidConfig">
      <NcButton
        size="small"
        :disabled="isRunning || !isValidConfig"
        :loading="isRunning"
        data-testid="nc-script-run-btn"
        @click="runScript"
      >
        <div class="flex gap-2 items-center">
          <GeneralIcon icon="ncPlay" />
          Run
        </div>
      </NcButton>

      <template #title> Setup script settings to run </template>
    </NcTooltip>
  </div>
</template>

<style scoped lang="scss">
.nc-print-page-size-menu {
  min-width: 240px;
}

:deep(.nc-menu-item-inner) {
  @apply w-full;
}
</style>
