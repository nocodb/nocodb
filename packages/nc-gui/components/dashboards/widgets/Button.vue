<script lang="ts" setup>
import type { ButtonWidget } from 'nocodb-sdk'
import { ButtonActionType } from 'nocodb-sdk'
const props = defineProps<{
  widgetConfig: ButtonWidget
}>()

const { widgetConfig } = toRefs(props)

const dataLinkConfigIsMissing = computed(() => {
  return false
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
