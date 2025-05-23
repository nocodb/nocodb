<script lang="ts" setup>
const {
  formState,
  syncConfigForm,
  selectedIntegrationIndex,
  deleteSync,
  changeIntegration,
  editMode,
  editModeModified,
  editModeAddIntegration,
  updateSync,
} = useSyncStoreOrThrow()

const { t } = useI18n()

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
      <NcButton class="!px-4" type="primary" size="small" :disabled="!editModeModified" @click="updateSync">
        Update Integration
      </NcButton>
    </div>
  </div>
</template>
