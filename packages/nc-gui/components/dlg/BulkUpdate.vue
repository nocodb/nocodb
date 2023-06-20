<script setup lang="ts">
import type { TableType, ViewType } from 'nocodb-sdk'
import { RelationTypes, UITypes, isSystemColumn, isVirtualCol } from 'nocodb-sdk'
import Draggable from 'vuedraggable'
import { CellClickHookInj, IsFormInj, MetaInj, PaginationDataInj, provide, ref, toRef, useVModel } from '#imports'
import type { Row } from '~/lib'

interface Props {
  modelValue: boolean
  meta: TableType
  view?: ViewType
  bulkUpdateRows?: Function
  bulkUpdateView?: Function
  selectedAllRecords?: boolean
  rows?: Row[]
}

const props = defineProps<Props>()

const emits = defineEmits(['update:modelValue', 'cancel'])

enum BulkUpdateMode {
  ALL = 0,
  SELECTED = 1,
}

const meta = toRef(props, 'meta')

// override cell click hook to avoid unexpected behavior at form fields
provide(CellClickHookInj, null)

provide(MetaInj, meta)

provide(IsFormInj, ref(true))

const formState: Record<string, any> = reactive({})

const updateMode = ref(BulkUpdateMode.ALL)

const editEnabled = ref<boolean[]>([])

const moved = ref(false)

const drag = ref(false)

const editColumns = ref<Record<string, any>[]>([])

const fields = computed(() => {
  return (meta.value.columns ?? []).filter(
    (col) =>
      !isSystemColumn(col) &&
      !isVirtualCol(col) &&
      !col.pk &&
      !col.unique &&
      editColumns.value.find((c) => c.id === col.id) === undefined,
  )
})

const paginatedData = inject(PaginationDataInj)!

const editCount = computed(() => {
  if (updateMode.value === BulkUpdateMode.SELECTED) {
    return props.rows!.length
  } else {
    return paginatedData.value?.totalRows ?? Infinity
  }
})

const isExpanded = useVModel(props, 'modelValue', emits, {
  defaultValue: false,
})

function isRequired(_columnObj: Record<string, any>, required = false) {
  let columnObj = _columnObj
  if (
    columnObj.uidt === UITypes.LinkToAnotherRecord &&
    columnObj.colOptions &&
    columnObj.colOptions.type === RelationTypes.BELONGS_TO
  ) {
    columnObj = (meta?.value?.columns || []).find(
      (c: Record<string, any>) => c.id === columnObj.colOptions.fk_child_column_id,
    ) as Record<string, any>
  }

  return required || (columnObj && columnObj.rqd && !columnObj.cdf)
}

function onMove(event: any) {
  const { element } = event.added || event.moved || event.removed

  if (event.added) {
    if (editColumns.value.find((c) => c.id === element.id)) {
      return
    }
    editColumns.value.push(element)
    formState[element.title] = null
  }

  if (event.removed) {
    delete formState[element.title]
  }
}

function handleMouseUp(col: Record<string, any>) {
  if (!moved.value) {
    if (editColumns.value.find((c) => c.id === col.id)) {
      return
    }
    editColumns.value.push(col)
    formState[col.title] = null
  }
}

function handleRemove(col: Record<string, any>) {
  const index = editColumns.value.findIndex((c) => c.id === col.id)
  if (index > -1) {
    editColumns.value.splice(index, 1)
    delete formState[col.title]
  }
}

const save = () => {
  Modal.confirm({
    title:
      updateMode.value === BulkUpdateMode.SELECTED
        ? `Do you want to update selected ${editCount.value} records?`
        : `Do you want to update all ${editCount.value} records in current view?`,
    type: 'warn',
    onOk: async () => {
      if (updateMode.value === BulkUpdateMode.SELECTED) {
        if (props.rows && props.bulkUpdateRows) {
          const propsToUpdate = Object.keys(formState)
          for (const row of props.rows) {
            for (const prop of Object.keys(row.row)) {
              if (propsToUpdate.includes(prop)) {
                row.row[prop] = formState[prop]
                row.rowMeta.selected = false
              }
            }
          }
          await props.bulkUpdateRows(props.rows, propsToUpdate)
        }
      } else {
        if (props.bulkUpdateView) {
          await props.bulkUpdateView(formState)
        }
      }
      isExpanded.value = false
    },
  })
}

