<script setup lang="ts">
import { useGlobal, useProject, watch } from '#imports'

const { includeM2M, showNull } = useGlobal()
const { loadTables } = useProject()

watch(includeM2M, async () => await loadTables())
</script>

<template>
  <div class="flex flex-row w-full">
    <div class="flex flex-col w-full">
      <div class="flex flex-row items-center w-full mb-4 gap-2">
        <!--        Show M2M Tables -->
        <a-checkbox v-model:checked="includeM2M" v-e="['c:themes:show-m2m-tables']" class="nc-settings-meta-misc">
          {{ $t('msg.info.showM2mTables') }}
        </a-checkbox>
      </div>
      <div class="flex flex-row items-center w-full mb-4 gap-2">
        <!--        Show NULL -->
        <a-checkbox v-model:checked="showNull" v-e="['c:settings:show-null']" class="nc-settings-show-null">Show NULL</a-checkbox>
      </div>
    </div>
  </div>
</template>
