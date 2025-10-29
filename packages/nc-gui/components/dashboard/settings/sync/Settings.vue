<script lang="ts" setup>
import { OnDeleteActionMeta, SyncTriggerMeta, SyncTypeMeta, TARGET_TABLES_META } from 'nocodb-sdk'

const { syncConfigForm, validateInfosSyncConfig, updateSync, syncConfigEditForm, syncConfigEditFormChanged, editMode } =
  useSyncStoreOrThrow()

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

const formModel = computed(() => {
  return editMode.value ? syncConfigEditForm.value : syncConfigForm.value
})

const selectAllModels = () => {
  syncAllModels.value = true
  syncConfigEditFormChanged.value = true
}

const selectSpecificModels = () => {
  syncAllModels.value = false
  syncConfigEditFormChanged.value = true
}
</script>

<template>
  <div v-if="formModel" class="nc-sync-settings">
    <!-- Basic Settings -->
    <a-form layout="vertical" class="nc-settings-section">
      <div class="nc-section-title">Basic Settings</div>
      <a-form-item class="px-0.5" label="Sync Title" v-bind="validateInfosSyncConfig.title">
        <a-input
          v-model:value="formModel.title"
          class="nc-input-shadow !rounded-lg"
          placeholder="Enter sync title"
          @change="syncConfigEditFormChanged = true"
        />
      </a-form-item>
    </a-form>

    <!-- Sync Configuration -->
    <a-form layout="vertical" class="nc-settings-section">
      <div class="nc-section-title">Sync Configuration</div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <a-form-item label="Sync Type" v-bind="validateInfosSyncConfig.sync_type">
          <NcSelect v-model:value="formModel.sync_type" :options="syncTypeOptions" @change="syncConfigEditFormChanged = true" />
        </a-form-item>
        <a-form-item label="On Delete Action" v-bind="validateInfosSyncConfig.on_delete_action">
          <NcSelect
            v-model:value="formModel.on_delete_action"
            :options="onDeleteActionOptions"
            @change="syncConfigEditFormChanged = true"
          />
        </a-form-item>
      </div>
    </a-form>

    <a-form layout="vertical" class="nc-settings-section">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <a-form-item label="Sync Trigger" v-bind="validateInfosSyncConfig.sync_trigger">
          <NcSelect
            v-model:value="formModel.sync_trigger"
            :options="syncTriggerOptions"
            @change="syncConfigEditFormChanged = true"
          />
        </a-form-item>
        <a-form-item
          v-if="formModel.sync_trigger === 'schedule'"
          label="Sync Schedule"
          v-bind="validateInfosSyncConfig.sync_trigger_cron"
        >
          <DashboardSettingsSyncSchedule v-model="formModel.sync_trigger_cron" @change="syncConfigEditFormChanged = true" />
        </a-form-item>
      </div>
    </a-form>

    <!-- Update Button (Edit Mode) -->
    <div v-if="editMode" class="nc-settings-section">
      <div class="flex justify-end">
        <NcButton class="!px-4" type="primary" size="small" :disabled="!syncConfigEditFormChanged" @click="updateSync">
          Update Sync Settings
        </NcButton>
      </div>
    </div>

    <!-- Model Selection -->
    <div v-if="syncConfigForm.sync_category !== 'custom' && !editMode" class="nc-settings-section">
      <div class="nc-section-title">Model Selection</div>

      <div class="flex flex-col gap-3">
        <!-- Option 1: Sync All -->
        <div class="nc-model-option" :class="{ 'nc-model-option-selected': syncAllModels }" @click="selectAllModels">
          <div class="flex items-start gap-3">
            <div class="nc-option-radio">
              <div v-if="syncAllModels" class="nc-radio-dot" />
            </div>
            <div class="flex-1">
              <div class="text-sm font-semibold text-gray-800">Sync all available models</div>
              <div class="text-xs text-gray-500 mt-1">
                All models for the category will be synced. This may take longer and use more resources.
              </div>
            </div>
          </div>
        </div>

        <!-- Option 2: Select Specific -->
        <div class="nc-model-option" :class="{ 'nc-model-option-selected': !syncAllModels }" @click="selectSpecificModels">
          <div class="flex items-start gap-3">
            <div class="nc-option-radio">
              <div v-if="!syncAllModels" class="nc-radio-dot" />
            </div>
            <div class="flex-1">
              <div class="text-sm font-semibold text-gray-800">Select specific models</div>
              <div class="text-xs text-gray-500 mt-1">Choose which models to sync</div>
            </div>
          </div>

          <!-- Model Selection Grid -->
          <div v-if="!syncAllModels" class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
            <div
              v-for="model in availableModels"
              :key="model.value"
              class="nc-model-card"
              :class="{
                'nc-model-card-selected': !formModel.exclude_models?.includes(model.value),
                'nc-model-card-disabled': model.required,
              }"
              @click="!model.required && onCheckboxChange(model.value)"
            >
              <div class="flex items-center gap-2">
                <div class="nc-model-checkbox">
                  <GeneralIcon v-if="!formModel.exclude_models?.includes(model.value)" icon="check" class="w-3 h-3 text-white" />
                </div>
                <GeneralIcon :icon="model.icon" class="w-4 h-4 text-gray-600" />
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium text-gray-800 truncate">{{ model.label }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-sync-settings {
  @apply flex flex-col gap-6;
}

.nc-settings-section {
  @apply flex flex-col gap-3;
}

.nc-section-title {
  @apply text-sm font-semibold text-gray-700 mb-1;
}

.nc-model-option {
  @apply p-4 rounded-lg border-2 border-gray-200 cursor-pointer transition-all duration-200;
  @apply hover:border-brand-300 hover:bg-brand-50/30;

  &.nc-model-option-selected {
    @apply border-brand-500 bg-brand-50/50;

    .nc-option-radio {
      @apply border-brand-500;
    }
  }
}

.nc-option-radio {
  @apply w-5 h-5 rounded-full border-2 border-gray-300 flex items-center justify-center;
  @apply transition-all duration-200;
}

.nc-radio-dot {
  @apply w-2.5 h-2.5 rounded-full bg-brand-500;
}

.nc-model-card {
  @apply p-3 rounded-lg border border-gray-200 cursor-pointer transition-all duration-200;
  @apply hover:border-brand-300 hover:bg-gray-50;

  &.nc-model-card-selected {
    @apply border-brand-500 bg-brand-50/30;

    .nc-model-checkbox {
      @apply bg-brand-500 border-brand-500;
    }
  }

  &.nc-model-card-disabled {
    @apply opacity-50 cursor-not-allowed;
  }
}

.nc-model-checkbox {
  @apply w-4 h-4 rounded border-2 border-gray-300 flex items-center justify-center;
  @apply transition-all duration-200;
}
</style>
