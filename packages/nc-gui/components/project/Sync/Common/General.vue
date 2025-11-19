<script setup lang="ts">
import { OnDeleteActionMeta, SyncTrigger, SyncTriggerMeta, SyncTypeMeta } from 'nocodb-sdk'
import { useSyncFormOrThrow } from '../useSyncForm'

const { syncConfigForm, mode, syncConfigEditFormChanged, validateInfosSyncConfig } = useSyncFormOrThrow()

const syncTypeOptions = Object.values(SyncTypeMeta)
const syncTriggerOptions = Object.values(SyncTriggerMeta)
const onDeleteActionOptions = Object.values(OnDeleteActionMeta)

const formModel = computed(() => {
  return mode === 'create' ? syncConfigForm.value : syncConfigForm.value
})

watch(
  () => formModel.value.sync_trigger,
  () => {
    formModel.value.sync_trigger_cron = undefined
  },
)
</script>

<template>
  <div>
    <div class="text-bodyLgBold text-nc-content-gray mb-4">
      {{ $t('general.general') }}
    </div>
    <a-form-item class="px-0.5" :label="$t('labels.syncName')" v-bind="validateInfosSyncConfig.title">
      <a-input
        v-model:value="formModel.title"
        class="nc-input-shadow !rounded-md"
        :placeholder="$t('placeholder.enterSyncName')"
        @change="syncConfigEditFormChanged = true"
      />
    </a-form-item>
  </div>

  <div class="flex items-center gap-4">
    <a-form-item class="flex-1" :label="$t('labels.syncType')" v-bind="validateInfosSyncConfig.sync_type">
      <a-select
        v-model:value="formModel.sync_type"
        class="nc-select-shadow"
        :options="syncTypeOptions"
        @change="syncConfigEditFormChanged = true"
      >
        <template #suffixIcon>
          <GeneralIcon icon="ncChevronDown" class="text-nc-content-gray" />
        </template>
      </a-select>
    </a-form-item>

    <a-form-item class="flex-1" :label="$t('labels.onDeleteAction')" v-bind="validateInfosSyncConfig.on_delete_action">
      <a-select
        v-model:value="formModel.on_delete_action"
        class="nc-select-shadow"
        :options="onDeleteActionOptions"
        @change="syncConfigEditFormChanged = true"
      >
        <template #suffixIcon>
          <GeneralIcon icon="ncChevronDown" class="text-nc-content-gray" />
        </template>
      </a-select>
    </a-form-item>
  </div>

  <div class="flex items-center gap-4">
    <a-form-item class="flex-1" :label="$t('labels.syncTrigger')" v-bind="validateInfosSyncConfig.sync_trigger">
      <a-select
        v-model:value="formModel.sync_trigger"
        class="nc-select-shadow"
        :options="syncTriggerOptions"
        @change="syncConfigEditFormChanged = true"
      >
        <template #suffixIcon>
          <GeneralIcon icon="ncChevronDown" class="text-nc-content-gray" />
        </template>
      </a-select>
    </a-form-item>
    <a-form-item
      v-if="formModel.sync_trigger === SyncTrigger.Schedule"
      class="flex-1"
      :label="$t('labels.syncSchedule')"
      v-bind="validateInfosSyncConfig.sync_trigger_cron"
    >
      <ProjectSyncCommonSchedule v-model:model-value="formModel.sync_trigger_cron" @change="syncConfigEditFormChanged = true" />
    </a-form-item>
  </div>
</template>
