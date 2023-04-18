<script setup lang="ts">
import type { CheckboxChangeEvent } from 'ant-design-vue/es/checkbox/interface'
import { isString } from '@vueuse/core'
import { onMounted } from '@vue/runtime-core'
import { storeToRefs, useGlobal, useProject, watch } from '#imports'
import { ProjectIdInj } from '~/context'

const { includeM2M, showNull } = useGlobal()

const projectStore = useProject()
const projectsStore = useProjects()
const { loadTables, hasEmptyOrNullFilters } = projectStore
const { project } = storeToRefs(projectStore)
const _projectId = inject(ProjectIdInj)
const projectId = computed(() => _projectId?.value ?? project.value?.id)

watch(includeM2M, async () => await loadTables())

const showNullAndEmptyInFilter = ref()

onMounted(async () => {
  await projectsStore.loadProject(projectId.value!, true)
  showNullAndEmptyInFilter.value = projectsStore.getProjectMeta(projectId.value!)?.showNullAndEmptyInFilter
})

async function showNullAndEmptyInFilterOnChange(evt: CheckboxChangeEvent) {
  const project = projectsStore.projects[projectId.value!]

  const meta = projectsStore.getProjectMeta(projectId.value!) ?? {}

  // users cannot hide null & empty option if there is existing null / empty filters
  if (!evt.target.checked) {
    if (await hasEmptyOrNullFilters()) {
      showNullAndEmptyInFilter.value = true
      message.warning('Null / Empty filters exist. Please remove them first.')
    }
  }
  const newProjectMeta = {
    ...meta,
    showNullAndEmptyInFilter: showNullAndEmptyInFilter.value,
  }
  // update local state
  project.meta = newProjectMeta
  // update db
  await projectsStore.updateProject(projectId.value!, {
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
