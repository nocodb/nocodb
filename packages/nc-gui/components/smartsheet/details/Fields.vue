<script setup lang="ts">
import { diff } from 'deep-object-diff'
import { message } from 'ant-design-vue'
import { UITypes, isSystemColumn } from 'nocodb-sdk'
import Draggable from 'vuedraggable'
import type { ColumnType, SelectOptionsType, TableType } from 'nocodb-sdk'
import { Icon } from '@iconify/vue'
import { type Field, getUniqueColumnName, ref, useSmartsheetStoreOrThrow } from '#imports'

interface TableExplorerColumn extends ColumnType {
  id?: string
  temp_id?: string
  column_order?: {
    order: number
    view_id: string
  }
}

interface op {
  op: 'add' | 'update' | 'delete'
  column: TableExplorerColumn
}

interface moveOp {
  op: 'move'
  column: TableExplorerColumn
  index: number
}

const { $api } = useNuxtApp()

const { getMeta } = useMetas()

const { meta, view } = useSmartsheetStoreOrThrow()

const moveOps = ref<moveOp[]>([])

const { fields: viewFields, toggleFieldVisibility } = useViewColumns(view, meta as Ref<TableType | undefined>)

const loading = ref(false)

const columnsHash = ref<string>()

const newFields = ref<TableExplorerColumn[]>([])

const compareCols = (a?: TableExplorerColumn, b?: TableExplorerColumn) => {
  if (a?.id && b?.id) {
    return a.id === b.id
  } else if (a?.temp_id && b?.temp_id) {
    return a.temp_id === b.temp_id
  }
  return false
}

const fields = computed<TableExplorerColumn[]>({
  get: () => {
    const x = ((meta.value?.columns as ColumnType[]) || [])
      .filter((col) => !col.pk && !isSystemColumn(col))
      .sort((a, b) => {
        if (viewFields.value) {
          return (
            viewFields.value.findIndex((f) => f.fk_column_id === a.id) -
            viewFields.value.findIndex((f) => f.fk_column_id === b.id)
          )
        }
        return 0
      })
      .concat(newFields.value)
    for (const op of moveOps.value) {
      const index = x.findIndex((f) => compareCols(f, op.column))
      if (index !== -1) {
        const tempField = x.splice(index, 1)
        x.splice(op.index, 0, tempField[0])
      }
    }
    return x
  },
  set: (val) => {
    meta.value!.columns = meta.value?.columns?.map((col) => {
      const field = val.find((f) => compareCols(f, col))
      if (field) {
        return field
      }
      return col
    })
  },
})

// Current Selected Field
const activeField = ref()

const searchQuery = ref<string>('')

const viewFieldsMap = computed<Record<string, Field>>(() => {
  const temp: Record<string, Field> = {}
  if (viewFields.value) {
    for (const field of viewFields.value) {
      if (field.fk_column_id) temp[field.fk_column_id] = field
    }
  }
  return temp
})

const orderList = computed(() => {
  const temp = []
  for (const field of fields.value) {
    if (field.id) {
      const viewField = viewFieldsMap.value[field.id]
      if (viewField) {
        temp.push(viewField.order)
        continue
      }
    }
    temp.push(-1)
  }
  return temp
})

const calculateOrder = (column: TableExplorerColumn) => {
  if (!viewFields.value) return -1

  if (column.pv) return viewFieldsMap.value[column.id as string].order

  // this can't be 0 as pv is 0
  const currentColumnIndex = fields.value.findIndex((f) => compareCols(f, column))

  let before = -1
  let after = -1

  let tempIndex = currentColumnIndex
  let counterBefore = 0
  while (before === -1) {
    before = orderList.value[--tempIndex]
    counterBefore++
  }

  tempIndex = currentColumnIndex
  let counterAfter = 0
  while (after === -1) {
    if (tempIndex === fields.value.length) {
      after = fields.value.length
      counterAfter++
      break
    }
    after = orderList.value[++tempIndex]
    counterAfter++
  }

  const step = (after - before) / (counterBefore + counterAfter)

  return before + step * counterBefore
}

