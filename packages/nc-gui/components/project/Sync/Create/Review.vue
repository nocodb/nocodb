<script setup lang="ts">
import type { SyncCategory } from 'nocodb-sdk'
import { SyncTrigger, TARGET_TABLES_META } from 'nocodb-sdk'
import cronstrue from 'cronstrue'
import { useSyncFormOrThrow } from '../useSyncForm'
import { capitalize } from '~/utils/stringUtils'
import { SyncFormStep } from '#imports'

const { syncConfigForm, integrationConfigs, step } = useSyncFormOrThrow()

const switchToStep = (selectedStep: SyncFormStep) => {
  step.value = selectedStep
}

const availableModels = computed(() => {
  return Object.values(TARGET_TABLES_META).filter(
    (model) => model.category === syncConfigForm.value.sync_category || !syncConfigForm.value.sync_category,
  )
})

const getReadableTrigger = (trigger: SyncTrigger) => {
  if (trigger === SyncTrigger.Schedule) {
    return `${syncEntityToReadableMap[trigger]},  ${
      syncConfigForm.value.sync_trigger_cron ? cronstrue.toString(syncConfigForm.value.sync_trigger_cron) : ''
    }`
  }
  return syncEntityToReadableMap[trigger]
}

const getReadableCategory = (category: SyncCategory) => {
  return (
    capitalize(category) +
    (syncConfigForm.value?.exclude_models?.length > 0
      ? `, ${availableModels.value?.length - syncConfigForm.value?.exclude_models?.length} specific tables`
      : '')
  )
}
</script>

<template>
  <div>
    <div class="flex flex-col gap-4">
      <div class="flex items-center gap-2.5">
        <div class="text-bodyLgBold text-nc-content-gray flex-1">General</div>
        <NcButton type="text" size="small" @click="switchToStep(SyncFormStep.SyncSettings)">
          <div class="flex gap-2 text-nc-content-brand items-center">
            <GeneralIcon icon="ncEdit2" />
            Edit
          </div>
        </NcButton>
      </div>

      <div class="flex items-center gap-2">
        <div class="flex-1 text-caption">Sync name</div>
        <div class="flex-1 text-caption">
          {{ syncConfigForm.title }}
        </div>
      </div>
      <div class="flex items-center gap-2">
        <div class="flex-1 text-caption">Sync Type</div>
        <div class="flex-1 text-caption capitalize">
          {{ syncConfigForm.sync_type }}
        </div>
      </div>
      <div class="flex items-center gap-2">
        <div class="flex-1 text-caption">On Delete Action</div>
        <div class="flex-1 text-caption">
          {{ syncEntityToReadableMap[syncConfigForm.on_delete_action] }}
        </div>
      </div>
      <div class="flex items-center gap-2">
        <div class="flex-1 text-caption">Sync Trigger</div>
        <div class="flex-1 text-caption">
          {{ getReadableTrigger(syncConfigForm.sync_trigger) }}
        </div>
      </div>
      <div class="flex items-center gap-2">
        <div class="flex-1 text-caption">Category</div>
        <div class="flex-1 text-caption">
          {{ getReadableCategory(syncConfigForm.sync_category) }}
        </div>
      </div>
    </div>

    <NcDivider class="!my-8" />

    <div class="flex items-center gap-2.5">
      <div class="text-bodyLgBold text-nc-content-gray flex-1">Sources</div>
      <NcButton type="text" size="small" @click="switchToStep(SyncFormStep.Integration)">
        <div class="flex gap-2 text-nc-content-brand items-center">
          <GeneralIcon icon="ncEdit2" />
          Edit
        </div>
      </NcButton>
    </div>

    <div class="flex flex-col rounded-lg mt-4 border-1 border-nc-border-gray-medium">
      <div
        v-for="integration in integrationConfigs"
        :key="integration.id"
        class="py-2 px-3 border-b-1 border-nc-border-gray-medium last:border-b-0"
      >
        <div class="flex items-center gap-2">
          <GeneralIntegrationIcon v-if="integration.sub_type" :type="integration.sub_type" />
          <div class="text-nc-content-gray text-captionBold">
            {{ integration.title }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

