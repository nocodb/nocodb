<script setup lang="ts">
const props = defineProps<{
  modelValue: any
}>()

const emit = defineEmits(['update:modelValue'])

const { t } = useI18n()

const workspaceStore = useWorkspace()
const { activeWorkspaceId } = storeToRefs(workspaceStore)

const vModel = useVModel(props, 'modelValue', emit)

const { setAdditionalValidations } = useColumnCreateStoreOrThrow()

setAdditionalValidations({ fk_integration_id: [{ required: true, message: t('general.required') }] })
</script>

<template>
  <div class="nc-nocoai-footer">
    <!-- Footer -->
    <div class="nc-ai-footer-branding text-xs">
      Powered by
      <span class="font-semibold !text-inherit"> Noco AI </span>
    </div>

    <AiSettings
      v-model:fk-integration-id="vModel.fk_integration_id"
      v-model:model="vModel.model"
      v-model:randomness="vModel.randomness"
      :workspace-id="activeWorkspaceId"
      :show-tooltip="false"
      placement="bottom"
    >
      <NcButton size="xs" theme="ai" class="!px-1" type="text">
        <GeneralIcon icon="settings" />
      </NcButton>
    </AiSettings>
  </div>
</template>

<style lang="scss" scoped>
.nc-nocoai-footer {
  @apply px-5 py-1 flex items-center gap-2 text-nc-content-purple-dark border-t-1 border-purple-100;
}
</style>