// Update, Delete and New Column operations are tracked here
const ops = ref<op[]>([])

const temporaryAddCount = ref(0)

const changingField = ref(false)

const addFieldMoveHook = ref<number>()

const duplicateFieldHook = ref<TableExplorerColumn>()

const setFieldMoveHook = (field: TableExplorerColumn, before = false) => {
  const index = fields.value.findIndex((f) => compareCols(f, field))
  if (index !== -1) {
    addFieldMoveHook.value = before ? index : index + 1
  }
}

const changeField = (field?: TableExplorerColumn, event?: MouseEvent) => {
  if (event) {
    if (event.target instanceof HTMLElement) {
      if (event.target.closest('.no-action')) return
    }
  }

  if (compareCols(field, activeField.value) || (field === undefined && activeField.value === undefined)) return

  changingField.value = true
  nextTick(() => {
    activeField.value = field
    changingField.value = false
  })
}

const onMove = (_event: { moved: { newIndex: number; oldIndex: number } }) => {
  moveOps.value.push({
    op: 'move',
    column: fields.value[_event.moved.oldIndex],
    index: _event.moved.newIndex,
  })
}

const addField = (field?: TableExplorerColumn, before = false) => {
  if (field) {
    setFieldMoveHook(field, before)
  }
  changeField({})
}

const duplicateField = async (field: TableExplorerColumn) => {
  if (!meta.value?.columns) return

  // generate duplicate column name
  const duplicateColumnName = getUniqueColumnName(`${field.title}_copy`, meta.value?.columns)

  let fieldPayload = {}

  // construct column create payload
  switch (field.uidt) {
    case UITypes.LinkToAnotherRecord:
    case UITypes.Links:
    case UITypes.Lookup:
    case UITypes.Rollup:
    case UITypes.Formula:
      return message.info('Not available at the moment')
    case UITypes.SingleSelect:
    case UITypes.MultiSelect:
      fieldPayload = {
        ...field,
        title: duplicateColumnName,
        column_name: duplicateColumnName,
        id: undefined,
        order: undefined,
        pv: false,
        colOptions: {
          options:
            (field.colOptions as SelectOptionsType)?.options?.map((option: Record<string, any>) => ({
              ...option,
              id: undefined,
            })) ?? [],
        },
      }
      break
    default:
      fieldPayload = {
        ...field,
        title: duplicateColumnName,
        column_name: duplicateColumnName,
        id: undefined,
        colOptions: undefined,
        order: undefined,
        pv: false,
      }
      break
  }

  addField(field)

  duplicateFieldHook.value = fieldPayload as TableExplorerColumn
}

// This method is called whenever there is a change in field properties
const onFieldUpdate = (state: TableExplorerColumn) => {
  const col = fields.value.find((col) => compareCols(col, state))
  if (!col) return

  const diffs = diff(col, state)
  if (Object.keys(diffs).length === 0 || (Object.keys(diffs).length === 1 && 'altered' in diffs)) {
    ops.value = ops.value.filter((op) => op.op === 'add' || !compareCols(op.column, state))
  } else {
    const field = ops.value.find((op) => compareCols(op.column, state))
    if (field) {
      field.column = state
    } else {
      ops.value.push({
        op: 'update',
        column: state,
      })
    }
  }
}

const onFieldDelete = (state: TableExplorerColumn) => {
  const field = ops.value.find((op) => compareCols(op.column, state))
  if (field) {
    if (field.op === 'delete') {
      ops.value = ops.value.filter((op) => op.column.id !== state.id)
    } else if (field.op === 'add') {
      if (activeField.value && compareCols(activeField.value, state)) {
        changeField()
      }
      ops.value = ops.value.filter((op) => op.column.temp_id !== state.temp_id)
      newFields.value = newFields.value.filter((op) => op.temp_id !== state.temp_id)
    } else {
      field.op = 'delete'
      field.column = state
    }
  } else {
    ops.value.push({
      op: 'delete',
      column: state,
    })
  }
}

