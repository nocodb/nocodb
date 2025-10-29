<script lang="ts" setup>
const props = defineProps<{
  current: number
}>()

const { syncConfigForm } = useSyncStoreOrThrow()

const steps = computed(() => {
  const baseSteps = [
    { title: 'Category', index: 0 },
    { title: 'Settings', index: 1 },
    { title: 'Sources', index: 2 },
  ]

  if (syncConfigForm.value.sync_category === 'custom') {
    baseSteps.push({ title: 'Schema', index: 3 })
  }

  baseSteps.push({ title: 'Review', index: baseSteps.length })

  return baseSteps
})

const getStepStatus = (stepIndex: number) => {
  if (stepIndex < props.current) return 'completed'
  if (stepIndex === props.current) return 'active'
  return 'pending'
}
</script>

<template>
  <div class="nc-sync-steps">
    <div class="flex items-center justify-between w-full">
      <div v-for="(step, idx) in steps" :key="step.index" class="flex items-center" :class="{ 'flex-1': idx < steps.length - 1 }">
        <!-- Step Circle -->
        <div class="flex flex-col items-center gap-2">
          <div
            class="nc-step-circle"
            :class="{
              'nc-step-completed': getStepStatus(step.index) === 'completed',
              'nc-step-active': getStepStatus(step.index) === 'active',
              'nc-step-pending': getStepStatus(step.index) === 'pending',
            }"
          >
            <GeneralIcon v-if="getStepStatus(step.index) === 'completed'" icon="check" class="w-4 h-4 text-white" />
            <span v-else class="text-sm font-medium">{{ step.index + 1 }}</span>
          </div>
          <span
            class="text-xs font-medium whitespace-nowrap"
            :class="{
              'text-brand-500': getStepStatus(step.index) === 'active',
              'text-gray-800': getStepStatus(step.index) === 'completed',
              'text-gray-500': getStepStatus(step.index) === 'pending',
            }"
          >
            {{ step.title }}
          </span>
        </div>

        <!-- Connector Line -->
        <div
          v-if="idx < steps.length - 1"
          class="nc-step-connector"
          :class="{
            'nc-step-connector-completed': getStepStatus(step.index) === 'completed',
          }"
        />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-sync-steps {
  @apply w-full;
}

.nc-step-circle {
  @apply w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200;
  @apply border-2;
}

.nc-step-pending {
  @apply bg-gray-50 border-gray-300 text-gray-500;
}

.nc-step-active {
  @apply bg-brand-50 border-brand-500 text-brand-600;
}

.nc-step-completed {
  @apply bg-brand-500 border-brand-500;
}

.nc-step-connector {
  @apply flex-1 h-0.5 bg-gray-200 mx-3 transition-all duration-200;
}

.nc-step-connector-completed {
  @apply bg-brand-500;
}
</style>
