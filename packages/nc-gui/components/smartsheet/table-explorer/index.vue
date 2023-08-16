<script setup lang="ts">
import { diff } from 'deep-object-diff'
import { message } from 'ant-design-vue'
import { type ColumnType, isSystemColumn } from 'nocodb-sdk'
import { type Field, ref, useSmartsheetStoreOrThrow } from '#imports'
import ListIcon from '~icons/nc-icons/list'

interface TableExplorerColumn extends ColumnType {
  id?: string
  temp_id?: string
}

interface op {
  op: 'add' | 'update' | 'delete'
  column: TableExplorerColumn
}

const { $api } = useNuxtApp()

const { getMeta } = useMetas()

const { meta, view } = useSmartsheetStoreOrThrow()

const { fields: viewFields, toggleFieldVisibility } = useViewColumns(view, meta)

const loading = ref(false)

const columnsHash = ref<string>()

const viewOnly = ref(true)

const fields = computed<TableExplorerColumn[]>(() =>
  ((meta.value?.columns as ColumnType[]) || [])
    .filter(
      (col) =>
        !col.pk && !isSystemColumn(col) && (!viewOnly.value || viewFields.value?.find((f) => f.fk_column_id === col.id)?.show),
    )
    .sort((a, b) => {
      if (viewFields.value) {
        return (
          viewFields.value.findIndex((f) => f.fk_column_id === a.id) - viewFields.value.findIndex((f) => f.fk_column_id === b.id)
        )
      }
      return 0
    }),
)

const newFields = ref<TableExplorerColumn[]>([])

const listFields = computed<TableExplorerColumn[]>(() => {
  return fields.value.concat(newFields.value)
})

const activeField = ref()

const searchQuery = ref<string>('')

const filteredListFields = computed<TableExplorerColumn[]>(() => {
  if (searchQuery.value && searchQuery.value.trim().length > 0) {
    return listFields.value.filter((col) => {
      return col.title && col.title.toLowerCase().includes(searchQuery.value.toLowerCase())
    })
  }
  return listFields.value
})

const viewFieldsMap = computed<Record<string, Field>>(() => {
  const temp: Record<string, Field> = {}
  if (viewFields.value) {
    for (const field of viewFields.value) {
      if (field.fk_column_id) temp[field.fk_column_id] = field
    }
  }
  return temp
})

const ops = ref<op[]>([])

const temporaryAddCount = ref(0)

const changingField = ref(false)

const compareCols = (a: TableExplorerColumn, b: TableExplorerColumn) => {
  if (a?.id && b?.id) {
    return a.id === b.id
  } else if (a?.temp_id && b?.temp_id) {
    return a.temp_id === b.temp_id
  }
  return false
}

