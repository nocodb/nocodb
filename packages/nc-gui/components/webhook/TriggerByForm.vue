<script setup lang="ts">
import { type ViewType, ViewTypes } from 'nocodb-sdk'

interface Props {
  tableId: string
  triggerForm?: boolean
  triggerFormId?: string
}

const props = defineProps<Props>()

const viewStore = useViewsStore()

const { viewsByTable } = storeToRefs(viewStore)

const filterView = (v: ViewType) => {
  return v.type === ViewTypes.FORM
}

const formOptions = computed(() => {
  const views = viewsByTable.value.get(props.tableId) || []
  return views.filter(filterView).map((view) => ({
    label: view.title,
    value: view.id,
  }))
})

const triggerForm = useVModel(props, 'triggerForm')
const triggerFormId = useVModel(props, 'triggerFormId')

const onChangeTriggerForm = (val: boolean) => {
  if (!val) {
    triggerFormId.value = undefined
  }
}

onMounted(() => {
  if (triggerFormId.value && formOptions.value.every((o) => o.value !== triggerFormId.value)) {
    triggerFormId.value = undefined
  }
  if (formOptions.value.length === 0) {
    triggerForm.value = false
  }
})
</script>

<template>
  <div class="w-full flex items-center justify-between h-[28px]">
    <label class="cursor-pointer flex items-center" @click.prevent="triggerForm = !triggerForm">
      <NcSwitch
        :checked="triggerForm"
        class="nc-check-box-trigger-field"
        :disabled="formOptions.length === 0"
        @change="onChangeTriggerForm"
      >
        <span class="!text-gray-700 font-semibold"> Trigger only when specific form submitted </span>
      </NcSwitch>
    </label>
    <NcListViewSelector
      v-if="triggerForm"
      v-model:value="triggerFormId"
      :table-id="tableId"
      :filter-view="filterView"
      :disable-label="true"
      size="small"
      class="w-50"
    />
  </div>
</template>
