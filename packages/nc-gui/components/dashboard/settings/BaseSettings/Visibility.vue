<script setup lang="ts">
const { t } = useI18n()

const baseStore = useBase()
const basesStore = useBases()
const { base } = storeToRefs(baseStore)

const _projectId = inject(ProjectIdInj, undefined)
const { loadTables, hasEmptyOrNullFilters } = baseStore

const baseId = computed(() => _projectId?.value ?? base.value?.id)

const showNullAndEmptyInFilter = ref()

const { includeM2M, showNull } = useGlobal()

watch(includeM2M, async () => await loadTables())

onMounted(async () => {
  await basesStore.loadProject(baseId.value!, true)
  showNullAndEmptyInFilter.value = basesStore.getProjectMeta(baseId.value!)?.showNullAndEmptyInFilter
})

async function showNullAndEmptyInFilterOnChange(evt: boolean) {
  const base = basesStore.bases.get(baseId.value!)
  if (!base) throw new Error(`Base ${baseId.value} not found`)

  const meta = basesStore.getProjectMeta(baseId.value!) ?? {}

  // users cannot hide null & empty option if there is existing null / empty filters
  if (!evt) {
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
  <div class="item-card flex flex-col w-full">
    <div class="text-nc-content-gray-emphasis font-semibold text-lg">
      {{ $t('labels.visibilityAndDataHandling') }}
    </div>

    <div class="text-nc-content-gray-subtle2 mt-2 leading-5">
      {{ $t('labels.miscBaseSettingsLabel') }}
    </div>

    <div class="flex flex-col border-1 rounded-lg mt-6 border-nc-border-gray-medium">
      <div class="flex w-full px-3 py-2 gap-2 flex-col">
        <div class="flex w-full items-center">
          <span class="text-nc-content-gray font-semibold flex-1">
            {{ $t('msg.info.showM2mTables') }}
          </span>
          <NcSwitch v-model:checked="includeM2M" v-e="['c:themes:show-m2m-tables']" class="ml-2" />
        </div>
        <span class="text-gray-500">{{ $t('msg.info.showM2mTablesDesc') }}</span>
      </div>

      <div class="flex w-full px-3 border-t-1 border-nc-border-gray-medium py-2 gap-2 flex-col">
        <div class="flex w-full items-center">
          <span class="text-nc-content-gray font-semibold flex-1">
            {{ $t('msg.info.showNullInCells') }}
          </span>
          <NcSwitch v-model:checked="showNull" v-e="['c:settings:show-null']" class="ml-2" />
        </div>
        <span class="text-gray-500">{{ $t('msg.info.showNullInCellsDesc') }}</span>
      </div>

      <div class="flex w-full px-3 py-2 border-t-1 border-nc-border-gray-medium gap-2 flex-col">
        <div class="flex w-full items-center">
          <span class="text-nc-content-gray font-semibold flex-1">
            {{ $t('msg.info.showNullAndEmptyInFilter') }}
          </span>
          <NcSwitch
            v-model:checked="showNullAndEmptyInFilter"
            v-e="['c:settings:show-null-and-empty-in-filter']"
            class="ml-2"
            @change="showNullAndEmptyInFilterOnChange"
          />
        </div>
        <span class="text-gray-500">{{ $t('msg.info.showNullAndEmptyInFilterDesc') }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss"></style>