onMounted(() => {
  if (!props.selectedAllRecords && !props.rows) {
    isExpanded.value = false
    return
  }
  if (props.selectedAllRecords && props.selectedAllRecords === true) {
    updateMode.value = BulkUpdateMode.ALL
  } else {
    if (props.rows && props.rows.length) {
      updateMode.value = BulkUpdateMode.SELECTED
    }
  }
})
</script>

<template>
  <a-drawer
    v-model:visible="isExpanded"
    :footer="null"
    width="min(90vw,900px)"
    :body-style="{ 'padding': 0, 'display': 'flex', 'flex-direction': 'column' }"
    :closable="false"
    class="nc-drawer-bulk-update"
    :class="{ active: isExpanded }"
  >
    <div class="flex p-2 items-center gap-2 p-4 nc-expanded-form-header">
      <h5 class="text-lg font-weight-medium flex items-center gap-1 mb-0 min-w-0 overflow-x-hidden truncate">
        <GeneralTableIcon :style="{ color: iconColor }" :meta="meta" class="mx-2" />

        <template v-if="meta">
          {{ meta.title }}
        </template>
        <!-- TODO i18n -->
        <div>: Bulk Update ({{ editCount }} records)</div>
      </h5>

      <div class="flex-1" />
      <a-button v-if="updateMode === BulkUpdateMode.ALL" class="nc-bulk-update-save-btn" type="primary" @click="save">
        <div class="flex items-center">
          <component :is="iconMap.contentSaveExit" class="mr-1" />
          <!-- TODO i18n -->
          Bulk Update All
        </div>
      </a-button>
      <a-button v-else-if="updateMode === BulkUpdateMode.SELECTED" class="nc-bulk-update-save-btn" type="primary" @click="save">
        <div class="flex items-center">
          <component :is="iconMap.contentSaveStay" class="mr-1" />
          <!-- TODO i18n -->
          Bulk Update Selected
        </div>
      </a-button>
    </div>

    <div class="flex w-full !bg-gray-100 flex-1">
      <div class="form w-2/3 p-4">
        <Draggable
          ref="draggableRef"
          :list="editColumns"
          item-key="fk_column_id"
          draggable=".item"
          group="form-inputs"
          class="h-full"
          :move="onMoveCallback"
          @change="onMove($event)"
          @start="drag = true"
          @end="drag = false"
        >
          <template #item="{ element, index }">
            <div
              class="color-transition nc-editable item cursor-pointer hover:(bg-primary bg-opacity-10 ring-1 ring-accent ring-opacity-100) px-4 lg:px-12 py-4 relative"
              :class="[`nc-form-drag-${element.title.replaceAll(' ', '')}`]"
              data-testid="nc-form-fields"
            >
              <div class="text-gray group absolute top-0 right-12">
                <component
                  :is="iconMap.closeCircle"
                  class="group-hover:text-red-500 cursor-pointer text-4xl"
                  @click="handleRemove(element)"
                />
              </div>

              <div>
                <LazySmartsheetHeaderVirtualCell
                  v-if="isVirtualCol(element)"
                  :column="{ ...element, title: element.label || element.title }"
                  :required="isRequired(element, element.required)"
                  :hide-menu="true"
                  data-testid="nc-form-input-label"
                />

                <LazySmartsheetHeaderCell
                  v-else
                  :column="{ ...element, title: element.label || element.title }"
                  :required="isRequired(element, element.required)"
                  :hide-menu="true"
                  data-testid="nc-form-input-label"
                />
              </div>

              <a-form-item
                v-if="isVirtualCol(element)"
                :name="element.title"
                class="!mb-0 nc-input-required-error"
                :rules="[
                  {
                    required: isRequired(element, element.required),
                    message: `${element.label || element.title} is required`,
                  },
                ]"
              >
                <LazySmartsheetVirtualCell
                  v-model="formState[element.title]"
                  :row="row"
                  class="nc-input"
                  :class="`nc-form-input-${element.title.replaceAll(' ', '')}`"
                  :data-testid="`nc-form-input-${element.title.replaceAll(' ', '')}`"
                  :column="element"
                />
              </a-form-item>

              <a-form-item
                v-else
                :name="element.title"
                class="!mb-0 nc-input-required-error"
                :rules="[
                  {
                    required: isRequired(element, element.required),
                    message: `${element.label || element.title} is required`,
                  },
                ]"
              >
                <LazySmartsheetDivDataCell class="relative">
                  <LazySmartsheetCell
                    v-model="formState[element.title]"
                    class="nc-input"
                    :class="`nc-form-input-${element.title.replaceAll(' ', '')}`"
                    :data-testid="`nc-form-input-${element.title.replaceAll(' ', '')}`"
                    :column="element"
                    :edit-enabled="editEnabled[index]"
                    :active="true"
                    @click="editEnabled[index] = true"
                    @cancel="editEnabled[index] = false"
                    @update:edit-enabled="editEnabled[index] = $event"
                  />
                </LazySmartsheetDivDataCell>
              </a-form-item>

              <div class="nc-form-help-text text-gray-500 text-xs" data-testid="nc-form-input-help-text-label">
                {{ element.description }}
              </div>
            </div>
          </template>

          <template #footer>
            <div v-if="!editColumns.length" class="mt-4 border-dashed border-2 border-gray-400 py-3 text-gray-400 text-center">
              <!-- TODO i18n -->
              Drag and drop fields here to edit
            </div>
          </template>
        </Draggable>
      </div>
      <div class="nc-columns-drawer w-1/3 p-3 shadow-md" :class="{ active: columnsDrawer }">
        <div class="flex-1 text-bold uppercase text-gray-500 font-weight-bold !mb-2">
          <!-- TODO i18n -->
          Editable Columns
        </div>

        <Draggable
          :list="fields"
          item-key="id"
          draggable=".item"
          group="form-inputs"
          class="flex flex-col gap-2"
          @start="drag = true"
          @end="drag = false"
        >
          <template #item="{ element }">
            <a-card
              size="small"
              class="!border-0 color-transition cursor-pointer item hover:(bg-primary ring-1 ring-accent ring-opacity-100) bg-opacity-10 !rounded !shadow-lg"
              :data-testid="`nc-form-hidden-column-${element.label || element.title}`"
              @mousedown="moved = false"
              @mousemove="moved = false"
              @mouseup="handleMouseUp(element)"
            >
              <div class="flex">
                <div class="flex flex-1">
                  <LazySmartsheetHeaderVirtualCell
                    v-if="isVirtualCol(element)"
                    :column="{ ...element, title: element.label || element.title }"
                    :required="isRequired(element, element.required)"
                    :hide-menu="true"
                  />

                  <LazySmartsheetHeaderCell
                    v-else
                    :column="{ ...element, title: element.label || element.title }"
                    :required="isRequired(element, element.required)"
                    :hide-menu="true"
                  />
                </div>
              </div>
            </a-card>
          </template>
        </Draggable>
      </div>
    </div>
  </a-drawer>
