<script setup lang="ts">
import { useProvideSyncForm } from '../useSyncForm'

interface Props {
  value: boolean
  syncId: string
  baseId: string
}

interface Emits {
  (event: 'update:value', value: boolean): void
  (event: 'syncUpdated'): void
}

const props = defineProps<Props>()

const emits = defineEmits<Emits>()

const vOpen = useVModel(props, 'value', emits)

const activeTab = ref('general')

const {
  validateSyncConfig,
  syncConfigForm,
  validateIntegrationConfigs,
  updateSyncConfig,
  isUpdating,
  supportedDocs,
  isLoadingIntegrationConfigs,
} = useProvideSyncForm(props.baseId, 'edit', props.syncId)

const updateError = ref<string | null>(null)

const closeModal = () => {
  vOpen.value = false
}

const handleUpdate = async () => {
  try {
    updateError.value = null

    await validateSyncConfig()

    const isValid = await validateIntegrationConfigs()
    if (!isValid) {
      updateError.value = 'Please fix validation errors in integration configurations'
      return
    }

    await updateSyncConfig()

    emits('syncUpdated')
    vOpen.value = false
  } catch (error: any) {
    console.error('Failed to update sync:', error)
    updateError.value = error?.message || 'Failed to update sync'
  }
}
</script>

<template>
  <NcModal v-model:visible="vOpen" centered size="large" wrap-class-name="nc-modal-edit-sync" @keydown.esc="closeModal">
    <template #header>
      <div class="flex w-full items-center pl-4 pr-3 py-3 justify-between">
        <div class="flex items-center gap-3 flex-1">
          <GeneralIcon class="text-green-700 h-5 w-5" icon="sync" />
          <div class="text-base font-weight-700">{{ syncConfigForm.title }}</div>
        </div>

        <ProjectSyncEditTab v-model:model-value="activeTab" />

        <div class="flex justify-end items-center gap-3 flex-1">
          <NcTooltip :disabled="!updateError">
            <template #title>
              {{ updateError }}
            </template>
            <NcButton
              type="primary"
              size="small"
              data-testid="nc-update-sync-form"
              icon-position="right"
              :loading="isUpdating"
              @click="handleUpdate"
            >
              <template v-if="updateError" #icon>
                <GeneralIcon icon="alertTriangleSolid" class="!text-red-700 w-4 h-4 flex-none" />
              </template>
              <span>{{ $t('labels.updateSync') }}</span>
            </NcButton>
          </NcTooltip>
          <NcButton type="text" size="small" data-testid="nc-close-sync-modal" @click.stop="closeModal">
            <GeneralIcon icon="close" />
          </NcButton>
        </div>
      </div>
    </template>

    <div class="h-[calc(100%_-_61px)] flex">
      <div class="flex-1 nc-modal-sync-edit-content h-full nc-scrollbar-thin relative">
        <div class="flex flex-col py-6 px-6 md:px-8 max-w-[768px] w-full min-w-[664px] mx-auto">
          <a-form layout="vertical" no-style :hide-required-mark="true" class="flex flex-col gap-8 w-full">
            <div v-show="activeTab === 'general'" class="flex flex-col gap-8">
              <ProjectSyncCommonGeneral />
              <ProjectSyncCommonCategory />
            </div>
            <div v-show="activeTab === 'sources'">
              <ProjectSyncCommonSources />
            </div>
            <div v-show="activeTab === 'schema'">
              <ProjectSyncCommonSchemaMapping />
            </div>
          </a-form>
        </div>
        <general-overlay :model-value="isLoadingIntegrationConfigs" inline transition class="!bg-opacity-15">
          <div class="flex items-center justify-center h-full w-full !bg-white !bg-opacity-85 z-1000">
            <a-spin size="large" />
          </div>
        </general-overlay>
      </div>

      <NcModalSupportedDocsSidebar>
        <NcModalSupportedDocs :docs="supportedDocs"> </NcModalSupportedDocs>
        <NcDivider class="!my-5" />
        <ProjectSyncEditMetaInfo />
      </NcModalSupportedDocsSidebar>
    </div>
  </NcModal>
</template>

<style lang="scss">
.nc-modal-edit-sync {
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
