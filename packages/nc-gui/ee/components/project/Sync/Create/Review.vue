<script setup lang="ts">
import type { SyncCategory } from 'nocodb-sdk'
import { SyncTrigger, TARGET_TABLES_META } from 'nocodb-sdk'
import cronstrue from 'cronstrue'
import { useSyncFormOrThrow } from '../useSyncForm'
import { capitalize } from '~/utils/stringUtils'
import { SyncFormStep } from '#imports'

const { syncConfigForm, integrationConfigs, step } = useSyncFormOrThrow()

const { t } = useI18n()

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
    (syncConfigForm.value.meta?.sync_excluded_models?.length > 0
      ? `, ${availableModels.value?.length - syncConfigForm.value.meta.sync_excluded_models?.length} specific tables`
      : '')
  )
}

const columns = [
  {
    key: 'name',
    title: 'Config name',
    name: 'Name',
    dataIndex: 'name',
    minWidth: 150,
    basis: '50%',
    padding: '0px 24px',
  },
  {
    key: 'value',
    title: 'Selected value',
    name: 'Value',
    dataIndex: 'value',
    minWidth: 120,
    basis: '50%',
    padding: '0px 24px',
  },
] as NcTableColumnProps[]

const data = computed(() => {
  return [
    {
      title: t('labels.syncName'),
      value: syncConfigForm.value.title,
    },
    {
      title: t('labels.syncType'),
      value: syncEntityToReadableMap[syncConfigForm.value.sync_type!],
    },
    {
      title: t('labels.onDelete'),
      value: syncEntityToReadableMap[syncConfigForm.value.on_delete_action!],
    },
    {
      title: t('labels.syncTrigger'),
      value: getReadableTrigger(syncConfigForm.value.sync_trigger!),
    },
    {
      title: t('labels.category'),
      value: getReadableCategory(syncConfigForm.value.sync_category!),
    },
  ]
})
</script>

<template>
  <div class="flex flex-col gap-8">
    <div class="flex flex-col gap-4">
      <div class="flex items-center gap-2.5">
        <div class="text-bodyLgBold text-nc-content-gray">
          {{ $t('general.general') }}
        </div>
        <NcButton type="text" size="xsmall" @click="switchToStep(SyncFormStep.SyncSettings)">
          <div class="flex gap-2 text-nc-content-brand items-center">
            <GeneralIcon icon="ncEdit2" />
          </div>
        </NcButton>
      </div>

      <div class="flex-1 overflow-auto">
        <NcTable
          :columns="columns"
          :data="data"
          row-height="44px"
          header-row-height="44px"
          body-row-class-name="!cursor-default no-border-last"
          class="h-full w-full"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'name'">
              <NcTooltip :title="record.title" show-on-truncate-only class="text-nc-content-gray font-semibold truncate w-full">
                {{ record.title || 'Untitled Sync' }}
              </NcTooltip>
            </template>

            <template v-else-if="column.key === 'value'">
              {{ record.value }}
            </template>
          </template>
        </NcTable>
      </div>
    </div>

    <div class="flex flex-col gap-4">
      <div class="flex items-center gap-2.5">
        <div class="text-bodyLgBold text-nc-content-gray">
          {{ $t('labels.sources') }}
        </div>
        <NcButton type="text" size="xsmall" @click="switchToStep(SyncFormStep.Integration)">
          <div class="flex gap-2 text-nc-content-brand items-center">
            <GeneralIcon icon="ncEdit2" />
          </div>
        </NcButton>
      </div>

      <div class="flex flex-col rounded-lg border-1 border-nc-border-gray-medium">
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
  </div>
</template>
