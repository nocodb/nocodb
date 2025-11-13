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

const { validateSyncConfig, syncConfigForm, validateIntegrationConfigs, updateSyncConfig, isUpdating } = useProvideSyncForm(
  props.baseId,
  'edit',
  props.syncId,
)

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

const supportedDocs = [
  {
    title: 'Getting started',
    href: 'https://nocodb.com/docs/product-docs/automation/webhook/create-webhook',
  },
  {
    title: 'Create webhook',
    href: 'https://nocodb.com/docs/product-docs/automation/webhook',
  },
  {
    title: 'Custom payload',
    href: 'https://nocodb.com/docs/product-docs/automation/webhook/create-webhook#webhook-with-custom-payload-',
  },
  {
    title: 'Trigger on condition',
    href: 'https://nocodb.com/docs/product-docs/automation/webhook/create-webhook#webhook-with-conditions',
  },
]
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
              <span>Update Sync</span>
            </NcButton>
          </NcTooltip>
          <NcButton type="text" size="small" data-testid="nc-close-sync-modal" @click.stop="closeModal">
            <GeneralIcon icon="close" />
          </NcButton>
        </div>
      </div>
    </template>

    <div class="h-[calc(100%_-_50px)] flex">
      <div class="flex-1 nc-modal-teams-edit-content">
        <div
          ref="containerElem"
          class="h-full flex-1 flex flex-col overflow-y-auto scroll-smooth nc-scrollbar-thin px-6 md:px-12 mx-auto"
        >
          <div class="max-w-[640px] min-w-[564px] w-full mx-auto gap-8 my-6 flex flex-col">
            <a-form layout="vertical" no-style :hide-required-mark="true" class="flex flex-col w-full">
              <div v-show="activeTab === 'general'">
                <ProjectSyncCommonGeneral />
                <ProjectSyncCommonCategory />
              </div>
              <div v-show="activeTab === 'sources'">
                <ProjectSyncCommonSources />
              </div>
            </a-form>
          </div>
        </div>
      </div>

      <NcModalSupportedDocsSidebar>
        <NcModalSupportedDocs :docs="supportedDocs" />
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