</template>

<style scoped lang="scss">
:deep(input, select, textarea) {
  @apply !bg-white;
}

.nc-form-wrapper {
  max-height: max(calc(100vh - 65px), 600px);
  height: max-content !important;
}

.nc-editable:hover {
  :deep(.nc-field-remove-icon) {
    @apply opacity-100;
  }
}

.nc-input {
  @apply appearance-none w-full !bg-white rounded px-2 py-2 my-2 border-solid border-1 border-primary border-opacity-50;

  :deep(input) {
    @apply !px-1;
  }
}

.form-meta-input::placeholder {
  @apply text-[#3d3d3d] italic;
}

.nc-form-input-label,
.nc-form-input-help-text {
  &::placeholder {
    @apply !text-gray-500 !text-xs;
  }
}

.nc-form-help-text,
.nc-input-required-error {
  max-width: 100%;
  word-break: break-all;
  white-space: pre-line;
}

:deep(.nc-cell-attachment) {
  @apply p-0;

  .nc-attachment-cell {
    @apply px-4 min-h-[75px] w-full h-full;

    .nc-attachment {
      @apply md: (w-[50px] h-[50px]) lg:(w-[75px] h-[75px]) min-h-[50px] min-w-[50px];
    }

    .nc-attachment-cell-dropzone {
      @apply rounded bg-gray-400/75;
    }
  }
}
</style>
