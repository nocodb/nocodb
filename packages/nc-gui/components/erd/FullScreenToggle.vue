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
      'text-white bg-brand-500 md:(hover:bg-brand-600)': config.isFullScreen,
      'border-1 border-gray-200 bg-white hover:bg-gray-100': !config.isFullScreen,
    }"
    :position="PanelPosition.BottomRight"
  >
    <div class="flex">
      <MiFullscreenExit v-if="config.isFullScreen" class="h-5 w-5" @click="toggleFullScreen" />
      <MiFullscreen v-else class="h-5 w-5" @click="toggleFullScreen" />
    </div>
  </Panel>
</template>
