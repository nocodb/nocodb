<script setup lang="ts">
import { type ColumnType, type LinkToAnotherRecordType, RelationTypes, type TableType, ViewTypes } from 'nocodb-sdk'
import Graph from './Graph.vue'
import { type CoordPosition, type Edge, useLayoutHelper } from './useLayoutHelper'

const { $e } = useNuxtApp()

const { fullscreen, tables, getViewsForTable, getTableMeta, activeTableId, activeViewId, $api, extension } =
  useExtensionHelperOrThrow()

const EXTENSION_ID = extension.value.extensionId

const kvStore = extension.value.kvStore

const tableId = ref<string>(activeTableId.value!)
const viewId = ref<string | undefined>(activeViewId.value || undefined)
const relationFieldId = ref<string>()
const relationshipType = ref<'TB' | 'BT'>('TB')
const coverImageFieldId = ref<string>()

const isReady = ref(false)
const saveData = async () => {
  if (!viewId.value || !relationFieldId.value) return
  const dataToSave: SavedData = {
    tabledId: tableId.value,
    viewId: viewId.value,
    relationFieldId: relationFieldId.value,
    coverImageFieldId: coverImageFieldId.value,
    relationshipType: relationshipType.value,
  }
  await kvStore.set('data', dataToSave)
}

const clearData = async () => {
  await kvStore.delete('data')
}

interface SavedData {
  tabledId: string
  viewId: string
  relationFieldId: string
  coverImageFieldId?: string
  relationshipType: 'TB' | 'BT'
}

const isDirty = ref<boolean>(false)
watch([tableId, viewId, relationFieldId, coverImageFieldId, relationshipType], (newConfig, oldConfig) => {
  // mark dirty when something other than relationType changed
  if (newConfig[4] === oldConfig[4]) {
    isDirty.value = true
    isReady.value = false
  }
  saveData()
})

watch([tableId, viewId, relationFieldId, coverImageFieldId, relationshipType], () => {
  saveData()
})

const viewList = computedAsync(async () => {
  if (tableId.value) {
    return (await getViewsForTable(tableId.value)).filter((v) => v.type !== ViewTypes.FORM)
  } else {
    return []
  }
})
watch(viewList, (viewList) => {
  if (viewList.length === 1) {
    viewId.value = viewList[0].id
  }
})

const filterOption = (input = '', params: { key: string }) => {
  return params.key?.toLowerCase().includes(input?.toLowerCase())
}

// Unselect view on table select;
const onTableSelect = () => {
  viewId.value = undefined
  relationFieldId.value = undefined
  coverImageFieldId.value = undefined
}

const tableMeta = computedAsync(() => (tableId.value ? getTableMeta(tableId.value) : undefined))

provide(MetaInj, tableMeta)

const displayValueCol = computed(() => {
  return (
    (tableMeta.value?.columns || []).find((c) => {
      return c.pv
    }) || (tableMeta.value?.columns || [])[0]
  )
})

const mandatoryColumns = computed(() => {
  return (tableMeta.value?.columns || [])
    .filter((c) => {
      return c.pv || c.pk
    })
    .map((c) => c.title)
})

const relationFields = computed(() =>
  tableMeta.value?.columns?.filter(
    (c) =>
      (c.uidt === 'Links' || c.uidt === 'LinkToAnotherRecord') &&
      (c.colOptions as any).type !== RelationTypes.ONE_TO_ONE &&
      (c.colOptions as any).type !== RelationTypes.BELONGS_TO &&
      !c.system &&
      (c.colOptions as any)?.fk_related_model_id === tableId.value,
  ),
)
watch(relationFields, (relationFields) => {
  if (relationFields && relationFields.length === 1) {
    relationFieldId.value = relationFields[0].id
  }
})
const coverImageFields = computed(() => tableMeta.value?.columns?.filter((c) => c.uidt === 'Attachment' && !c.system))

const selectedTable = computed(() => tables.value.find((t: any) => t.id === tableId.value)!)
const selectedRelationField = computed(() => relationFields.value?.find((rf) => rf.id === relationFieldId.value))
const correspondingReverseField = ref<string>()
const selectedRelationFieldTitle = computed(() => selectedRelationField.value?.title)
const selectedCoverImageField = computed(() =>
  coverImageFieldId.value ? coverImageFields.value?.find((f) => f.id === coverImageFieldId.value) : undefined,
)

