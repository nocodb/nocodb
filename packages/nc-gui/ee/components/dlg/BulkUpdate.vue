<script setup lang="ts">
import type { TableType, ViewType } from 'nocodb-sdk'
import { RelationTypes, UITypes, isSystemColumn, isVirtualCol } from 'nocodb-sdk'
import Draggable from 'vuedraggable'

interface Props {
  modelValue: boolean
  meta: TableType
  view?: ViewType
  bulkUpdateRows?: Function
  rows?: Row[]
}

const props = defineProps<Props>()

const emits = defineEmits(['update:modelValue', 'cancel'])

const meta = toRef(props, 'meta')

const isExpanded = useVModel(props, 'modelValue', emits, {
  defaultValue: false,
})

// override cell click hook to avoid unexpected behavior at form fields
provide(CellClickHookInj, null)

provide(MetaInj, meta)

provide(IsFormInj, ref(true))

provide(IsExpandedFormOpenInj, isExpanded)

provide(IsExpandedBulkUpdateFormOpenInj, isExpanded)

const formState: Record<string, any> = reactive({})

const moved = ref(false)

const drag = ref(false)

const editColumns = ref<Record<string, any>[]>([])

const tempRow = ref<Row>({
  row: {},
  oldRow: {},
  rowMeta: {},
})

useProvideSmartsheetRowStore(tempRow)

const fields = computed(() => {
  return (meta.value.columns ?? []).filter(
    (col) =>
      !isSystemColumn(col) &&
      !isVirtualCol(col) &&
      col.uidt !== UITypes.Attachment &&
      !col.pk &&
      !col.unique &&
      editColumns.value.find((c) => c.id === col.id) === undefined,
  )
})

