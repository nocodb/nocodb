<script setup lang="ts">
import { SyncCategory } from 'nocodb-sdk'
import { useProvideSyncForm } from '../useSyncForm'
import { SyncFormStep } from '#imports'

interface Props {
  value: boolean
  baseId: string
}

interface Emits {
  (event: 'update:value', value: boolean): void
  (event: 'syncCreated', jobId: string): void
}

const props = defineProps<Props>()

const emits = defineEmits<Emits>()

const vOpen = useVModel(props, 'value', emits)

const {
  validateSyncConfig,
  syncConfigForm,
  validateIntegrationConfigs,
  integrationConfigs,
  step,
  saveSyncConfig,
  isSaving,
  supportedDocs,
  isSyncCategoryAlreadyAddedOrBlank,
} = useProvideSyncForm(props.baseId, 'create')

const saveError = ref<string | null>(null)

const isContinueDisabled = computed(() => {
  return (
    (step.value === SyncFormStep.Integration && integrationConfigs.value?.length === 0) ||
    isSyncCategoryAlreadyAddedOrBlank.value.value
  )
})

const closeModal = () => {
  vOpen.value = false
}

const nextStep = async () => {
  switch (step.value) {
    case SyncFormStep.SyncSettings:
      await validateSyncConfig()
      step.value = SyncFormStep.Integration
      break
    case SyncFormStep.Integration:
      if (await validateIntegrationConfigs()) {
        step.value =
          syncConfigForm.value?.sync_category === SyncCategory.CUSTOM ? SyncFormStep.DestinationSchema : SyncFormStep.Create
      }
      break
    case SyncFormStep.DestinationSchema:
      step.value = SyncFormStep.Create
      break
    case SyncFormStep.Create:
      try {
        saveError.value = null
        const jobId = await saveSyncConfig()
        if (jobId) {
          vOpen.value = false
          emits('syncCreated', jobId)
        }
      } catch (error: any) {
        console.error('Failed to create sync:', error)
        saveError.value = error?.message || 'Failed to create sync'
      }
      break
  }
}

const previousStep = () => {
  switch (step.value) {
    case SyncFormStep.SyncSettings:
      break
    case SyncFormStep.Integration:
      step.value = SyncFormStep.SyncSettings
      break
    case SyncFormStep.DestinationSchema:
      step.value = SyncFormStep.Integration
      break
    case SyncFormStep.Create:
      step.value =
        syncConfigForm.value?.sync_category === SyncCategory.CUSTOM ? SyncFormStep.DestinationSchema : SyncFormStep.Integration
      break
  }
}
</script>

<template>
  <NcModal v-model:visible="vOpen" centered size="large" wrap-class-name="nc-modal-create-sync" @keydown.esc="closeModal">
    <template #header>
      <div class="flex w-full items-center pl-4 pr-3 py-3 justify-between">
        <div class="flex items-center gap-3 flex-1">
          <GeneralIcon class="text-green-700 h-5 w-5" icon="sync" />
          <div class="text-base font-weight-700">
            {{ $t('labels.newSync') }}
          </div>
        </div>
        <ProjectSyncCreateSteps :current="step" />

        <div class="flex justify-end items-center gap-3 flex-1">
          <NcButton
            :disabled="step === SyncFormStep.SyncSettings"
            type="secondary"
            size="small"
            inner-class="!gap-2"
            @click="previousStep"
          >
            {{ $t('labels.back') }}

            <template #icon>
              <GeneralIcon icon="chevronDown" class="transform rotate-90" />
            </template>
          </NcButton>

          <NcTooltip :disabled="(!saveError || step !== SyncFormStep.Create) && !isSyncCategoryAlreadyAddedOrBlank.value">
            <template #title>
              {{ isSyncCategoryAlreadyAddedOrBlank.value ? isSyncCategoryAlreadyAddedOrBlank.tooltip : saveError }}
            </template>
            <NcButton
              type="primary"
              size="small"
              data-testid="nc-continue-sync-form"
              :disabled="isContinueDisabled"
              :loading="step === SyncFormStep.Create && isSaving"
              icon-position="right"
              inner-class="!gap-2"
              @click="nextStep"
            >
              <template v-if="step === SyncFormStep.Create && saveError" #icon>
                <GeneralIcon icon="alertTriangleSolid" class="!text-red-700 w-4 h-4 flex-none" />
              </template>
              <template v-else-if="step !== SyncFormStep.Create" #icon>
                <GeneralIcon icon="chevronDown" class="transform rotate-270" />
              </template>
              <span>
                <template v-if="step === SyncFormStep.Create">
                  {{ $t('general.create') }}
                </template>
                <template v-else>
                  {{ $t('labels.next') }}
                </template>
              </span>
            </NcButton>
          </NcTooltip>
          <NcButton type="text" size="small" data-testid="nc-close-sync-modal" @click.stop="closeModal">
            <GeneralIcon icon="close" />
          </NcButton>
        </div>
      </div>
    </template>

    <div class="h-[calc(100%_-_50px)] flex">
      <!-- Content -->
      <div class="flex-1 nc-modal-sync-edit-content h-full">
        <div ref="containerElem" class="h-full flex-1 flex flex-col overflow-auto nc-scrollbar-thin px-6 md:px-12 mx-auto">
          <div class="max-w-[640px] min-w-[564px] w-full mx-auto gap-8 my-6 flex flex-col">
            <a-form layout="vertical" no-style :hide-required-mark="true" class="flex flex-col gap-8 w-full">
              <template v-if="step === SyncFormStep.SyncSettings">
                <ProjectSyncCommonGeneral />
                <ProjectSyncCommonCategory />
              </template>
              <template v-else-if="step === SyncFormStep.Integration">
                <ProjectSyncCommonSources />
              </template>
              <template v-else-if="step === SyncFormStep.DestinationSchema">
                <ProjectSyncCommonSchemaMapping />
              </template>
              <template v-else-if="step === SyncFormStep.Create">
                <ProjectSyncCreateReview />
              </template>
            </a-form>
          </div>
        </div>
      </div>

      <NcModalSupportedDocsSidebar>
        <NcModalSupportedDocs :docs="supportedDocs"> </NcModalSupportedDocs>
      </NcModalSupportedDocsSidebar>
    </div>
  </NcModal>
</template>

<style lang="scss">
.nc-modal-create-sync {
  .nc-modal {
    @apply !p-0;
    height: min(calc(100vh - 100px), 1024px);
    max-height: min(calc(100vh - 100px), 1024px) !important;
  }

  .nc-modal-header {
    @apply !mb-0 !pb-0;
  }
}
</style>
