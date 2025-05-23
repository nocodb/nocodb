<script lang="ts" setup>
const { formState, selectedIntegrationIndex, changeIntegration } = useSyncStoreOrThrow()
</script>

<template>
  <div>
    <a-row :gutter="24">
      <a-col :span="24">
        <a-form-item label="Select Source" class="w-full">
          <DashboardSettingsSyncSelect :value="formState.sub_type" @change="changeIntegration" />
        </a-form-item>
      </a-col>
    </a-row>
    <NcFormBuilder v-if="formState.sub_type" :key="`${selectedIntegrationIndex}-${formState.sub_type}`" class="pt-4" />
  </div>
</template>
