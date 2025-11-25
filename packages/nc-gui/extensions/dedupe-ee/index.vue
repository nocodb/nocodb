<script setup lang="ts">
import { ref, watch } from 'vue'
import { useProvideDedupe } from './lib/useDedupe'
import ConfigurationStep from './components/ConfigurationStep.vue'
import ReviewStep from './components/ReviewStep.vue'

const step = ref<'config' | 'review'>('config')

// Provide dedupe instance to child components
const dedupe = useProvideDedupe()

// Load saved configuration on mount
onMounted(async () => {
  await dedupe.loadSavedConfig()
})

// Watch for duplicate finding completion
watch(
  () => dedupe.duplicateSets.value.length,
  async (length) => {
    if (length > 0 && step.value === 'config') {
      step.value = 'review'
      // Load records for the first duplicate set
      if (dedupe.currentDuplicateSet.value && !dedupe.currentDuplicateSet.value.records) {
        await dedupe.loadRecordsForGroup(dedupe.currentDuplicateSet.value)
      }
    }
  },
)

const handleBackToConfig = () => {
  step.value = 'config'
}

const handleAllDuplicatesResolved = () => {
  step.value = 'config'
}
</script>

<template>
  <ExtensionsExtensionWrapper>
    <div class="flex flex-col h-full">
      <ConfigurationStep v-if="step === 'config'" />
      <ReviewStep v-else @back-to-config="handleBackToConfig" @all-duplicates-resolved="handleAllDuplicatesResolved" />
    </div>
  </ExtensionsExtensionWrapper>
</template>

<style lang="scss" scoped>
.nc-dedupe-ee {
  .extension-content {
    &:not(.fullscreen) {
      @apply p-3;
    }
  }
}
</style>