<script lang="ts" setup>
import { Panel, PanelPosition } from '@vue-flow/additional-components'
import type { ERDConfig } from './utils'
import MiFullscreen from '~icons/material-symbols/fullscreen'
import MiFullscreenExit from '~icons/material-symbols/fullscreen-exit'

const props = defineProps<{
  config: ERDConfig
}>()

const emit = defineEmits(['toggleFullScreen'])

const { config } = toRefs(props)

const toggleFullScreen = () => {
  emit('toggleFullScreen')
}
</script>

<template>
  <Panel
    class="text-xs bg-white border-1 rounded-md p-0.5 border-gray-50 z-50 nc-erd-histogram cursor-pointer hover:bg-gray-100"
    :position="PanelPosition.TopLeft"
  >
    <div class="flex">
      <MiFullscreenExit v-if="config.isFullScreen" class="h-5 w-5" @click="toggleFullScreen" />
      <MiFullscreen v-else class="h-5 w-5" @click="toggleFullScreen" />
    </div>
  </Panel>
</template>
