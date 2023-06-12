<script lang="ts" setup>
import { Panel, PanelPosition } from '@vue-flow/additional-components'
import { iconMap } from '#imports'
</script>

<template>
  <Panel class="text-xs bg-white border-1 rounded border-gray-200 z-50 nc-erd-histogram" :position="PanelPosition.BottomRight">
    <div class="flex flex-col divide-y-1">
      <div class="flex items-center gap-1 p-2">
        <component :is="iconMap.table" class="text-primary" />
        <div>{{ $t('objects.table') }}</div>
      </div>

      <div class="flex items-center gap-1 p-2">
        <component :is="iconMap.eye" class="text-primary" />
        <div>{{ $t('objects.sqlVIew') }}</div>
      </div>
    </div>
  </Panel>
</template>