const editCount = computed(() => {
  return props.rows!.length
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

const modalQn = computed(() => {
  return `Do you want to update ${editCount.value} selected ${editCount.value === 1 ? 'record' : 'records'}?`
})

const isModalOpen = ref(false)

const isDeleting = ref(false)

const saveData = async () => {
  try {
    isDeleting.value = true
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
  } finally {
    isExpanded.value = false
    isDeleting.value = false
  }
}

const addAllColumns = () => {
  for (const col of fields.value) {
    if (editColumns.value.find((c) => c.id === col.id)) {
      continue
    }
    if (!col || !col.title) continue
    editColumns.value.push(col)
    formState[col.title] = null
  }
}

const removeAllColumns = () => {
  for (const col of editColumns.value) {
    delete formState[col.title]
  }
  editColumns.value = []
}

onMounted(() => {
  if (!props.rows) {
    isExpanded.value = false
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
    <div class="flex p-2 items-center gap-2 p-4 nc-bulk-update-header">
      <h5 class="text-lg font-weight-medium flex items-center gap-1 mb-0 min-w-0 overflow-x-hidden truncate">
        <GeneralTableIcon :meta="meta" class="mx-2" />

        <template v-if="meta">
          {{ meta.title }}
        </template>
        <!-- TODO i18n -->
        <div>: Bulk Update ({{ editCount }} records)</div>
      </h5>

      <div class="flex-1" />
      <NcButton class="nc-bulk-update-save-btn" type="primary" :disabled="!editColumns.length" @click="isModalOpen = true">
        <div class="flex items-center">
          <component :is="iconMap.contentSaveStay" class="mr-1" />
          <!-- TODO i18n -->
          Bulk Update Selected
        </div>
      </NcButton>
      <a-dropdown>
        <component :is="iconMap.threeDotVertical" class="nc-icon-transition" />
        <template #overlay>
          <a-menu>
            <a-menu-item @click="isExpanded = false">
              <div v-e="['c:row-expand:delete']" class="py-2 flex gap-2 items-center">
                <component
                  :is="iconMap.closeCircle"
                  class="nc-icon-transition cursor-pointer select-none nc-delete-row text-gray-500 mx-1 min-w-4"
                />
                {{ $t('general.close') }}
              </div>
            </a-menu-item>
          </a-menu>
        </template>
      </a-dropdown>
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
          @change="onMove($event)"
          @start="drag = true"
          @end="drag = false"
        >
          <template #item="{ element }">
            <div
              class="color-transition nc-editable item cursor-pointer hover:(bg-primary bg-opacity-10 ring-1 ring-accent ring-opacity-100) px-4 lg:px-12 py-4 relative"
              :class="[`nc-bulk-update-drag-${element.title.replaceAll(' ', '')}`]"
              data-testid="nc-bulk-update-fields"
            >
              <div class="text-gray group absolute top-4 right-12">
                <component
                  :is="iconMap.eyeSlash"
                  class="opacity-0 nc-field-remove-icon group-hover:text-red-500 cursor-pointer !text-xl"
                  data-testid="nc-bulk-update-fields-remove-icon"
                  @click="handleRemove(element)"
                />
              </div>

              <div>
                <LazySmartsheetHeaderVirtualCell
                  v-if="isVirtualCol(element)"
                  :column="{ ...element, title: element.label || element.title }"
                  :required="isRequired(element, element.required)"
                  :hide-menu="true"
                  data-testid="nc-bulk-update-input-label"
                />

                <LazySmartsheetHeaderCell
                  v-else
                  :column="{ ...element, title: element.label || element.title }"
                  :required="isRequired(element, element.required)"
                  :hide-menu="true"
                  data-testid="nc-bulk-update-input-label"
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
                  class="nc-input"
                  :class="`nc-bulk-update-input-${element.title.replaceAll(' ', '')}`"
                  :data-testid="`nc-bulk-update-input-${element.title.replaceAll(' ', '')}`"
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
                <LazySmartsheetDivDataCell class="!bg-white rounded px-1 min-h-[35px] flex items-center mt-2 relative">
                  <LazySmartsheetCell
                    v-model="formState[element.title]"
                    :data-testid="`nc-bulk-update-input-${element.title.replaceAll(' ', '')}`"
                    :column="element"
                    :edit-enabled="true"
                    :active="true"
                  />
                </LazySmartsheetDivDataCell>
              </a-form-item>

              <div class="nc-bulk-update-help-text text-gray-500 text-xs" data-testid="nc-bulk-update-input-help-text-label">
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
      <div class="nc-columns-drawer w-1/3 p-3 flex flex-col bg-[#eceff1]" :class="{ active: columnsDrawer }">
        <div class="text-bold uppercase text-gray-500 font-weight-bold !mb-2">
          <!-- TODO i18n -->
          Select columns to Edit
        </div>
        <div class="flex flex-wrap gap-2 mb-4">
          <NcButton
            v-if="fields.length > editColumns.length"
            type="button"
            data-testid="nc-bulk-update-add-all"
            tabindex="-1"
            @click="addAllColumns"
          >
            <!-- Add all -->
            {{ $t('general.addAll') }}
          </NcButton>

          <NcButton
            v-if="editColumns.length"
            type="button"
            data-testid="nc-bulk-update-remove-all"
            tabindex="-1"
            @click="removeAllColumns"
          >
            <!-- Remove all -->
            {{ $t('general.removeAll') }}
          </NcButton>
        </div>

        <Draggable
          :list="fields"
          item-key="id"
          draggable=".item"
          group="form-inputs"
          class="flex flex-col gap-2 flex-1"
          @start="drag = true"
          @end="drag = false"
        >
          <template #item="{ element }">
            <a-card
              size="small"
              class="!border-0 color-transition cursor-pointer item hover:(bg-primary ring-1 ring-accent ring-opacity-100) bg-opacity-10 !rounded !shadow-lg"
              :data-testid="`nc-bulk-update-hidden-column-${element.label || element.title}`"
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

    <GeneralModal v-model:visible="isModalOpen" class="!w-100">
      <div class="p-4">
        <div class="prose-xl font-bold self-center">Bulk Update</div>

        <div class="mt-4">{{ modalQn }}</div>
      </div>
      <div class="flex flex-row gap-x-2 mt-1 pt-1.5 justify-end p-4">
        <NcButton type="secondary" @click="isModalOpen = false">{{ $t('general.cancel') }}</NcButton>
        <NcButton :loading="isDeleting" class="nc-bulk-update-save-btn" @click="saveData">{{ $t('general.confirm') }} </NcButton>
      </div>
    </GeneralModal>
  </a-drawer>
</template>

<style scoped lang="scss">
:deep(input, select, textarea) {
  @apply !bg-white;
}

.nc-bulk-update-wrapper {
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

.nc-bulk-update-input-label,
.nc-bulk-update-input-help-text {
  &::placeholder {
    @apply !text-gray-500 !text-xs;
  }
}

.nc-bulk-update-help-text,
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
