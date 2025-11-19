<script lang="ts" setup>
import { SyncCategory } from 'nocodb-sdk'
import { useSyncFormOrThrow } from '../useSyncForm'

defineProps<{
  current: number
}>()

const { t } = useI18n()

const { syncConfigForm } = useSyncFormOrThrow()

const steps = computed(() => {
  const baseSteps = [
    { title: t('labels.setup'), index: 0 },
    { title: t('labels.sources'), index: 1 },
  ]

  if (syncConfigForm.value.sync_category === SyncCategory.CUSTOM) {
    baseSteps.push({ title: t('labels.schema'), index: 2 })
  }

  baseSteps.push({ title: t('labels.review'), index: baseSteps.length })

  return baseSteps
})
</script>

<template>
  <div class="">
    <div class="flex items-center justify-between w-full">
      <div v-for="(step, idx) in steps" :key="step.index" class="flex items-center" :class="{ 'flex-1': idx < steps.length - 1 }">
        <div class="flex items-center gap-1 text-nc-content-gray-muted text-caption">
          <div
            :class="{
              'text-nc-content-brand !bg-nc-bg-brand': idx <= current,
            }"
            class="w-5 h-5 bg-nc-bg-gray-medium flex items-center justify-center rounded-md"
          >
            {{ step.index + 1 }}
          </div>
          <div
            :class="{
              'font-semibold text-nc-content-brand': idx <= current,
            }"
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
