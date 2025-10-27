<script setup lang="ts">
import GroupedSettings from '../GroupedSettings.vue'

const emit = defineEmits<{
  'update:permission': [updates: any]
}>()

const { selectedWidget } = useWidgetStore()

const permissionData = reactive({
  allowUsersToViewRecords: selectedWidget?.config?.permission?.allowUsersToViewRecords ?? false,
  allowUserToPrint: selectedWidget?.config?.permission?.allowUserToPrint ?? false,
})

const onDataChanged = () => {
  emit('update:permission', permissionData)
}
</script>

<template>
  <GroupedSettings title="Permission">
    <div class="space-y-1">
      <div>
        <NcSwitch v-model:checked="permissionData.allowUserToPrint" @change="onDataChanged">
          <span class="text-caption text-nc-content-gray select-none">Allow users to print chart</span>
        </NcSwitch>
      </div>
      <div>
        <NcSwitch v-model:checked="permissionData.allowUsersToViewRecords" @change="onDataChanged">
          <span class="text-caption text-nc-content-gray select-none">Allow users to view records</span>
        </NcSwitch>
      </div>
    </div>
  </GroupedSettings>
</template>
