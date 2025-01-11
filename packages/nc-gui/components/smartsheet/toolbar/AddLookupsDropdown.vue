<script setup lang="ts">
import { type ColumnType, type TableType, UITypes, isLinksOrLTAR, isSystemColumn, isVirtualCol } from 'nocodb-sdk'
import { generateUniqueColumnName } from '~/helpers/parsers/parserHelpers'

interface Props {
  column: ColumnType
  value?: boolean
  disabled?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits(['created'])

const isOpened = defineModel<boolean>('isOpened', {
  default: false,
})

const { $api } = useNuxtApp()

const { t } = useI18n()

const { getMeta, metas } = useMetas()

const meta = inject(MetaInj, ref())

const activeView = inject(ActiveViewInj, ref())

const column = toRef(props, 'column')

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

const fkRelatedModelId = computed(() => (column.value.colOptions as any)?.fk_related_model_id)

const relatedModel = ref<TableType | null>()

const hasSelectedFields = computed(() => Object.values(selectedFields.value).filter(Boolean).length > 0)

const createLookups = async () => {
  if (!hasSelectedFields.value) {
    return
  }

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

    isOpened.value = false
    selectedFields.value = {}
    emit('created')
  } catch (e) {
    console.error(e)
    message.error('Failed to create lookup columns')
  } finally {
    isLoading.value = false
  }
}

watch([relatedModel, searchField], async () => {
  if (relatedModel.value) {
    const columns = metas.value[relatedModel.value?.id]?.columns || []
    filteredColumns.value = columns.filter(
      (c) => !isSystemColumn(c) && !isLinksOrLTAR(c) && searchCompare([c?.title], searchField.value),
    )
  }
})

const refSearchField = useTemplateRef<HTMLInputElement>('refSearchField')
const isInSearchMode = ref(false)

function switchToSearchMode() {
  isInSearchMode.value = true
  setTimeout(() => {
    refSearchField.value?.focus()
  }, 500)
}

watch(isOpened, async (val) => {
  if (val) {
    relatedModel.value = await getMeta(fkRelatedModelId.value)
    isInSearchMode.value = false
    searchField.value = ''
  }
})
</script>

<template>
  <NcDropdown v-model:visible="isOpened" :disabled="props.disabled" placement="right" overlay-class-name="!min-w-[256px]">
    <slot />
    <template #overlay>
      <div class="flex flex-col !rounded-t-lg overflow-hidden w-[256px]">
        <div @click.stop>
          <div class="h-[44px] relative">
            <transition name="slide-out" :duration="{ enter: 500, leave: 0 }">
              <template v-if="isInSearchMode">
                <a-input
                  ref="refSearchField"
                  v-model:value="searchField"
                  :bordered="false"
                  class="w-full !shadow-none !py-3 a-input-without-effect absolute !bg-transparent"
                  placeholder="Search field to add as lookup"
                >
                  <template #prefix>
                    <component :is="iconMap.search" class="w-3.5 text-gray-500 h-3.5 mr-1 ml-1" />
                  </template>
                </a-input>
              </template>
              <template v-else>
                <div
                  class="flex justify-between items-center pl-4 pr-3 py-1.5 absolute w-full overflow-auto"
                  style="scrollbar-gutter: stable"
                >
                  <div class="font-weight-600">{{ t('general.add') }} {{ t('datatype.Lookup') }} {{ t('objects.fields') }}</div>
                  <NcButton type="text" size="small" @click="switchToSearchMode()">
                    <component :is="iconMap.search" class="w-4 h-4" />
                  </NcButton>
                </div>
              </template>
            </transition>
          </div>
          <div class="border-y-1 h-[310px] border-gray-200 py-1 nc-scrollbar-thin" style="scrollbar-gutter: stable">
            <div v-for="field of filteredColumns" :key="field.id">
              <div
                :key="field.id"
                :data-testid="`nc-lookup-add-menu-${field.title}`"
                class="px-1 py-0.75 mx-1 flex flex-row items-center rounded-md hover:bg-gray-100"
                @click.stop="selectedFields[field.id] = !selectedFields[field.id]"
              >
                <div class="flex flex-row items-center w-full cursor-pointer truncate ml-1 py-[2px] pr-2">
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
            </div>
          </div>
          <div class="flex w-full p-1">
            <NcButton :loading="isLoading" size="small" class="w-full" :disabled="!hasSelectedFields" @click="createLookups">
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
  border: none !important;
}
:deep(.a-input-without-effect .ant-input) {
  font-size: 0.8rem !important;
}
.slide-out-enter-active,
.slide-out-leave-active {
  transition: all 0.25s ease-out;
}
.slide-out-enter-from {
  opacity: 0;
  transform: translateX(90px);
}
.slide-out-leave-to {
  opacity: 0;
  transform: translateX(-90px);
}
</style>
