<script lang="ts" setup>
import { SyncCategory } from 'nocodb-sdk'
import { useSyncFormOrThrow } from '../useSyncForm'

defineProps<{
  current: number
}>()

const { syncConfigForm } = useSyncFormOrThrow()

const steps = computed(() => {
  const baseSteps = [
    { title: 'Category', index: 0 },
    { title: 'Sources', index: 1 },
  ]

  if (syncConfigForm.value.sync_category === SyncCategory.CUSTOM) {
    baseSteps.push({ title: 'Schema', index: 2 })
  }

  baseSteps.push({ title: 'Review', index: baseSteps.length })

  return baseSteps
})
</script>

<template>
  <div class="">
    <div class="flex items-center justify-between w-full">
      <div v-for="(step, idx) in steps" :key="step.index" class="flex items-center" :class="{ 'flex-1': idx < steps.length - 1 }">
        <div class="flex items-center gap-1">
          <div
            :class="{
              'text-nc-content-brand !bg-nc-bg-brand': idx <= current,
            }"
            class="w-5 h-5 bg-nc-bg-gray-medium text-caption flex items-center justify-center rounded-md"
          >
            {{ step.index + 1 }}
          </div>
          <div
            :class="{
              'font-semibold text-nc-content-brand': idx <= current,
            }"
            class="text-nc-content-gray-muted text-captionSm"
          >
            {{ step.title }}
          </div>
        </div>
        <div
          v-if="idx < steps.length - 1"
          class="flex-1 h-0.5 bg-nc-bg-gray-medium mx-2 w-4 transition-all duration-200"
          :class="{
            'bg-nc-brand-500': step.index < current,
          }"
        />
      </div>
    </div>
  </div>
</template>
