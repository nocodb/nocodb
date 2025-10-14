<script lang="ts" setup>
const {
  formState,
  syncConfigForm,
  syncConfigEditForm,
  selectedIntegrationIndex,
  deleteSync,
  changeIntegration,
  editMode,
  editModeModified,
  editModeAddIntegration,
  updateSync,
} = useSyncStoreOrThrow()

const { t } = useI18n()

const destinationSchemaModalVisible = ref(false)

const onUpdateSync = async () => {
  if (syncConfigEditForm.value?.sync_category === 'custom') {
    destinationSchemaModalVisible.value = true
    return
  }

  await updateSync()
}

const onDeleteSync = async () => {
  Modal.confirm({
    title: 'Do you want to delete this integration?',
    type: 'warning',
    onOk: async () => {
      try {
        await deleteSync(formState.value.syncConfigId)
      } catch (e: any) {
        message.error(`${t('msg.error.deleteFailed')}: ${await extractSdkResponseErrorMsg(e)}`)
      }
    },
  })
}
</script>

<template>
  <div>
    <a-row v-if="!editMode || editModeAddIntegration" :gutter="24" :class="{ 'mb-4': editMode }">
      <a-col :span="24">
        <a-form-item label="Select Source" class="w-full">
          <DashboardSettingsSyncSelect
            :value="formState.sub_type"
            :category="syncConfigForm.sync_category"
            @change="changeIntegration"
          />
        </a-form-item>
      </a-col>
    </a-row>
    <NcFormBuilder
      v-if="formState.sub_type"
      :key="`${selectedIntegrationIndex}-${formState.sub_type}`"
      class="pt-4"
      @change="editModeModified = true"
    />
    <div v-if="editMode" class="flex justify-between">
      <NcTooltip v-if="!formState.parentSyncConfigId" placement="top">
        <template #title> You can't delete first integration </template>
        <NcButton class="!px-4" type="danger" size="small" disabled> Delete Integration </NcButton>
      </NcTooltip>
      <NcButton v-else class="!px-4" type="danger" size="small" @click="onDeleteSync"> Delete Integration </NcButton>
      <NcButton
        v-if="syncConfigEditForm?.sync_category === 'custom'"
        class="!px-4"
        type="primary"
        size="small"
        @click="onUpdateSync"
      >
        Table Mapping
      </NcButton>
      <NcButton v-else class="!px-4" type="primary" size="small" :disabled="!editModeModified" @click="onUpdateSync">
        Update Integration
      </NcButton>
    </div>
    <GeneralModal
      v-if="destinationSchemaModalVisible"
      v-model:visible="destinationSchemaModalVisible"
      size="large"
      :mask-closable="false"
      closable
    >
      <div class="h-[80vh] overflow-y-auto">
        <DashboardSettingsSyncDestinationSchema @update:sync="destinationSchemaModalVisible = false" />
      </div>
    </GeneralModal>
  </div>
</template>
