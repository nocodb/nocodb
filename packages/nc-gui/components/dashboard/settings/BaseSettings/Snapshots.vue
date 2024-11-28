<script setup lang="ts">
const { t } = useI18n()

const { sorts, sortDirection, loadSorts, handleGetSortedData, saveOrUpdate: saveOrUpdateSort } = useUserSorts('Webhook')

const orderBy = computed<Record<string, SordDirectionType>>({
  get: () => {
    return sortDirection.value
  },
  set: (value: Record<string, SordDirectionType>) => {
    // Check if value is an empty object
    if (Object.keys(value).length === 0) {
      saveOrUpdateSort({})
      return
    }

    const [field, direction] = Object.entries(value)[0]

    saveOrUpdateSort({
      field,
      direction,
    })
  },
})

const snapshots = ref([])

const columns = [
  {
    key: 'name',
    title: t('general.snapshot'),
    name: 'Snapshot',
    minWidth: 397,
    padding: '12px 24px',
    showOrderBy: true,
    dataIndex: 'title',
  },
  {
    key: 'action',
    title: t('general.action'),
    width: 162,
    minWidth: 162,
    padding: '12px 24px',
  },
] as NcTableColumnProps[]
</script>

<template>
  <div class="item-card flex flex-col w-full">
    <div class="text-nc-content-gray-emphasis font-semibold text-lg">
      {{ $t('general.baseSnapshots') }}
    </div>

    <div class="text-nc-content-gray-subtle2 mt-2 leading-5">
      {{ $t('labels.snapShotSubText') }}
    </div>

    <div class="flex items-center mt-6 gap-5">
      <NcButton class="!w-36" size="small" type="secondary">
        {{ $t('labels.newSnapshot') }}
      </NcButton>
    </div>

    <NcTable
      v-model:order-by="orderBy"
      :columns="columns"
      :data="snapshots"
      class="h-full mt-5"
      body-row-class-name="nc-base-settings-snapshot-item"
    >
      <template #bodyCell="{ column, record: hook }">
        <template v-if="column.key === 'name'">
          <NcTooltip class="truncate max-w-full text-gray-800 font-semibold text-sm" show-on-truncate-only>
            {{ hook.title }}

            <template #title>
              {{ hook.title }}
            </template>
          </NcTooltip>
        </template>
        <template v-if="column.key === 'action'">
          <div class="flex items-center gap-2">
            <NcButton size="small" type="text" class="!text-xs">
              {{ $t('labels.edit') }}
            </NcButton>
            <NcButton size="small" type="text" class="!text-xs">
              {{ $t('labels.delete') }}
            </NcButton>
          </div>
        </template>
      </template>
    </NcTable>
  </div>
</template>

<style scoped lang="scss"></style>
