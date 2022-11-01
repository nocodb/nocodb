<script lang="ts" setup>
import { Panel, PanelPosition } from '@vue-flow/additional-components'
import type { ERDConfig } from './utils'
import { ref, useGlobal, useVModel } from '#imports'

const props = defineProps<{
  config: ERDConfig
}>()

const { includeM2M } = useGlobal()

const config = useVModel(props, 'config')

const showAdvancedOptions = ref(false)
</script>

<template>
  <Panel
    class="flex flex-col bg-white border-1 rounded border-gray-200 z-50 px-3 py-1 nc-erd-context-menu"
    :position="PanelPosition.TopRight"
  >
    <div class="flex items-center gap-2">
      <a-checkbox v-model:checked="config.showAllColumns" v-e="['c:erd:showAllColumns']" class="nc-erd-showColumns-checkbox" />
      <span class="select-none nc-erd-showColumns-label" style="font-size: 0.65rem" @dblclick="showAdvancedOptions = true">
        {{ $t('activity.erd.showColumns') }}
      </span>
    </div>

    <div class="flex items-center gap-2">
      <a-checkbox
        v-model:checked="config.showPkAndFk"
        v-e="['c:erd:showPkAndFk']"
        class="nc-erd-showPkAndFk-checkbox"
        :class="[
          `nc-erd-showPkAndFk-checkbox-${config.showAllColumns ? 'enabled' : 'disabled'}`,
          `nc-erd-showPkAndFk-checkbox-${config.showPkAndFk ? 'checked' : 'unchecked'}`,
        ]"
        :disabled="!config.showAllColumns"
      />
      <span class="select-none text-[0.65rem]">{{ $t('activity.erd.showPkAndFk') }}</span>
    </div>

    <div v-if="!config.singleTableMode" class="flex items-center gap-2">
      <a-checkbox v-model:checked="config.showViews" v-e="['c:erd:showViews']" class="nc-erd-showViews-checkbox" />
      <span class="select-none text-[0.65rem]">{{ $t('activity.erd.showSqlViews') }}</span>
    </div>

    <div v-if="!config.singleTableMode && showAdvancedOptions && includeM2M" class="flex flex-row items-center">
      <a-checkbox v-model:checked="config.showMMTables" v-e="['c:erd:showMMTables']" class="nc-erd-showMMTables-checkbox" />
      <span class="ml-2 select-none text-[0.65rem]">{{ $t('activity.erd.showMMTables') }}</span>
    </div>

    <div v-if="showAdvancedOptions && includeM2M" class="flex items-center gap-2">
      <a-checkbox
        v-model:checked="config.showJunctionTableNames"
        v-e="['c:erd:showJunctionTableNames']"
        class="nc-erd-showJunctionTableNames-checkbox"
      />
      <span class="select-none text-[0.65rem]">{{ $t('activity.erd.showJunctionTableNames') }}</span>
    </div>
  </Panel>
</template>
