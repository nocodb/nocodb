<script setup lang="ts">
import GroupedSettings from '~/components/smartsheet/dashboard/widgets/common/GroupedSettings.vue'

const emit = defineEmits<{
  'update:xAxis': [xAxis: any]
}>()

const { selectedWidget } = storeToRefs(useWidgetStore())

const modelId = computed(() => selectedWidget.value?.fk_model_id || null)

const fieldConfigurations = ref(selectedWidget.value?.config?.data?.yAxis?.fields || [])

const startAtZero = ref(selectedWidget.value?.config?.data?.yAxis?.startAtZero || false)

const groupByField = ref(selectedWidget.value?.config?.data?.yAxis?.groupByField || null)

const handleChange = () => {
  emit('update:xAxis', {
    fields: fieldConfigurations.value,
    startAtZero: startAtZero.value,
    groupByField: groupByField.value,
  })
}
</script>

<template>
  <GroupedSettings title="Y-axis">
    <div class="flex flex-col gap-2 flex-1 min-w-0">
      <label>Fields</label>

      <div class="flex flex-col border-1 border-nc-content-gray-medium rounded-lg overflow-hidden">
        <div
          class="flex items-center gap-2 text-nc-content-brand text-captionDropdownDefault cursor-pointer hover:bg-nc-bg-gray-light px-3 py-2"
          @click="
            () => {
              fieldConfigurations.push({})
            }
          "
        >
          <GeneralIcon icon="ncPlus" />
          Add Field
        </div>
        <div v-for="(field, index) in fieldConfigurations" :key="index" class="flex border-b-1 border-nc-border-gray-medium">
          <NcDropdown>
            <NcButton size="xsmall" type="text" class="!w-7 !h-7">
              <GeneralIcon icon="ncChevronDown" class="w-4 h-4" />
            </NcButton>
            <template #overlay> Lol </template>
          </NcDropdown>
        </div>
      </div>
    </div>

    <div class="flex flex-col gap-2 flex-1 min-w-0">
      <label>Group by field</label>
      <NcListColumnSelector
        v-model:value="groupByField"
        disable-label
        :table-id="modelId"
        @update:value="groupByField = $event"
      />
    </div>

    <div>
      <NcSwitch v-model:checked="startAtZero" @change="handleChange">
        <span class="text-caption text-nc-content-gray select-none">Start at zero</span>
      </NcSwitch>
    </div>
  </GroupedSettings>
</template>
