<script lang="ts" setup>
import { Panel, PanelPosition } from '@vue-flow/additional-components'
</script>

<template>
  <Panel
    class="text-xs bg-white border-1 rounded border-gray-200 shadow-md p-1.5 z-50 nc-erd-histogram"
    :position="PanelPosition.TopLeft"
  >
    <div class="flex flex-col">
      <div class="flex items-center gap-1.5 p-2">
        <component :is="iconMap.table" class="!text-gray-600/75" />
        <div>{{ $t('objects.table') }}</div>
      </div>

      <div class="flex items-center gap-1.5 p-2">
        <component :is="iconMap.eye" />
        <div>{{ $t('objects.sqlVIew') }}</div>
      </div>
    </div>
  </Panel>
</template>
