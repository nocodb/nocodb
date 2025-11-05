<script lang="ts" setup>
import { Panel, PanelPosition } from '@vue-flow/additional-components'
import type { ERDConfig } from './utils'
import MiFullscreen from '~icons/material-symbols/fullscreen'
import MiFullscreenExit from '~icons/material-symbols/fullscreen-exit'

const props = defineProps<{
  config:
    | ERDConfig
    | {
        isFullScreen: boolean
      }
}>()

const emit = defineEmits(['toggleFullScreen'])

const { config } = toRefs(props)

const toggleFullScreen = () => {
  emit('toggleFullScreen')
}
</script>

<template>
  <Panel
    class="text-xs rounded-md p-2 z-50 nc-erd-histogram cursor-pointer shadow-md transition-colors"
    :class="{
      'text-white bg-nc-brand-500 md:(hover:bg-nc-brand-600)': config.isFullScreen,
      'border-1 border-nc-border-gray-medium bg-nc-bg-default hover:bg-nc-bg-gray-light': !config.isFullScreen,
    }"
    :position="PanelPosition.BottomRight"
  >
    <div class="flex">
      <MiFullscreenExit v-if="config.isFullScreen" class="h-5 w-5" @click="toggleFullScreen" />
      <MiFullscreen v-else class="h-5 w-5" @click="toggleFullScreen" />
    </div>
  </Panel>
</template>
