<script lang="ts" setup>
import type { ButtonWidget } from 'nocodb-sdk'
import { ButtonActionType } from 'nocodb-sdk'
import useLayoutsContextMenu from './useLayoutsContextMenu'
const props = defineProps<{
  widgetConfig: ButtonWidget
}>()

const { widgetConfig } = toRefs(props)
const { showContextMenuButtonRef, isContextMenuVisible, showContextMenu } = useLayoutsContextMenu()

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
  <div class="flex justify-end">
    <button ref="showContextMenuButtonRef" @click="showContextMenu">
      <GeneralIcon icon="threeDotHorizontal" class="text-gray-900 text-xl" />
    </button>
  </div>
  <div v-if="dataLinkConfigIsMissing">Missing Data Source Configuration</div>
  <a-button v-else @click="handleButtonClick">{{ widgetConfig.data_config.buttonText }}</a-button>
  <LayoutsWidgetsContextMenu v-if="isContextMenuVisible" :widget="widgetConfig" @reload-widget-data="getData" />
</template>

<style></style>
