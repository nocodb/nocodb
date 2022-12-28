<script setup lang="ts">
import Draggable from 'vuedraggable'
import type { TableInfoType, TableType, ViewType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { RelationTypes, UITypes, getSystemColumns, isVirtualCol } from 'nocodb-sdk'
import {
  ActiveViewInj,
  MetaInj,
  useCowriterStoreOrThrow,
  useProvideSmartsheetRowStore,
  useProvideSmartsheetStore,
  useUIPermission,
  useViewData,
} from '#imports'

const { cowriterFormState, cowriterFormRef, cowriterTable, cowriterFormView, loadCowriterTable } = useCowriterStoreOrThrow()

provide(MetaInj, cowriterTable as Ref<TableType>)

provide(ActiveViewInj, cowriterFormView)

provide(IsFormInj, ref(true))

useProvideSmartsheetStore(cowriterFormView as Ref<ViewType>, cowriterTable as Ref<TableType>)

const { loadFormView, formColumnData, formViewData } = useViewData(
  cowriterTable as Ref<TableType>,
  cowriterFormView as Ref<ViewType>,
)

const reloadEventHook = createEventHook<boolean | void>()

provide(ReloadViewDataHookInj, reloadEventHook)

reloadEventHook.on(async () => {
  await loadCowriterTable()
})

const { saveOrUpdate } = useViewColumns(cowriterFormView as Ref<ViewType>, cowriterTable as Ref<TableType>, async () =>
  reloadEventHook.trigger(),
)

// todo: generate hideCols based on default values
const hiddenCols = ['created_at', 'updated_at']

const hiddenColTypes = [UITypes.Rollup, UITypes.Lookup, UITypes.Formula, UITypes.QrCode, UITypes.SpecificDBType]

const { $e } = useNuxtApp()

const { isUIAllowed } = useUIPermission()

const { row } = useProvideSmartsheetRowStore(
  cowriterTable as Ref<TableType>,
  ref({
    row: cowriterFormState,
    oldRow: {},
    rowMeta: { new: true },
  }),
)

const columns = computed(() => (cowriterTable?.value as TableInfoType)?.column || [])

const localColumns = ref<Record<string, any>[]>([])

const hiddenColumns = ref<Record<string, any>[]>([])

const draggableRef = ref()

const systemFieldsIds = ref<Record<string, any>[]>([])

const showAddFieldDropdown = ref(false)

const showColumnDropdown = ref(false)

const drag = ref(false)

/** Block user from drag n drop required column to hidden fields */
function onMoveCallback(event: any) {
  if (event.from !== event.to && shouldSkipColumn(event.draggedContext.element)) {
    return false
  }
}

function onMove(event: any) {
  const { newIndex, element, oldIndex } = event.added || event.moved || event.removed

  if (event.added) {
    element.show = true
  }

  if (event.removed) {
    if (shouldSkipColumn(element)) {
      return
    }
    element.show = false
    saveOrUpdate(element, oldIndex)
  } else {
    if (!localColumns.value.length || localColumns.value.length === 1) {
      element.order = 1
    } else if (localColumns.value.length - 1 === newIndex) {
      element.order = (localColumns.value[newIndex - 1]?.order || 0) + 1
    } else if (newIndex === 0) {
      element.order = (localColumns.value[1]?.order || 0) / 2
    } else {
      element.order = ((localColumns.value[newIndex - 1]?.order || 0) + (localColumns.value[newIndex + 1].order || 0)) / 2
    }
    saveOrUpdate(element, newIndex)
  }

  $e('a:cowriter-form:reorder')
}

function deleteColumn(idx: number) {
  // TODO
}

function isDbRequired(column: Record<string, any>) {
  if (hiddenCols.includes(column.fk_column_id)) {
    return false
  }

  let isRequired =
    // confirm column is not virtual
    (!isVirtualCol(column) &&
      // column required / not null
      column.rqd &&
      // column default value
      !column.cdf &&
      // confirm it's not foreign key
      !columns.value.some(
        (c: Record<string, any>) =>
          c.uidt === UITypes.LinkToAnotherRecord &&
          c?.colOptions?.type === RelationTypes.BELONGS_TO &&
          column.fk_column_id === c.colOptions.fk_child_column_id,
      )) ||
    // primary column
    (column.pk && !column.ai && !column.cdf)
  if (column.uidt === UITypes.LinkToAnotherRecord && column.colOptions.type === RelationTypes.BELONGS_TO) {
    const col = columns.value.find((c: Record<string, any>) => c.id === column.colOptions.fk_child_column_id) as Record<
      string,
      any
    >
    if (col.rqd && !col.default) {
      isRequired = true
    }
  }

  return isRequired
}

function shouldSkipColumn(col: Record<string, any>) {
  return isDbRequired(col) || !!col.required || (!!col.rqd && !col.cdf) || col.uidt === UITypes.QrCode
}

function setFormData() {
  const col = formColumnData?.value || []

  formViewData.value = {
    ...formViewData.value,
    submit_another_form: !!(formViewData.value?.submit_another_form ?? 0),
    show_blank_form: !!(formViewData.value?.show_blank_form ?? 0),
  }

  systemFieldsIds.value = getSystemColumns(col).map((c: any) => c.fk_column_id)

  localColumns.value = col
    .filter((f) => !hiddenColTypes.includes(f.uidt) && !systemFieldsIds.value.includes(f.fk_column_id))
    .sort((a, b) => a.order - b.order)
    .map((c) => ({ ...c, required: !!c.required }))

  hiddenColumns.value = col.filter(
    (f) => !f.show && !systemFieldsIds.value.includes(f.fk_column_id) && !hiddenColTypes.includes(f.uidt),
  )
}

function isRequired(_columnObj: Record<string, any>, required = false) {
  let columnObj = _columnObj
  if (
    columnObj.uidt === UITypes.LinkToAnotherRecord &&
    columnObj.colOptions &&
    columnObj.colOptions.type === RelationTypes.BELONGS_TO
  ) {
    columnObj = columns.value.find((c: Record<string, any>) => c.id === columnObj.colOptions.fk_child_column_id) as Record<
      string,
      any
    >
  }

  return required || (columnObj && columnObj.rqd && !columnObj.cdf)
}

async function submitCallback() {
  showColumnDropdown.value = false
}

watch([cowriterTable, cowriterFormView], async () => {
  await loadFormView()
  setFormData()
})
</script>

<template>
  <div class="bg-[#FAFAFA] h-full px-[30px] py-[15px]">
    <div class="flex items-center flex-wrap justify-end gap-2">
      <a-dropdown v-model:visble="showAddFieldDropdown">
        <template #overlay>
          <a-menu>
            <a-menu-item key="add-column" :trigger="['click']">
              <a-dropdown v-model:visible="showColumnDropdown" :trigger="['click']">
                <div class="flex items-center py-3" @click.stop="showColumnDropdown = true">
                  <MdiViewColumnOutline class="mr-2" />
                  Add New Column
                </div>
                <template #overlay>
                  <SmartsheetColumnEditOrAddProvider
                    v-if="showColumnDropdown"
                    @submit="submitCallback"
                    @cancel="showColumnDropdown = false"
                    @click.stop
                    @keydown.stop
                  />
                </template>
              </a-dropdown>
            </a-menu-item>
            <a-menu-item key="add-column-using-ai">
              <div class="flex items-center py-3">
                <PhSparkleFill class="mr-2 text-orange-400" />
                Add New Column Using AI
              </div>
            </a-menu-item>
          </a-menu>
        </template>
        <a-button> Add Field </a-button>
      </a-dropdown>
    </div>

    <a-form ref="cowriterFormRef" :model="cowriterFormState" class="nc-gtp-form" no-style>
      <Draggable
        ref="draggableRef"
        :list="localColumns"
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
            <div v-if="isUIAllowed('editFormView') && !isRequired(element, element.required)" class="absolute flex top-2 right-2">
              <MdiDeleteOutline class="opacity-0 nc-field-remove-icon" @click.stop="deleteColumn(index)" />
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
              class="!mb-0"
              :rules="[{ required: isRequired(element, element.required), message: `${element.title} is required` }]"
            >
              <LazySmartsheetVirtualCell
                v-model="cowriterFormState[element.title]"
                :row="row"
                class="nc-input"
                :class="`nc-form-input-${element.title.replaceAll(' ', '')}`"
                :data-testid="`nc-form-input-${element.title.replaceAll(' ', '')}`"
                :column="element"
                @click.stop.prevent
              />
            </a-form-item>

            <a-form-item
              v-else
              :name="element.title"
              class="!mb-0"
              :rules="[{ required: isRequired(element, element.required), message: `${element.title} is required` }]"
            >
              <LazySmartsheetCell
                v-model="cowriterFormState[element.title]"
                class="nc-input"
                :class="`nc-form-input-${element.title.replaceAll(' ', '')}`"
                :data-testid="`nc-form-input-${element.title.replaceAll(' ', '')}`"
                :column="element"
                :edit-enabled="true"
                @click.stop.prevent
              />
            </a-form-item>

            <div class="text-gray-500 text-xs" data-testid="nc-form-input-help-text-label">{{ element.description }}</div>
          </div>
        </template>

        <template #footer>
          <div v-if="!localColumns.length" class="mt-4 border-1 border-gray-300 py-3 text-gray-400 text-center">
            Click Add Field to add columns
          </div>
        </template>
      </Draggable>
    </a-form>
  </div>
</template>

<style scoped lang="scss">
.nc-editable:hover {
  .nc-field-remove-icon {
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

:deep(.nc-cell-attachment) {
  @apply p-0;

  .nc-attachment-cell {
    @apply px-4 min-h-[75px] w-full h-full;

    .nc-attachment {
      @apply md:(w-[50px] h-[50px]) lg:(w-[75px] h-[75px]) min-h-[50px] min-w-[50px];
    }

    .nc-attachment-cell-dropzone {
      @apply rounded bg-gray-400/75;
    }
  }
}
</style>