const onFieldAdd = (state: TableExplorerColumn) => {
  if (duplicateFieldHook.value) {
    state = duplicateFieldHook.value
    duplicateFieldHook.value = undefined
  }

  state.temp_id = `temp_${++temporaryAddCount.value}`
  ops.value.push({
    op: 'add',
    column: state,
  })
  newFields.value.push(state)

  if (addFieldMoveHook.value) {
    moveOps.value.push({
      op: 'move',
      column: state,
      index: addFieldMoveHook.value,
    })
    addFieldMoveHook.value = undefined
  }

  changeField(state)
}

const recoverField = (state: TableExplorerColumn) => {
  const field = ops.value.find((op) => compareCols(op.column, state))
  if (field) {
    if (field.op === 'delete') {
      ops.value = ops.value.filter((op) => !compareCols(op.column, state))
    } else if (field.op === 'update') {
      ops.value = ops.value.filter((op) => !compareCols(op.column, state))
    }
    activeField.value = null
    changeField(fields.value.filter((fiel) => fiel.id === state.id)[0])
  }
}

const fieldState = (field: TableExplorerColumn) => {
  const col = fields.value.find((col) => compareCols(col, field))
  if (col) {
    const op = ops.value.find((op) => compareCols(op.column, col))
    if (op) {
      return op.column
    }
  }
  return null
}

const fieldStatuses = computed<Record<string, string>>(() => {
  const statuses: Record<string, string> = {}
  for (const op of ops.value) {
    if (op.op === 'add') {
      if (op.column.temp_id) statuses[op.column.temp_id] = 'add'
    } else if (op.op === 'update') {
      if (op.column.id) statuses[op.column.id] = 'update'
    } else if (op.op === 'delete') {
      if (op.column.id) statuses[op.column.id] = 'delete'
    }
  }
  return statuses
})

const fieldStatus = (field?: TableExplorerColumn) => {
  const id = field?.id || field?.temp_id
  return id ? fieldStatuses.value[id] : ''
}

const clearChanges = () => {
  ops.value = []
  moveOps.value = []
  newFields.value = []
  changeField()
}

const saveChanges = async () => {
  if (!meta.value?.id) return

  loading.value = true

  for (const mop of moveOps.value) {
    const op = ops.value.find((op) => compareCols(op.column, mop.column))
    if (op && op.op === 'add') {
      op.column.column_order = {
        order: calculateOrder(op.column),
        view_id: view.value?.id as string,
      }
    }
  }

  for (const op of ops.value) {
    if (op.op === 'add') {
      if (activeField.value && compareCols(activeField.value, op.column)) {
        changeField()
      }
    } else if (op.op === 'delete') {
      if (activeField.value && compareCols(activeField.value, op.column)) {
        changeField()
      }
    }
  }

  const res = await $api.dbTableColumn.bulk(meta.value?.id, {
    hash: columnsHash.value,
    ops: ops.value,
  })

  if (res) {
    ops.value = (res.failedOps as op[]) || []
    newFields.value = newFields.value.filter((col) => {
      if (res.failedOps) {
        const op = res.failedOps.find((fop) => {
          return (fop.column as TableExplorerColumn).temp_id === col.temp_id
        })
        if (op) {
          return true
        }
      }
      return false
    })
    moveOps.value = []
  }

  await getMeta(meta.value.id, true)
  columnsHash.value = (await $api.dbTableColumn.hash(meta.value?.id)).hash

  loading.value = false
}

const toggleFieldVisibilityWrapper = async (checked: boolean, field: Field) => {
  console.log(checked)
  if (field.fk_column_id && fieldStatuses.value[field.fk_column_id]) {
    message.warning('You cannot change visibility of a field that is being edited. Please save or discard changes first.')
    field.show = !checked
    return
  }
  if (!checked && activeField.value && compareCols(activeField.value, { id: field.fk_column_id })) {
    changeField()
  }
  await toggleFieldVisibility(checked, field)
}