const getRelationFieldIcon = (column: ColumnType) => {
  switch ((column.colOptions as LinkToAnotherRecordType)?.type) {
    case RelationTypes.MANY_TO_MANY:
      return { icon: 'mm_solid' }
    case RelationTypes.HAS_MANY:
      return { icon: 'hm_solid' }
  }
}

const relationshipTypeOptions = [
  { id: 'TB', title: 'Parent' },
  { id: 'BT', title: 'Child' },
]

// rowId -> childRowId[]
const hierarchyData = shallowRef<Map<string, string[]>>(new Map())
const dataMap = shallowRef<Map<string, any>>(new Map())
const parentRowIds = ref<string[]>([])

// UI specific objects
const { layout } = useLayoutHelper()

const defaultPosition: CoordPosition = { x: 0, y: 0 }
const edges = computed<Edge[]>(() => {
  const edges: Edge[] = []
  hierarchyData.value.entries().forEach(([k, v]) => {
    edges.push(...v.map((vi) => ({ id: `${k}-${vi}`, source: k.toString(), target: vi.toString() })))
  })
  return edges
})

const nodes = computed(() => {
  try {
    const nodes = dataMap.value
      .entries()
      .map(([k, v]) => ({ id: k.toString(), position: defaultPosition, data: v }))
      .toArray()

    return layout(nodes, edges.value, relationshipType.value)
  } catch (e) {
    console.error(e)
    return []
  }
})

// This function assumes that data hasn't changed after extension is mounted,
// and therefore, trusts rows which are already in map and doesn't re-fetch them.
const loadChildren = async (rowIds: string[]) => {
  if (!correspondingReverseField.value) {
    throw new Error('loadChildren called without reverseField')
  }
  const rowIdsToFetch = rowIds.filter((rid) => !hierarchyData.value.has(rid))
  const childRowIdsToFilterAndFetch: string[] = []

  let newHierarchyDataFound = false
  if (rowIdsToFetch.length) {
    const fetchPromises = rowIdsToFetch.map((rid) =>
      $api.dbDataTableRow.nestedList(selectedTable.value.id, correspondingReverseField.value!, rid),
    )
    const childRowList = await Promise.all(fetchPromises)
    // Unfiltered means, childIds that may or may not be in view.
    const parentToUnfilteredChildIds = new Map<string, string[]>()

    childRowList.forEach((childRow: any, i: any) => {
      const parentRowId = rowIdsToFetch[i]
      const childRowIds = (childRow.list ? childRow.list.map((l: any) => l.Id) : [childRow.Id]) as string[]

      if (childRowIds) {
        parentToUnfilteredChildIds.set(parentRowId, [...childRowIds])
        childRowIdsToFilterAndFetch.push(...childRowIds)
        newHierarchyDataFound = true
      }
    })

    if (newHierarchyDataFound) {
      const existingKeys = new Set(dataMap.value.keys())
      const unfetchedChildRowIdsToFilterAndFetch = Array.from(
        new Set(childRowIdsToFilterAndFetch.filter((k) => k && !existingKeys.has(k))),
      )

      if (unfetchedChildRowIdsToFilterAndFetch) {
        const finalChildrenDataFilteredByViews = unfetchedChildRowIdsToFilterAndFetch.length
          ? (
              await $api.dbDataTableRow.list(tableId.value, {
                viewId: viewId.value,
                fields: coverImageFieldId.value
                  ? [...mandatoryColumns.value, selectedCoverImageField.value?.title]
                  : [...mandatoryColumns.value],
                where: `where=${unfetchedChildRowIdsToFilterAndFetch.map((id) => `(Id,eq,${id})`).join('~or')}`,
              })
            ).list
          : ([] as any[])

        const existingParentFetchPromises = finalChildrenDataFilteredByViews.length
          ? finalChildrenDataFilteredByViews.map((children: any) =>
              $api.dbDataTableRow.nestedList(selectedTable.value.id, relationFieldId.value!, children.Id),
            )
          : []
        const existingParents = await Promise.all(existingParentFetchPromises)
        existingParents.forEach((existingParent: any, i: any) => {
          const childRow = finalChildrenDataFilteredByViews[i]
          existingParent.list.forEach((parent: any) => {
            if (hierarchyData.value.has(parent.Id)) {
              hierarchyData.value.get(parent.Id)!.push(childRow.Id)
            } else {
              // If parent is not fetched already, we can't just create new array as it will block actual fetching of the parent in future.
              // Instead, we trigger entire fetch of the parent and then push the childRowId. Lastly, we need to trigger the hierarchy ref again,
              // since Promise resolves after the original triggerRef is executed.
              rowIdsToFetch.find((rid) => parent.Id === rid) ||
                loadChildren([parent.Id]).then(() => {
                  hierarchyData.value.get(parent.Id)!.push(childRow.Id)
                  triggerRef(hierarchyData)
                })
            }
          })
        })

        const finalChildrenMap = new Map<string, any>()
        finalChildrenDataFilteredByViews.forEach((c: any) => finalChildrenMap.set(c.Id, c))

        parentToUnfilteredChildIds.entries().forEach(([parentRowId, childIds]) => {
          hierarchyData.value.set(
            parentRowId,
            childIds.filter((cid) => finalChildrenMap.has(cid)).map((cid) => finalChildrenMap.get(cid).Id),
          )
          childIds.forEach((cid) => {
            finalChildrenMap.has(cid) && dataMap.value.set(cid, finalChildrenMap.get(cid))
          })
        })
      }

      triggerRef(hierarchyData)
      triggerRef(dataMap)
    }
  }
}

