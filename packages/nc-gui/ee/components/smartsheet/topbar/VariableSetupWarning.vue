<script setup lang="ts">
const baseStore = useBase()

const { isManagedAppInstaller, isSandbox } = storeToRefs(baseStore)

const isDerivedBase = computed(() => isManagedAppInstaller.value || isSandbox.value)

const { hasUnconfiguredVars, unconfiguredRequiredVars, listVariables, variables } = useBaseVariables()

const isSetupModalVisible = ref(false)

const hasShownAutoModal = ref(false)

const setupVariables = computed(() => variables.value.filter((v) => v.inheritance === 'required' || v.inheritance === 'editable'))

const openSetupModal = () => {
  isSetupModalVisible.value = true
}

// Auto-show setup modal on first load if there are unconfigured required vars
watch(
  [isDerivedBase, hasUnconfiguredVars],
  ([derived, unconfigured]) => {
    if (derived && unconfigured && !hasShownAutoModal.value) {
      hasShownAutoModal.value = true
      nextTick(() => {
        isSetupModalVisible.value = true
      })
    }
  },
  { immediate: true },
)

// Load variables when entering a derived base
watch(
  () => isDerivedBase.value,
  async (val) => {
    if (val) {
      await listVariables()
    }
  },
  { immediate: true },
)
</script>

<template>
  <NcTooltip v-if="isDerivedBase && hasUnconfiguredVars">
    <template #title> {{ unconfiguredRequiredVars.length }} {{ $t('labels.requiredVariablesMissing') }} </template>
    <div
      class="flex items-center gap-1.5 px-2 py-1 h-8 rounded-lg border-1 cursor-pointer transition-colors select-none bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-600/40 text-red-600"
      @click="openSetupModal"
    >
      <GeneralIcon icon="ncAlertTriangle" class="w-3.5 h-3.5" />
      <span class="text-xs font-medium whitespace-nowrap">{{ $t('labels.setupRequired') }}</span>
    </div>
  </NcTooltip>

  <DlgManagedAppVariableSetup
    v-if="isSetupModalVisible && isDerivedBase"
    v-model:visible="isSetupModalVisible"
    :variables="setupVariables"
    :base-id="baseStore.baseId!"
    :base-title="baseStore.base?.title || ''"
    :workspace-id="baseStore.base?.fk_workspace_id || ''"
    @configured="listVariables()"
  />
</template>
