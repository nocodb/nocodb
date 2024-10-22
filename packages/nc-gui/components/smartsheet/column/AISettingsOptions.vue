<script setup lang="ts">
const props = defineProps<{
  modelValue: any
}>()

const emit = defineEmits(['update:modelValue'])

const { t } = useI18n()

const workspaceStore = useWorkspace()
const { activeWorkspaceId } = storeToRefs(workspaceStore)

const vModel = useVModel(props, 'modelValue', emit)

const { setAdditionalValidations, isEdit } = useColumnCreateStoreOrThrow()

const { aiIntegrationAvailable } = useNocoAi()

if (!isEdit.value) {
  vModel.value.fk_integration_id = vModel.value?.colOptions?.fk_integration_id
}

setAdditionalValidations({ fk_integration_id: [{ required: true, message: t('general.required') }] })
</script>

<template>
  <AiSettings
    v-model:fk-integration-id="vModel.fk_integration_id"
    v-model:model="vModel.model"
    v-model:randomness="vModel.randomness"
    :workspace-id="activeWorkspaceId"
    :show-tooltip="false"
    placement="bottom"
  >
    <NcButton size="xs" theme="ai" class="!px-1" type="text" >
      <GeneralIcon icon="settings" />
    </NcButton>
  </AiSettings>
</template>