const changeField = (field: any, event?: MouseEvent) => {
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

const onFieldUpdate = (state: any) => {
  const col = listFields.value.find((col) => compareCols(col, state))
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

const onFieldDelete = (state: any) => {
  const field = ops.value.find((op) => compareCols(op.column, state))
  if (field) {
    if (field.op === 'delete') {
      ops.value = ops.value.filter((op) => op.column.id !== state.id)
    } else if (field.op === 'add') {
      if (activeField.value && compareCols(activeField.value, state)) {
        changeField(undefined)
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

const onFieldAdd = (state: any) => {
  state.temp_id = `temp_${++temporaryAddCount.value}`
  ops.value.push({
    op: 'add',
    column: state,
  })
  newFields.value.push(state)
  activeField.value = state
}

const recoverField = (state: any) => {
  const field = ops.value.find((op) => compareCols(op.column, state))
  if (field) {
    if (field.op === 'delete') {
      ops.value = ops.value.filter((op) => !compareCols(op.column, state))
    } else if (field.op === 'update') {
      ops.value = ops.value.filter((op) => !compareCols(op.column, state))
    }
    changeField(activeField.value)
  }
}

const fieldState = (field: any) => {
  const col = listFields.value.find((col) => compareCols(col, field))
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

const fieldStatus = (field: any) => {
  return fieldStatuses.value[field?.id || field?.temp_id] || ''
}

const clearChanges = () => {
  ops.value = []
  newFields.value = []
  changeField(undefined)
}

const saveChanges = async () => {
  if (!meta.value?.id) return

  loading.value = true

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
  }

  await getMeta(meta.value.id, true)
  columnsHash.value = (await $api.dbTableColumn.hash(meta.value?.id)).hash

  loading.value = false
}

const toggleFieldVisibilityWrapper = async (checked: boolean, field: any) => {
  if (fieldStatuses.value[field.fk_column_id]) {
    message.warning('You cannot change visibility of a field that is being edited. Please save or discard changes first.')
    field.show = !checked
    return
  }
  if (viewOnly.value && !checked && activeField.value && compareCols(activeField.value, { id: field.fk_column_id })) {
    changeField(undefined)
  }
  await toggleFieldVisibility(checked, field)
}

onMounted(async () => {
  if (!meta.value?.id) return
  columnsHash.value = (await $api.dbTableColumn.hash(meta.value?.id)).hash
})
</script>

<template>
  <div class="flex flex-col w-full h-full p-4">
    <!-- TODO i18n -->
    <a-typography-title :level="4">Table Explorer</a-typography-title>

    <a-divider class="!mt-0 !mb-2" />

    <div>
      <div class="flex flex-col">
        <div class="flex px-2 py-2">
          <div class="flex gap-2">
            <NcButton type="ghost" size="small">
              <div class="flex items-center" @click="changeField({})">
                <GeneralIcon icon="plus" class="mx-1 h-3.5 w-3.5 text-gray-500" />
                Add field
              </div>
            </NcButton>
            <NcButton type="ghost" size="small">
              <div class="flex items-center">
                <GeneralIcon icon="magic" class="mx-1 h-3.5 w-3.5 text-gray-500 text-orange-400" />
                Add using AI
              </div>
            </NcButton>
            <NcButton type="ghost" size="small">
              <div class="flex items-center">
                <GeneralIcon icon="magic" class="mx-1 h-3.5 w-3.5 text-gray-500 text-orange-400" />
                Suggest formula
              </div>
            </NcButton>
          </div>
          <div class="flex-1"></div>
          <div class="flex gap-2">
            <template v-if="ops.length > 0">
              <NcButton type="ghost" size="small">
                <div class="flex items-center" :disabled="loading" @click="clearChanges()">Clear Changes</div>
              </NcButton>
              <NcButton type="primary" size="small">
                <div class="flex items-center" :disabled="loading" @click="saveChanges()">Save Changes</div>
              </NcButton>
            </template>
          </div>
        </div>
        <div class="flex px-2 pt-2">
          <div class="w-1/3">
            <a-input v-model:value="searchQuery" class="!h-8 !px-1 !rounded-lg" placeholder="Search field">
              <template #prefix>
                <GeneralIcon icon="search" class="mx-1 h-3.5 w-3.5 text-gray-500 group-hover:text-black" />
              </template>
              <template #suffix>
                <GeneralIcon
                  v-if="searchQuery.length > 0"
                  icon="close"
                  class="mx-1 h-3.5 w-3.5 text-gray-500 group-hover:text-black"
                  @click="searchQuery = ''"
                />
              </template>
            </a-input>
          </div>
          <div class="flex-1"></div>
          <div class="flex items-center gap-2">
            <span class="text-xs text-gray-500">Show fields from current view only</span>
            <a-switch v-model:checked="viewOnly" />
          </div>
        </div>
        <div class="flex mt-2">
          <div class="flex flex-col flex-1 p-2">
            <TransitionGroup name="slide-fade" tag="div">
              <template v-for="field of filteredListFields" :key="`field-${field.id || field.temp_id}`">
                <div
                  class="flex px-2 mb-2 border-1 rounded-lg pl-5 group"
                  :class="`${fieldStatus(field)} ${compareCols(field, activeField) ? 'selected' : ''}`"
                  @click="changeField(field, $event)"
                >
                  <div class="flex items-center py-2.5 gap-2 w-2/6">
                    <NcSwitch
                      v-if="field.id && viewFieldsMap[field.id]"
                      v-model:checked="viewFieldsMap[field.id].show"
                      class="no-action"
                      :disabled="field.pv"
                      @change="toggleFieldVisibilityWrapper($event, viewFieldsMap[field.id])"
                    />
                    <NcSwitch v-else :checked="true" class="no-action" :disabled="true" />
                    {{ fieldState(field)?.title || field.title }}
                  </div>
                  <div class="flex items-center w-2/6">
                    <SmartsheetHeaderCellIcon v-if="field" :column-meta="fieldState(field) || field" />
                    {{ fieldState(field)?.uidt || field.uidt }}
                  </div>
                  <div class="flex flex-1 items-center">
                    <template v-if="fieldStatus(field) === 'delete'">
                      <a-tag class="!rounded" color="red">Deleted field</a-tag>
                    </template>
                    <template v-else-if="fieldStatus(field) === 'add'">
                      <a-tag class="!rounded" color="green">New field</a-tag>
                    </template>
                  </div>
                  <div class="flex items-center justify-end">
                    <div v-if="fieldStatus(field) === 'delete' || fieldStatus(field) === 'update'">
                      <NcButton type="ghost" size="small" class="!bg-white no-action">
                        <div class="flex items-center text-xs gap-2" :disabled="loading" @click="recoverField(field)">
                          <GeneralIcon icon="reload" class="group-hover:text-accent" />
                          Undo Change
                        </div>
                      </NcButton>
                    </div>
                    <a-dropdown v-else :trigger="['click']" overlay-class-name="nc-dropdown-table-explorer" @click.stop>
                      <GeneralIcon icon="threeDotVertical" class="no-action opacity-0 group-hover:(opacity-100) text-gray-500" />

                      <template #overlay>
                        <a-menu>
                          <a-menu-item key="table-explorer-duplicate">
                            <div class="color-transition nc-project-menu-item group">
                              <GeneralIcon icon="duplicate" class="group-hover:text-accent" />
                              Duplicate
                            </div>
                          </a-menu-item>
                          <a-menu-item key="table-explorer-insert-above">
                            <div class="color-transition nc-project-menu-item group">
                              <GeneralIcon icon="arrowUp" class="group-hover:text-accent" />
                              Insert Above
                            </div>
                          </a-menu-item>
                          <a-menu-item key="table-explorer-insert-below">
                            <div class="color-transition nc-project-menu-item group">
                              <GeneralIcon icon="arrowDown" class="group-hover:text-accent" />
                              Insert Below
                            </div>
                          </a-menu-item>

                          <a-menu-divider class="my-0" />

                          <a-menu-item key="table-explorer-delete" @click="onFieldDelete(field)">
                            <div class="color-transition nc-project-menu-item group text-red-500">
                              <GeneralIcon icon="delete" class="group-hover:text-accent" />
                              Delete
                            </div>
                          </a-menu-item>
                        </a-menu>
                      </template>
                    </a-dropdown>
                  </div>
                </div>
              </template>
            </TransitionGroup>
          </div>
          <Transition name="slide-fade">
            <div v-if="!changingField" class="flex p-2 mt-2 w-1/3 border-1 rounded-lg" :class="fieldStatus(activeField)">
              <SmartsheetColumnEditOrAddProvider
                v-if="activeField"
                class="w-full"
                :column="activeField"
                :preload="fieldState(activeField)"
                :table-explorer-columns="listFields"
                embed-mode
                from-table-explorer
                @update="onFieldUpdate"
                @add="onFieldAdd"
              />
              <div v-else class="flex flex-col p-2 mt-2 w-full items-center">
                <ListIcon class="w-[48px] h-[48px]" />
                <div class="text-xl text-center py-[24px]">Select a field</div>
                <div class="text-center">Make changes to field properties by selecting a field from the list</div>
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
  border: 1px solid #1890ff !important;
  background: var(--background-brand, #ebf0ff);
}
.slide-fade-enter-active {
  transition: all 0.3s ease-out;
}

.slide-fade-leave-active {
  transition: all 0.5s cubic-bezier(1, 0.5, 0.8, 1);
}

.slide-fade-enter-from {
  transform: translateX(20px);
  opacity: 0;
}
.slide-fade-leave-to {
  opacity: 0;
}
</style>