const nodeSelected = (nodeId: string) => {
  loadChildren([nodeId])
}

/**
 * We use fk_mm_model_id field to find corresponding column with reverse mappings of provided rowId;
 * If fk_mm_model_id is not present, we use fk_child_column_id (in case of HM and OO).
 */
const loadGraph = async () => {
  isReady.value = false
  hierarchyData.value.clear()
  dataMap.value.clear()

  triggerRef(hierarchyData)
  triggerRef(dataMap)

  try {
    if (!relationFieldId.value) return

    const fk_mm_model_id = (selectedRelationField.value?.colOptions as any)?.fk_mm_model_id
    const fk_child_column_id = (selectedRelationField.value?.colOptions as any)?.fk_child_column_id
    if (fk_mm_model_id) {
      const reverseMappingField = fk_mm_model_id
        ? tableMeta.value?.columns?.find((c) => (c.colOptions as any)?.fk_mm_model_id === fk_mm_model_id)
        : undefined
      correspondingReverseField.value = reverseMappingField?.id
    } else if (fk_child_column_id) {
      const reverseMappingField = fk_child_column_id
        ? tableMeta.value?.columns?.find((c) => (c.colOptions as any)?.fk_child_column_id === fk_child_column_id)
        : undefined
      correspondingReverseField.value = reverseMappingField?.id
    }

    const parentRows = await $api.dbDataTableRow.list(tableId.value, {
      viewId: viewId.value,
      where: `where=(${selectedRelationFieldTitle.value},eq,0)`,
    })
    // set rows data
    parentRows.list.forEach((parentRow: any) => {
      dataMap.value.set(parentRow.Id, parentRow)
    })
    parentRowIds.value = parentRows.list.map((pr: any) => pr.Id as string)
    await loadChildren(parentRowIds.value)

    isReady.value = true
    isDirty.value = false
  } catch (e) {
    console.error(e)
  }
}

const applyChanges = () => {
  $e(`a:extension:${EXTENSION_ID}:load-graph`)
  return loadGraph()
}

onMounted(async () => {
  const savedData = (await kvStore.get('data')) as SavedData | undefined

  if (savedData) {
    if (tables.value.findIndex((t: any) => t.id === savedData.tabledId) === -1) {
      await clearData()
    } else {
      const views = await getViewsForTable(savedData.tabledId)
      if (views.findIndex((v) => v.id === savedData.viewId) === -1) {
        await clearData()
      } else {
        const savedTableMeta = (await getTableMeta(savedData.tabledId))!
        if (savedTableMeta.columns?.findIndex((c) => c.id === savedData.relationFieldId) === -1) {
          await clearData()
        } else {
          tableId.value = savedData.tabledId
          viewId.value = savedData.viewId
          relationFieldId.value = savedData.relationFieldId
          coverImageFieldId.value = savedData.coverImageFieldId
          if (savedData.relationshipType) {
            relationshipType.value = savedData.relationshipType
          }

          if (tableId.value) {
            await until(() => !!tableMeta.value).toBeTruthy({ timeout: 5000 })
          }

          await loadGraph()
        }
      }
    }
  }
})

watch(displayValueCol, () => {
  console.log('changed', displayValueCol.value?.title)
  loadGraph()
})
</script>

