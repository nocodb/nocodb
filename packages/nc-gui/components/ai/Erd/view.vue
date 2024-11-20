<script lang="ts" setup>
import { PanelPosition } from '@vue-flow/additional-components'
import type { AiBaseSchema, AiERDConfig } from './utils'

interface Props {
  showAllColumns?: boolean
  aiBaseSchema: AiBaseSchema
}

const props = withDefaults(defineProps<Props>(), {
  showAllColumns: true,
})

const config = reactive<AiERDConfig>({
  showPkAndFk: true,
  showViews: false,
  showAllColumns: props.showAllColumns,
  singleTableMode: false,
  showMMTables: false,
  showJunctionTableNames: false,
  isFullScreen: false,
})

const toggleFullScreen = () => {
  config.isFullScreen = !config.isFullScreen
}
</script>

<template>
  <div
    class="w-full bg-white"
    :class="{
      'z-100 h-screen w-screen fixed top-0 left-0 right-0 bottom-0': config.isFullScreen,
      'nc-erd-vue-flow-single-table': config.singleTableMode,
      'nc-erd-vue-flow': !config.singleTableMode,
    }"
  >
    <div class="relative h-full">
      <LazyAiErdFlow :ai-base-schema="aiBaseSchema" :config="config">
        <ErdFullScreenToggle :config="config" :position="PanelPosition.TopRight" @toggle-full-screen="toggleFullScreen" />
      </LazyAiErdFlow>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
