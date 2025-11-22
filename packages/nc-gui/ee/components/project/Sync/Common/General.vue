<script setup lang="ts">
import { OnDeleteActionMeta, SyncTrigger, SyncTriggerMeta, SyncTypeMeta } from 'nocodb-sdk'
import { useSyncFormOrThrow } from '../useSyncForm'

const { syncConfigForm, mode, syncConfigEditFormChanged, validateInfosSyncConfig } = useSyncFormOrThrow()

const syncTypeOptions = Object.values(SyncTypeMeta)
const syncTriggerOptions = Object.values(SyncTriggerMeta).filter((s) => s.value !== SyncTrigger.Webhook)
const onDeleteActionOptions = Object.values(OnDeleteActionMeta)

const formModel = computed(() => {
  return mode === 'create' ? syncConfigForm.value : syncConfigForm.value
})

const isSyncTypeOpen = ref(false)
const isOnDeleteActionOpen = ref(false)
const isSyncTriggerOpen = ref(false)

const currentSyncType = computed(() => syncTypeOptions.find((opt) => opt.value === formModel.value.sync_type))
const currentOnDeleteAction = computed(() => onDeleteActionOptions.find((opt) => opt.value === formModel.value.on_delete_action))
const currentSyncTrigger = computed(() => syncTriggerOptions.find((opt) => opt.value === formModel.value.sync_trigger))
</script>

