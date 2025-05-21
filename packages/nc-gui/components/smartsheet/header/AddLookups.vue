<script setup lang="ts">
import { type ColumnType, type TableType, UITypes, isLinksOrLTAR, isSystemColumn, isVirtualCol } from 'nocodb-sdk'
import Draggable from 'vuedraggable'
import { generateUniqueColumnName } from '~/helpers/parsers/parserHelpers'

interface Props {
  value?: boolean
}

const props = defineProps<Props>()

const { $api } = useNuxtApp()

const { getMeta, metas } = useMetas()

const meta = inject(MetaInj, ref())

const activeView = inject(ActiveViewInj, ref())

const menuColumn = inject(ColumnInj)

const canvasColumn = inject(CanvasColumnInj)

const column = computed(() => menuColumn?.value || canvasColumn?.value)

const value = useVModel(props, 'value')

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

const isLoadingModel = ref(false)

const fkRelatedModelId = computed(() => (column.value.colOptions as any)?.fk_related_model_id)

const relatedModel = ref<TableType | null>()

const clearAll = () => {
  Object.keys(selectedFields.value).forEach((k) => (selectedFields.value[k] = false))
}

const selectAll = () => {
  filteredColumns.value.forEach((c) => (selectedFields.value[c.id] = true))
}

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
      hash: meta.value?.columnsHash,
      ops: bulkOpsCols,
    })

    await getMeta(meta?.value?.id as string, true)

    value.value = false
  } catch (e) {
    console.error(e)
    message.error('Failed to create lookup columns')
  } finally {
    isLoading.value = false
  }
}

watch([relatedModel, searchField], async () => {
  if (relatedModel.value) {
    const columns = metas.value[relatedModel.value.id]?.columns || []
    filteredColumns.value = columns.filter(
      (c) => !isSystemColumn(c) && !isLinksOrLTAR(c) && searchCompare([c?.title], searchField.value),
    )
  }
})

onMounted(async () => {
  relatedModel.value = await getMeta(fkRelatedModelId.value)
})
</script>

<template>
  <NcModal v-model:visible="value" size="small">
    <div class="flex flex-col gap-3">
      <div>
        <h1 class="text-base text-gray-800 font-semibold">
          <component :is="iconMap.cellLookup" class="text-gray-500 pb-1" /> {{ $t('general.addLookupField') }}
        </h1>
        <div class="text-gray-500 text-[13px] leading-5">
          {{ $t('labels.addNewLookupHelperText1') }}

          <span class="font-semibold">
            {{ relatedModel?.title ?? relatedModel?.table_name }}
          </span>
          {{ $t('labels.addNewLookupHelperText2') }}
        </div>
      </div>

      <div class="flex w-full gap-2 justify-between items-center">
        <a-input v-model:value="searchField" class="w-full h-8 flex-1" size="small" :placeholder="$t('placeholder.searchFields')">
          <template #prefix>
            <component :is="iconMap.search" class="w-4 text-gray-500 h-4" />
          </template>
        </a-input>
        <div class="flex items-center gap-2">
          <NcButton size="small" type="text" class="!text-xs" @click="clearAll"> {{ $t('labels.clearAll') }} </NcButton>
          <NcButton size="small" type="text" class="!text-xs" @click="selectAll"> {{ $t('general.addAll') }} </NcButton>
        </div>
      </div>

      <div
        :class="{
          'flex items-center justify-center': isLoadingModel,
        }"
        class="border-1 rounded-md h-[300px] nc-scrollbar-md border-gray-200"
      >
        <Draggable v-if="!isLoadingModel" v-model="filteredColumns" item-key="id" ghost-class="nc-lookup-menu-items-ghost">
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

        <div v-else>
          <GeneralLoader size="xlarge" />
        </div>
      </div>

      <div class="flex w-full gap-2 justify-end">
        <NcButton type="secondary" size="small" @click="value = false">
          {{ $t('general.cancel') }}
        </NcButton>

        <NcButton
          :loading="isLoading"
          :disabled="!Object.values(selectedFields).filter(Boolean).length"
          size="small"
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
  </NcModal>
</template>

<style scoped lang="scss">
.ant-input::placeholder {
  @apply text-gray-500;
}

.ant-input:placeholder-shown {
  @apply text-gray-500 !text-md;
}

.ant-input-affix-wrapper {
  @apply px-4 rounded-lg py-2 w-84 border-1 focus:border-brand-500 border-gray-200 !ring-0;
}
</style>
