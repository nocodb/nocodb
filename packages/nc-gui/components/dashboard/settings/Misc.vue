<script setup lang="ts">
import type { CheckboxChangeEvent } from 'ant-design-vue/es/checkbox/interface'
import { onMounted } from '@vue/runtime-core'
import { ProjectIdInj, storeToRefs, useBase, useGlobal, watch } from '#imports'

const { includeM2M, showNull } = useGlobal()

const baseStore = useBase()
const basesStore = useBases()
const { loadTables, hasEmptyOrNullFilters } = baseStore
const { base } = storeToRefs(baseStore)
const _projectId = inject(ProjectIdInj, undefined)
const baseId = computed(() => _projectId?.value ?? base.value?.id)

const { t } = useI18n()

watch(includeM2M, async () => await loadTables())

const showNullAndEmptyInFilter = ref()

onMounted(async () => {
  await basesStore.loadProject(baseId.value!, true)
  showNullAndEmptyInFilter.value = basesStore.getProjectMeta(baseId.value!)?.showNullAndEmptyInFilter
})

async function showNullAndEmptyInFilterOnChange(evt: CheckboxChangeEvent) {
  const base = basesStore.bases.get(baseId.value!)
  if (!base) throw new Error(`Base ${baseId.value} not found`)

  const meta = basesStore.getProjectMeta(baseId.value!) ?? {}

  // users cannot hide null & empty option if there is existing null / empty filters
  if (!evt.target.checked) {
    if (await hasEmptyOrNullFilters()) {
      showNullAndEmptyInFilter.value = true
      message.warning(t('msg.error.nullFilterExists'))
    }
  }
  const newProjectMeta = {
    ...meta,
    showNullAndEmptyInFilter: showNullAndEmptyInFilter.value,
  }
  // update local state
  base.meta = newProjectMeta
  // update db
  await basesStore.updateProject(baseId.value!, {
    meta: JSON.stringify(newProjectMeta),
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