<template>
  <div class="nc-form-section">
    <div class="nc-form-section-title">
      {{ $t('general.general') }}
    </div>
    <div class="nc-form-section-body">
      <a-form-item class="px-0.5" :label="$t('labels.syncName')" v-bind="validateInfosSyncConfig.title">
        <a-input
          v-model:value="formModel.title"
          class="nc-input-shadow nc-input-sm !rounded-md"
          :placeholder="$t('placeholder.enterSyncName')"
          @change="syncConfigEditFormChanged = true"
        />
      </a-form-item>
    </div>

    <div class="nc-form-section-body">
      <a-row :gutter="24">
        <a-col :span="12">
          <a-form-item class="flex-1" :label="$t('labels.syncType')" v-bind="validateInfosSyncConfig.sync_type">
            <NcListDropdown v-model:is-open="isSyncTypeOpen" tooltip-wrapper-class="w-full" placement="bottomLeft">
              <div class="flex-1 flex items-center gap-2 justify-between">
                <span class="flex-1 whitespace-nowrap">{{ currentSyncType?.label || 'Select sync type' }}</span>
                <GeneralIcon
                  icon="chevronDown"
                  class="flex-none h-4 w-4 transition-transform text-nc-content-gray-subtle"
                  :class="{ 'transform rotate-180': isSyncTypeOpen }"
                />
              </div>
              <template #overlay="{ onEsc }">
                <NcList
                  v-model:open="isSyncTypeOpen"
                  v-model:value="formModel.sync_type"
                  :list="syncTypeOptions"
                  option-label-key="value"
                  option-value-key="value"
                  close-on-select
                  class="!w-auto"
                  wrapper-class-name="!h-auto"
                  @escape="onEsc"
                >
                  <template #listItem="{ option }">
                    <div class="!w-80">
                      <div class="w-full flex items-center justify-between">
                        <span class="text-captionDropdownDefault">{{ option.label }}</span>
                        <GeneralIcon v-if="option.value === formModel.sync_type" icon="check" class="text-primary h-4 w-4" />
                      </div>
                      <div class="text-bodySm text-nc-content-gray-muted">{{ option.description }}</div>
                    </div>
                  </template>
                </NcList>
              </template>
            </NcListDropdown>
          </a-form-item>
        </a-col>

        <a-col :span="12">
          <a-form-item class="flex-1" :label="$t('labels.onDelete')" v-bind="validateInfosSyncConfig.on_delete_action">
            <NcListDropdown v-model:is-open="isOnDeleteActionOpen" tooltip-wrapper-class="w-full" placement="bottomLeft">
              <div class="flex-1 flex items-center gap-2 justify-between">
                <span class="flex-1 whitespace-nowrap">{{ currentOnDeleteAction?.label || 'Select action' }}</span>
                <GeneralIcon
                  icon="chevronDown"
                  class="flex-none h-4 w-4 transition-transform text-nc-content-gray-subtle"
                  :class="{ 'transform rotate-180': isOnDeleteActionOpen }"
                />
              </div>
              <template #overlay="{ onEsc }">
                <NcList
                  v-model:open="isOnDeleteActionOpen"
                  v-model:value="formModel.on_delete_action"
                  :list="onDeleteActionOptions"
                  option-label-key="value"
                  option-value-key="value"
                  close-on-select
                  :item-height="48"
                  class="!w-auto"
                  wrapper-class-name="!h-auto"
                  @escape="onEsc"
                >
                  <template #listItem="{ option }">
                    <div class="!w-70">
                      <div class="w-full flex items-center justify-between">
                        <span class="text-captionDropdownDefault">{{ option.label }}</span>
                        <GeneralIcon
                          v-if="option.value === formModel.on_delete_action"
                          icon="check"
                          class="text-primary h-4 w-4"
                        />
                      </div>
                      <div class="text-bodySm text-nc-content-gray-muted">{{ option.description }}</div>
                    </div>
                  </template>
                </NcList>
              </template>
            </NcListDropdown>
          </a-form-item>
        </a-col>
      </a-row>
    </div>

    <div class="nc-form-section-body">
      <a-row :gutter="24">
        <a-col :span="12">
          <a-form-item class="flex-1" :label="$t('labels.syncTrigger')" v-bind="validateInfosSyncConfig.sync_trigger">
            <NcListDropdown v-model:is-open="isSyncTriggerOpen" tooltip-wrapper-class="w-full" placement="bottomLeft">
              <div class="flex-1 flex items-center w-full gap-2 justify-between">
                <span class="flex-1 whitespace-nowrap">{{ currentSyncTrigger?.label || 'Select trigger' }}</span>
                <GeneralIcon
                  icon="chevronDown"
                  class="flex-none h-4 w-4 transition-transform text-nc-content-gray-subtle"
                  :class="{ 'transform rotate-180': isSyncTriggerOpen }"
                />
              </div>
              <template #overlay="{ onEsc }">
                <NcList
                  v-model:open="isSyncTriggerOpen"
                  v-model:value="formModel.sync_trigger"
                  :list="syncTriggerOptions"
                  option-label-key="value"
                  option-value-key="value"
                  close-on-select
                  :item-height="48"
                  class="!w-auto"
                  wrapper-class-name="!h-auto"
                  @escape="onEsc"
                  @change="formModel.sync_trigger_cron = undefined"
                >
                  <template #listItem="{ option }">
                    <div class="!w-80">
                      <div class="w-full flex items-center justify-between">
                        <span class="text-captionDropdownDefault">{{ option.label }}</span>
                        <GeneralIcon v-if="option.value === formModel.sync_trigger" icon="check" class="text-primary h-4 w-4" />
                      </div>
                      <div class="text-bodySm text-nc-content-gray-muted">{{ option.description }}</div>
                    </div>
                  </template>
                </NcList>
              </template>
            </NcListDropdown>
          </a-form-item>
        </a-col>

        <a-col :span="12">
          <a-form-item
            v-if="formModel.sync_trigger === SyncTrigger.Schedule"
            class="flex-1"
            :label="$t('labels.syncSchedule')"
            v-bind="validateInfosSyncConfig.sync_trigger_cron"
          >
            <ProjectSyncCommonSchedule
              v-model:model-value="formModel.sync_trigger_cron"
              @change="syncConfigEditFormChanged = true"
            />
          </a-form-item>

          <div v-else class="flex-1"></div>
        </a-col>
      </a-row>
    </div>
  </div>
</template>

<style scoped lang="scss">
:deep(.ant-form-item) {
  @apply !mb-0;
}
</style>
