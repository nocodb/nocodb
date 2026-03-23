<script setup lang="ts">
const { levels, selectedLevelId, setSelectedLevel } = useListViewStoreOrThrow()

const meta = inject(MetaInj, ref())
const { getMetaByKey } = useMetas()

function getTableMeta(tableId?: string) {
  if (!tableId) return undefined
  const baseId = meta.value?.base_id
  return getMetaByKey(baseId, tableId)
}

function getTableTitle(tableId?: string) {
  return getTableMeta(tableId)?.title || 'Unknown'
}
</script>

<template>
  <div v-if="levels.length > 0" class="flex items-center gap-1">
    <div
      v-for="(level, index) in levels"
      :key="level.id || index"
      class="flex-1 flex items-center justify-center gap-1 px-2 selector-level py-1 overflow-hidden rounded-md text-xs font-medium cursor-pointer transition-colors"
      :class="{
        'bg-nc-bg-brand text-nc-content-brand': selectedLevelId === level.id,
        'bg-nc-bg-gray-light text-nc-content-gray-muted hover:bg-nc-bg-gray-medium': selectedLevelId !== level.id,
        'level-two': levels.length === 2,
        'level-three': levels.length === 3,
      }"
      @click="setSelectedLevel(level.id ?? null)"
    >
      <NcIconTable
        :table="getTableMeta(level.fk_model_id) || { title: '', table_name: '' }"
        class="flex-none h-3.5 w-3.5"
      />
      <NcTooltip class="truncate">
        {{ getTableTitle(level.fk_model_id) }}
        <template #title>
          {{ $t('general.levelN', { n: index + 1 }) }} - {{ getTableTitle(level.fk_model_id) }}
        </template>
      </NcTooltip>
    </div>
  </div>
</template>