onMounted(async () => {
  if (!meta.value?.id) return
  columnsHash.value = (await $api.dbTableColumn.hash(meta.value?.id)).hash
})
</script>

<template>
  <div class="flex flex-col w-full p-4" style="height: calc(100vh - (var(--topbar-height) * 2))">
    <div class="h-full">
      <div class="flex flex-col h-full">
        <div class="flex px-2 w-full justify-between py-2">
          <a-input v-model:value="searchQuery" class="!h-8 !px-1 !rounded-lg !w-1/3" placeholder="Search field">
            <template #prefix>
              <GeneralIcon icon="search" class="mx-1 h-3.5 w-3.5 text-gray-500 group-hover:text-black" />
            </template>
            <template #suffix>
              <GeneralIcon
                v-if="searchQuery.length > 0"
                icon="close"
                class="mx-1 h-3.5 w-3.5 text-gray-500 group-hover:text-black"
              />
            </template>
          </a-input>
          <div class="flex gap-2">
            <NcButton type="secondary" size="small" :disabled="loading" @click="addField()">
              <div class="flex items-center gap-2">
                <GeneralIcon icon="plus" class="h-3.5 mb-1 w-3.5" />
                Add field
              </div>
            </NcButton>
            <NcButton
              type="secondary"
              size="small"
              :disabled="!loading && ops.length < 1 && moveOps.length < 1"
              @click="saveChanges()"
            >
              Save Changes
            </NcButton>
          </div>
        </div>
        <div class="flex px-2 pt-2">
          <div class="w-1/3"></div>
        </div>
        <div class="flex mt-2 h-full">
          <div class="flex flex-col flex-1 p-2">
            <Draggable v-model="fields" item-key="id" @change="onMove($event)">
              <template #item="{ element: field }">
                <div
                  v-if="field.title && field.title.toLowerCase().includes(searchQuery.toLowerCase())"
                  class="flex px-2 mr-2 border-x-1 bg-white border-t-1 hover:bg-gray-100 first:rounded-t-lg last:border-b-1 last:rounded-b-lg pl-5 group"
                  :class="` ${compareCols(field, activeField) ? 'selected' : ''}`"
                  @click="changeField(field, $event)"
                >
                  <div class="flex items-center flex-1 py-2.5 gap-1 w-2/6">
                    <component :is="iconMap.drag" class="cursor-move !h-3.75 text-gray-600 mr-1" />

                    <NcCheckbox
                      v-if="field.id && viewFieldsMap[field.id]"
                      :disabled="field.pv"
                      :checked="viewFieldsMap[field.id].show"
                      @change="
                        (event) => {
                          viewFieldsMap[field.id].show = !viewFieldsMap[field.id].show
                          toggleFieldVisibilityWrapper(event.target.checked, viewFieldsMap[field.id])
                        }
                      "
                    />
                    <NcCheckbox v-else :disabled="true" class="opacity-0" :checked="true" />
                    <SmartsheetHeaderCellIcon
                      v-if="field"
                      :column-meta="fieldState(field) || field"
                      :class="{
                        'text-brand-500': compareCols(field, activeField),
                      }"
                    />
                    <span
                      :class="{
                        'text-brand-500': compareCols(field, activeField),
                      }"
                    >
                      {{ fieldState(field)?.title || field.title }}
                    </span>
                  </div>
                  <div class="flex items-center justify-end gap-1">
                    <div class="flex items-center">
                      <NcBadge v-if="fieldStatus(field) === 'delete'" color="red" :border="false" class="bg-red-50 text-red-700">
                        Deleted field
                      </NcBadge>

                      <NcBadge
                        v-else-if="fieldStatus(field) === 'update'"
                        color="orange"
                        :border="false"
                        class="bg-orange-50 text-orange-700"
                      >
                        Updated field
                      </NcBadge>
                    </div>
                    <NcButton
                      v-if="fieldStatus(field) === 'delete' || fieldStatus(field) === 'update'"
                      type="secondary"
                      size="small"
                      class="no-action mr-2"
                      :disabled="loading"
                      @click="recoverField(field)"
                    >
                      <div class="flex items-center text-xs gap-1">
                        <GeneralIcon icon="reload" />
                        Restore
                      </div>
                    </NcButton>
                    <a-dropdown v-else :trigger="['click']" overlay-class-name="nc-dropdown-table-explorer" @click.stop>
                      <GeneralIcon icon="threeDotVertical" class="no-action opacity-0 group-hover:(opacity-100) text-gray-500" />

                      <template #overlay>
                        <a-menu>
                          <a-menu-item key="table-explorer-duplicate" @click="duplicateField(field)">
                            <div class="nc-project-menu-item">
                              <Icon class="iconify text-gray-800" icon="lucide:copy" /><span>Duplicate</span>
                            </div>
                          </a-menu-item>
                          <a-menu-item v-if="!field.pv" key="table-explorer-insert-above" @click="addField(field, true)">
                            <div class="nc-project-menu-item">
                              <Icon class="iconify text-gray-800" icon="lucide:arrow-up" /><span>Insert above</span>
                            </div>
                          </a-menu-item>
                          <a-menu-item key="table-explorer-insert-below" @click="addField(field)">
                            <div class="nc-project-menu-item">
                              <Icon class="iconify text-gray-800" icon="lucide:arrow-down" /><span>Insert below</span>
                            </div>
                          </a-menu-item>

                          <a-menu-divider class="my-0" />

                          <a-menu-item key="table-explorer-delete" @click="onFieldDelete(field)">
                            <div class="nc-project-menu-item group text-red-500">
                              <GeneralIcon icon="delete" class="group-hover:text-accent" />
                              Delete
                            </div>
                          </a-menu-item>
                        </a-menu>
                      </template>
                    </a-dropdown>
                    <MdiChevronRight
                      class="text-brand-500 opacity-0"
                      :class="{
                        'opacity-100': compareCols(field, activeField),
                      }"
                    />
                  </div>
                </div>
              </template>
            </Draggable>
          </div>
          <Transition name="slide-fade">
            <div v-if="!changingField" class="flex p-2 mt-2 w-1/3 h-full border-gray-200 border-1 rounded-xl">
              <SmartsheetColumnEditOrAddProvider
                v-if="activeField"
                class="w-full"
                :column="activeField"
                :preload="fieldState(activeField)"
                :table-explorer-columns="fields"
                embed-mode
                from-table-explorer
                @update="onFieldUpdate"
                @add="onFieldAdd"
              />
              <div v-else-if="loading" class="flex flex-col p-2 mt-2 w-full items-center">
                <GeneralIcon icon="reload" class="animate-infinite animate-spin text-gray-500 w-[48px] h-[48px]" />
              </div>
              <div v-else class="flex flex-col p-2 mt-2 gap-6 w-full items-center">
                <img src="~assets/img/fieldPlaceholder.svg" class="!w-[18rem]" />
                <div class="text-2xl text-gray-600 font-bold text-center">Select a field</div>
                <div class="text-center text-sm px-2 text-gray-500">
                  Make changes to field properties by selecting a field from the list
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.add {
  background-color: #e6ffed !important;
  border-color: #b7eb8f;
}
.update {
  background-color: #fffbe6 !important;
  border-color: #ffe58f;
}
.delete {
  background-color: #fff1f0 !important;
  border-color: #ffa39e;
}
.selected {
  @apply bg-brand-50;
}
.slide-fade-enter-active {
  transition: all 0.3s ease-out;
}

.slide-fade-leave-active {
  transition: all 0.5s cubic-bezier(1, 0.5, 0.8, 1);
}

.skip-animation {
  transition: none;
}

.slide-fade-enter-from {
  transform: translateX(20px);
  opacity: 0;
}
.slide-fade-leave-to {
  opacity: 0;
}
</style>
