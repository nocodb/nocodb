<script setup lang="ts">
import { type ColumnType, UITypes, isLinksOrLTAR, isSystemColumn, isVirtualCol } from 'nocodb-sdk'
import Draggable from 'vuedraggable'
import { generateUniqueColumnName } from '~/helpers/parsers/parserHelpers'

interface Props {
  column: ColumnType
  value?: boolean
}

const props = defineProps<Props>()

const { $api } = useNuxtApp()

const baseStore = useBase()

const { getMeta, metas } = useMetas()

const meta = inject(MetaInj, ref())

const activeView = inject(ActiveViewInj, ref())

const { loadTables } = baseStore

const { tables } = toRefs(baseStore)

const column = toRef(props, 'column')

const value = useVModel(props, 'value')

const columnsHash = ref()

const isLoading = ref(false)

const searchField = ref('')

const filteredColumns = ref<
  {
    column: ColumnType
    show: boolean
    id: string
  }[]
>([])

const selectedFields = ref<Record<string, boolean>>({})

const getIcon = (c: ColumnType) =>
  h(isVirtualCol(c) ? resolveComponent('SmartsheetHeaderVirtualCellIcon') : resolveComponent('SmartsheetHeaderCellIcon'), {
    columnMeta: c,
  })

const relatedModel = computedAsync(async () => {
  const fkRelatedModelId = (column.value.colOptions as any)?.fk_related_model_id

  if (fkRelatedModelId) {
    let table = tables.value.find((t) => t.id === fkRelatedModelId)

    if (!table) {
      await loadTables()
      table = tables.value.find((t) => t.id === fkRelatedModelId)
    }
    return table
  }
  return null
})

const createLookups = async () => {
  try {
    isLoading.value = true

    const bulkOpsCols: {
      op: 'add'
      column: ColumnType
    }[] = [] as any

    const currIndex = meta.value?.columns?.length ?? 0

    for (const [k] of Object.entries(selectedFields.value).filter(([, v]) => v)) {
      const lookupCol = metas.value[relatedModel.value?.id].columns.find((c) => c.id === k)
      const index = filteredColumns.value.findIndex((c) => c.id === k)
      const tempCol = {
        uidt: UITypes.Lookup,
        fk_lookup_column_id: k,
        fk_relation_column_id: column.value.id,
        lookupTableTitle: relatedModel.value?.title,
        lookupColumnTitle: lookupCol?.title || lookupCol.column_name,
        table_name: meta.value?.table_name,
        title: `${lookupCol?.title} from ${relatedModel.value?.title}`,
        view_id: activeView.value?.id,
        order: currIndex + index,
        column_name: `${lookupCol?.title} from (${relatedModel.value?.title})`,
        column_order: {
          order: currIndex + index,
          view_id: activeView.value?.id,
        },
      }

      const newColName = generateUniqueColumnName({
        formState: tempCol,
        metaColumns: relatedModel.value?.columns,
        tableExplorerColumns: meta.value?.columns,
      })

      bulkOpsCols.push({
        op: 'add',
        column: {
          ...tempCol,
          title: newColName,
        },
      })
    }

    await $api.dbTableColumn.bulk(meta.value?.id, {
      hash: columnsHash.value,
      ops: bulkOpsCols,
    })

    await getMeta(meta?.value?.id as string, true)

    isOpened.value = false;
    selectedFields.value = {};

  } catch (e) {
    console.error(e)
  } finally {
    isLoading.value = false
  }
}

watch([relatedModel, searchField], async () => {
  if (relatedModel.value) {
    const columns = metas.value[relatedModel.value.id].columns
    filteredColumns.value = columns
      .filter((c) => !isSystemColumn(c) && !isLinksOrLTAR(c))
      .filter((c) => c?.title?.toLowerCase().startsWith(searchField.value?.toLowerCase()))
  }
})

onMounted(async () => {
  columnsHash.value = (await $api.dbTableColumn.hash(meta.value?.id)).hash
})

const isOpened = ref(false)
</script>

<template>
  <NcDropdown :disabled="column.uidt !== 'Links'" placement="right" :trigger="['click']" v-model:visible="isOpened">
    <slot />
    <template #overlay>
      <div class="flex flex-col !rounded-t-lg overflow-hidden w-[256px]">
        <div @click.stop>
          <a-input v-model:value="searchField" class="w-full !border-0 !ring-0 !outline-0 a-input-without-effect" placeholder="Search field to add as lookup">
            <template #prefix>
              <component :is="iconMap.search" class="w-3 text-gray-500 h-3 mr-2" />
            </template>
          </a-input>
          <div class="border-y-1 h-[300px] nc-scrollbar-md border-gray-200">
            <Draggable v-model="filteredColumns" item-key="id" ghost-class="nc-lookup-menu-items-ghost">
              <template #item="{ element: field }">
                <div
                  :key="field.id"
                  :data-testid="`nc-lookup-add-menu-${field.title}`"
                  class="px-3 py-1 flex flex-row items-center rounded-md hover:bg-gray-100"
                  @click.stop="selectedFields[field.id] = !selectedFields[field.id]"
                >
                  <component :is="iconMap.drag" class="cursor-move !h-3.75 text-gray-600 mr-1" />
                  <div class="flex flex-row items-center w-full cursor-pointer truncate ml-1 py-[5px] pr-2">
                    <component :is="getIcon(field)" class="!w-3.5 !h-3.5 !text-gray-500" />
                    <NcTooltip class="flex-1 pl-1 pr-2 truncate" show-on-truncate-only>
                      <template #title>
                        {{ field.title }}
                      </template>
                      <template #default>{{ field.title }}</template>
                    </NcTooltip>
    
                    <NcCheckbox v-model:checked="selectedFields[field.id]" size="default" />
                  </div>
    
                  <div class="flex-1" />
                </div>
              </template>
            </Draggable>
          </div>
          <div class="flex w-full p-1">
            <NcButton
              :loading="isLoading"
              :disabled="!Object.values(selectedFields).filter(Boolean).length"
              size="small"
              class="w-full"
              @click="createLookups"
            >
              {{
                $t('general.addLookupField', {
                  count: Object.values(selectedFields).filter(Boolean).length || '',
                })
              }}
            </NcButton>
          </div>

        </div>
      </div>
    </template>
  </NcDropdown>
</template>

<style scoped>
  .a-input-without-effect {
    border: none !important
  }
  :deep(.a-input-without-effect .ant-input) {
    font-size: 0.75rem !important;
  }
</style>