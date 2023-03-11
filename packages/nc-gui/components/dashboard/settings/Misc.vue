<script setup lang="ts">
import type { CheckboxChangeEvent } from 'ant-design-vue/es/checkbox/interface'
import { storeToRefs, useGlobal, useProject, watch } from '#imports'
import {storeToRefs} from "pinia";

const { includeM2M, showNull } = useGlobal()

const projectStore = useProject()
const { updateProject, loadTables, hasEmptyOrNullFilters } = projectStore
const { project, projectMeta } =storeToRefs( projectStore)

watch(includeM2M, async () => await loadTables())

const showNullAndEmptyInFilter = ref(projectMeta.value.showNullAndEmptyInFilter)

async function showNullAndEmptyInFilterOnChange(evt: CheckboxChangeEvent) {
  // users cannot hide null & empty option if there is existing null / empty filters
  if (!evt.target.checked) {
    if (await hasEmptyOrNullFilters()) {
      showNullAndEmptyInFilter.value = true
      message.warning('Null / Empty filters exist. Please remove them first.')
    }
  }
  const newProjectMeta = {
    ...projectMeta.value,
    showNullAndEmptyInFilter: showNullAndEmptyInFilter.value,
  }
  // update local state
  project.value.meta = newProjectMeta
  // update db
  await updateProject({
    meta: newProjectMeta,
  })
}
</script>

<template>
  <div class="flex flex-row w-full">
    <div class="flex flex-col w-full">
      <div class="flex flex-row items-center w-full mb-4 gap-2">
        <!-- Show M2M Tables -->
        <a-checkbox v-model:checked="includeM2M" v-e="['c:themes:show-m2m-tables']" class="nc-settings-meta-misc">
          {{ $t('msg.info.showM2mTables') }} <br />
          <span class="text-gray-500">{{ $t('msg.info.showM2mTablesDesc') }}</span>
        </a-checkbox>
      </div>
      <div class="flex flex-row items-center w-full mb-4 gap-2">
        <!-- Show NULL -->
        <a-checkbox v-model:checked="showNull" v-e="['c:settings:show-null']" class="nc-settings-show-null">
          {{ $t('msg.info.showNullInCells') }} <br />
          <span class="text-gray-500">{{ $t('msg.info.showNullInCellsDesc') }}</span>
        </a-checkbox>
      </div>
      <div class="flex flex-row items-center w-full mb-4 gap-2">
        <!-- Show NULL and EMPTY in Filters -->
        <a-checkbox
          v-model:checked="showNullAndEmptyInFilter"
          v-e="['c:settings:show-null-and-empty-in-filter']"
          class="nc-settings-show-null-and-empty-in-filter"
          @change="showNullAndEmptyInFilterOnChange"
        >
          {{ $t('msg.info.showNullAndEmptyInFilter') }} <br />
          <span class="text-gray-500">{{ $t('msg.info.showNullAndEmptyInFilterDesc') }}</span>
        </a-checkbox>
      </div>
    </div>
  </div>
</template>