<template>
  <ExtensionsExtensionWrapper>
    <div class="flex w-full h-full relative">
      <div v-if="fullscreen" class="h-full w-80 flex flex-col gap-6 nc-scrollbar-thin border-r justify-between">
        <div class="flex flex-col space-y-4 h-full">
          <section>
            <h1>Table and View</h1>
            <div class="flex flex-col gap-3">
              <a-form-item class="!my-0 w-full table-select">
                <NcSelect
                  v-model:value="tableId"
                  class="w-full nc-select-shadow"
                  placeholder="-select table-"
                  :filter-option="filterOption"
                  :show-search="tables?.length > 6"
                  @change="onTableSelect"
                >
                  <a-select-option v-for="table of tables || []" :key="table.title" :value="table.id">
                    <div class="w-full flex items-center gap-2">
                      <GeneralIcon icon="table" class="min-w-4 !text-gray-500" />
                      <NcTooltip show-on-truncate-only class="flex-1 truncate">
                        <template #title>
                          {{ table.title }}
                        </template>
                        {{ table.title }}
                      </NcTooltip>

                      <component
                        :is="iconMap.check"
                        v-if="tableId === table.id"
                        id="nc-selected-item-icon"
                        class="flex-none text-primary w-4 h-4"
                      />
                    </div>
                  </a-select-option>
                </NcSelect>
              </a-form-item>
              <a-form-item class="!my-0 w-full view-select">
                <NcSelect
                  v-model:value="viewId"
                  placeholder="-select view-"
                  class="w-full nc-select-shadow"
                  :filter-option="filterOption"
                  show-search
                  placement="bottomRight"
                >
                  <a-select-option v-for="view of viewList" :key="view.title" :value="view.id">
                    <div class="w-full flex items-center gap-2">
                      <div class="min-w-5 flex items-center justify-center">
                        <GeneralViewIcon :meta="view" />
                      </div>
                      <NcTooltip class="flex-1 truncate" show-on-truncate-only>
                        <template #title>{{ view.title }}</template>
                        <span>{{ view.title }}</span>
                      </NcTooltip>
                      <component
                        :is="iconMap.check"
                        v-if="viewId === view.id"
                        id="nc-selected-item-icon"
                        class="flex-none text-primary w-4 h-4"
                      />
                    </div>
                  </a-select-option>
                </NcSelect>
              </a-form-item>
            </div>
          </section>
          <section>
            <h1>Settings</h1>
            <div class="flex flex-col">
              <div class="text-sm text-nc-content-gray mb-2">
                Relationship field <span class="text-sm font-bold text-red-500">*</span>
              </div>
              <a-form-item class="!my-0 w-full">
                <NcSelect
                  v-model:value="relationFieldId"
                  placeholder="-select a link field-"
                  class="w-full nc-select-shadow"
                  :filter-option="filterOption"
                  show-search
                  placement="bottomRight"
                >
                  <a-select-option v-for="relationField of relationFields" :key="relationField.id" :value="relationField.id">
                    <div class="w-full flex items-center gap-2">
                      <div class="min-w-5 flex items-center justify-center">
                        <GeneralIcon :icon="getRelationFieldIcon(relationField)!.icon as keyof typeof iconMap" />
                      </div>
                      <NcTooltip class="flex-1 truncate" show-on-truncate-only>
                        <template #title>{{ relationField.title }}</template>
                        <span>{{ relationField.title }}</span>
                      </NcTooltip>
                      <component
                        :is="iconMap.check"
                        v-if="relationFieldId === relationField.id"
                        id="nc-selected-item-icon"
                        class="flex-none text-primary w-4 h-4"
                      />
                    </div>
                  </a-select-option>
                </NcSelect>
              </a-form-item>
            </div>
            <div class="flex flex-col">
              <div class="text-sm text-nc-content-gray mb-2">Relationship Type</div>
              <a-radio-group v-model:value="relationshipType" class="relationship-type" @click.stop>
                <a-radio
                  v-for="op of relationshipTypeOptions"
                  :key="op.id"
                  :value="op.id"
                  class="border"
                  :data-testid="`select-option-${op.id}`"
                  >{{ op.title }}
                </a-radio>
              </a-radio-group>
            </div>
            <div class="flex flex-col space-y-3">
              <div class="text-sm text-nc-content-gray mb-2">Cover Image</div>
              <a-form-item class="!my-0 w-full">
                <NcSelect
                  v-model:value="coverImageFieldId"
                  placeholder="-select an attachment field-"
                  class="w-full nc-select-shadow"
                  :filter-option="filterOption"
                  show-search
                  placement="bottomRight"
                >
                  <a-select-option :value="undefined">
                    <div class="w-full flex items-center gap-2">
                      <NcTooltip class="flex-1 truncate" show-on-truncate-only>
                        <template #title>No Image</template>
                        <span>No Cover Image</span>
                      </NcTooltip>
                      <component
                        :is="iconMap.check"
                        v-if="!coverImageFieldId"
                        id="nc-selected-item-icon"
                        class="flex-none text-primary w-4 h-4"
                      />
                    </div>
                  </a-select-option>
                  <a-select-option
                    v-for="coverImageField of coverImageFields"
                    :key="coverImageField.id"
                    :value="coverImageField.id"
                  >
                    <div class="w-full flex items-center gap-2">
                      <div class="min-w-5 flex items-center justify-center">
                        <GeneralIcon icon="cellAttachment" class="flex-none text-gray-500 w-4 h-4" />
                      </div>
                      <NcTooltip class="flex-1 truncate" show-on-truncate-only>
                        <template #title>{{ coverImageField.title }}</template>
                        <span>{{ coverImageField.title }}</span>
                      </NcTooltip>
                      <component
                        :is="iconMap.check"
                        v-if="coverImageFieldId === coverImageField.id"
                        id="nc-selected-item-icon"
                        class="flex-none text-primary w-4 h-4"
                      />
                    </div>
                  </a-select-option>
                </NcSelect>
              </a-form-item>
            </div>
          </section>
          <div class="flex-1"></div>
          <div class="px-6 py-4 flex flex-col">
            <NcButton size="small" type="primary" :disabled="!isDirty || !relationFieldId" @click.prevent="applyChanges">
              <div class="flex justify-center items-center gap-2" data-rec="true">Apply Changes</div>
            </NcButton>
          </div>
        </div>
      </div>
      <Graph
        v-if="isReady"
        id="printOrgPage"
        :class="fullscreen ? '!w-4/5' : 'w-full'"
        :nodes="nodes"
        :edges="edges"
        :element-watch="fullscreen"
        :cover-image-field-id="coverImageFieldId"
        :selected-cover-image-field="selectedCoverImageField"
        :hierarchy-data="hierarchyData"
        :node-selected="nodeSelected"
        :display-value-col="displayValueCol"
      >
      </Graph>
      <div v-else-if="!fullscreen" class="h-full w-full flex items-center justify-center">
        <NcButton size="small" type="secondary" @click="fullscreen = true">
          <GeneralIcon icon="settings" class="mr-1" />
          <span class="font-bold">Configure</span>
        </NcButton>
      </div>
      <div v-else class="w-4/5"></div>
    </div>
  </ExtensionsExtensionWrapper>
