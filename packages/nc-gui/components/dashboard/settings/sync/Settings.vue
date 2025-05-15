<script lang="ts" setup>
import { OnDeleteActionMeta, SyncTriggerMeta, SyncTypeMeta, TARGET_TABLES_META } from 'nocodb-sdk'

const { syncConfigForm, validateInfosSyncConfig } = useSyncStoreOrThrow()

const syncTypeOptions = Object.values(SyncTypeMeta)
const syncTriggerOptions = Object.values(SyncTriggerMeta)
const onDeleteActionOptions = Object.values(OnDeleteActionMeta)

// Initialize sync models settings
const syncAllModels = ref(true)

// Filter target tables based on sync category
const availableModels = computed(() => {
  return Object.values(TARGET_TABLES_META).filter(
    (model) => model.category === syncConfigForm.value.sync_category || !syncConfigForm.value.sync_category,
  )
})

const onCheckboxChange = (model: string) => {
  if (syncConfigForm.value.exclude_models.includes(model)) {
    syncConfigForm.value.exclude_models = syncConfigForm.value.exclude_models.filter((m) => m !== model)
  } else {
    syncConfigForm.value.exclude_models.push(model)
  }
}
</script>

<template>
  <a-row :gutter="24">
    <a-col :span="24">
      <a-form-item label="Sync Title" v-bind="validateInfosSyncConfig.title" hide-required-mark>
        <a-input v-model:value="syncConfigForm.title" />
      </a-form-item>
    </a-col>
  </a-row>
  <a-row :gutter="24">
    <a-col :span="12">
      <a-form-item label="Sync Type" v-bind="validateInfosSyncConfig.sync_type" hide-required-mark>
        <a-select v-model:value="syncConfigForm.sync_type" :options="syncTypeOptions" />
      </a-form-item>
    </a-col>
    <a-col :span="12">
      <a-form-item label="Sync Trigger" v-bind="validateInfosSyncConfig.sync_trigger" hide-required-mark>
        <a-select v-model:value="syncConfigForm.sync_trigger" :options="syncTriggerOptions" />
      </a-form-item>
    </a-col>
  </a-row>
  <a-row :gutter="24">
    <a-col :span="12">
      <a-form-item label="On Delete Action" v-bind="validateInfosSyncConfig.on_delete_action" hide-required-mark>
        <a-select v-model:value="syncConfigForm.on_delete_action" :options="onDeleteActionOptions" />
      </a-form-item>
    </a-col>
  </a-row>

  <div class="mt-4">
    <a-radio-group v-model:value="syncAllModels" class="w-full">
      <div class="flex items-start mb-4">
        <a-radio :value="true" class="!mt-0.5">
          <div class="ml-2">
            <div class="text-base">Sync all available models</div>
            <div class="text-gray-500 text-xs mt-1">
              All GitHub data models will be synced. This may take longer and use more resources.
            </div>
          </div>
        </a-radio>
      </div>

      <div class="flex items-start">
        <a-radio :value="false" class="!mt-0.5">
          <div class="ml-2">
            <div class="text-base">Select specific models</div>
          </div>
        </a-radio>
      </div>
    </a-radio-group>

    <div v-if="!syncAllModels" class="border rounded-lg px-1 py-2">
      <div v-for="model in availableModels" :key="model.value" class="flex items-start px-3">
        <a-checkbox
          :value="model.value"
          :checked="!syncConfigForm.exclude_models.includes(model.value)"
          :disabled="model.required"
          @change="onCheckboxChange(model.value)"
        >
          <div class="flex justify-center flex-col ml-2">
            <div class="flex items-center">
              <div class="flex-none mr-2">
                <GeneralIcon :icon="model.icon" class="text-primary" />
              </div>
              <div class="!text-black">{{ model.label }}</div>
            </div>
            <div class="text-gray-500 text-xs">{{ model.description }}</div>
          </div>
        </a-checkbox>
      </div>
    </div>
  </div>
</template>
