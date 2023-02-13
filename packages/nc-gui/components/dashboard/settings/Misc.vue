<script setup lang="ts">
import { useGlobal, useProject, watch } from '#imports'

const { includeM2M, showNull, showNullAndEmptyInFilter } = useGlobal()

const { loadTables } = useProject()

watch(includeM2M, async () => await loadTables())
</script>

<template>
  <div class="flex flex-row w-full">
    <div class="flex flex-col w-full">
      <div class="flex flex-row items-center w-full mb-4 gap-2">
        <!-- Show M2M Tables -->
        <a-checkbox v-model:checked="includeM2M" v-e="['c:themes:show-m2m-tables']" class="nc-settings-meta-misc">
          {{ $t('msg.info.showM2mTables') }} <br/>
          <span class="text-gray-500">{{ $t('msg.info.showM2mTablesDesc')}}</span>
        </a-checkbox>
      </div>
      <div class="flex flex-row items-center w-full mb-4 gap-2">
        <!-- Show NULL -->
        <a-checkbox v-model:checked="showNull" v-e="['c:settings:show-null']" class="nc-settings-show-null">
          {{ $t('msg.info.showNullInCells')}} <br/>
          <span class="text-gray-500">{{ $t('msg.info.showNullInCellsDesc')}}</span>
        </a-checkbox>
      </div>
      <div class="flex flex-row items-center w-full mb-4 gap-2">
        <!-- Show NULL and EMPTY in Filters -->
        <a-checkbox v-model:checked="showNullAndEmptyInFilter" v-e="['c:settings:show-null']" class="nc-settings-show-null">
          {{ $t('msg.info.showNullAndEmptyInFilter')}} <br/>
          <span class="text-gray-500">{{ $t('msg.info.showNullAndEmptyInFilterDesc')}}</span>
        </a-checkbox>
      </div>
    </div>
  </div>
</template>