</template>

<style lang="scss">
.vue-flow__node {
  @apply border-1 border-zinc-300 rounded-md p-0;
}
</style>

<style lang="scss" scoped>
section {
  @apply flex flex-col px-6 py-4 gap-3 border-b border-nc-border-gray-medium !m-0;
  h1 {
    font-size: 16px;
    font-weight: 700;
    @apply text-nc-content-gray-emphasis;
  }
}

.relationship-type {
  :deep(.ant-radio-input:focus + .ant-radio-inner) {
    box-shadow: none !important;
  }
  :deep(.ant-radio-wrapper) {
    @apply flex px-3 py-2 border-1 border-nc-gray-medium m-0;
    .ant-radio-checked .ant-radio-inner {
      @apply !bg-nc-fill-primary !border-nc-fill-primary;
      &::after {
        @apply bg-nc-bg-default;
        width: 12px;
        height: 12px;
        margin-top: -6px;
        margin-left: -6px;
      }
    }
    &:first-child {
      @apply rounded-tl-lg rounded-tr-lg;
    }
    &:last-child {
      @apply border-t-0 rounded-bl-lg rounded-br-lg;
    }
    span:last-child {
      padding-left: 12px;
      font-weight: 500;
    }
  }
}

@media print {
  * {
    -webkit-print-color-adjust: exact; /* Chrome, Safari 6 – 15.3, Edge */
    color-adjust: exact; /* Firefox 48 – 96 */
    print-color-adjust: exact;
  }

  #printOrgPage {
    @apply m-0 shadow-none visible absolute left-0 top-0;
  }

  body {
    @apply invisible;
  }
}
</style>
