<script lang="ts" setup>
import type { ButtonWidget } from 'nocodb-sdk'
import { ButtonActionType, DataConfigNumber, DataSourceInternal } from 'nocodb-sdk'
const props = defineProps<{
  widgetConfig: ButtonWidget
}>()

const { widgetConfig } = toRefs(props)

const dataLinkConfigIsMissing = computed(() => {
  return false
  // const data_source = numberWidget.value?.data_source as DataSourceInternal
  // const data_config = numberWidget.value?.data_config as DataConfigNumber
  // console.log(data_source)
  // return (
  //   !data_source ||
  //   !data_source?.projectId ||
  //   !data_source?.tableId ||
  //   !data_source.viewId ||
  //   !data_config.colId ||
  //   !data_config.aggregateFunction
  // )
})

const handleButtonClick = () => {
  switch (widgetConfig.value.data_config.actionType) {
    case ButtonActionType.OPEN_EXTERNAL_URL: {
      window.open(widgetConfig.value.data_config.url, '_blank')
    }
  }
}
</script>

<template>
  <div>
    <div v-if="dataLinkConfigIsMissing">Missing Data Source Configuration</div>
    <a-button v-else @click="handleButtonClick">{{ widgetConfig.data_config.buttonText }}</a-button>
  </div>
</template>

<style></style>
