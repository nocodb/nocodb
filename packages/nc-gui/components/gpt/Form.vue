<script setup lang="ts">
import Draggable from 'vuedraggable'
import type { TableInfoType, TableType, ViewType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { RelationTypes, UITypes, getSystemColumns, isVirtualCol } from 'nocodb-sdk'
import {
  ActiveViewInj,
  MetaInj,
  useGPTStoreOrThrow,
  useI18n,
  useProvideSmartsheetRowStore,
  useProvideSmartsheetStore,
  useUIPermission,
  useViewData,
} from '#imports'

const { gptTable, gptView } = useGPTStoreOrThrow()

provide(MetaInj, gptTable as Ref<TableType>)

provide(ActiveViewInj, gptView)

provide(IsFormInj, ref(true))

useProvideSmartsheetStore(gptView as Ref<ViewType>, gptTable as Ref<TableType>)

console.log(gptTable)

const { loadFormView, insertRow, formColumnData, formViewData, updateFormView } = useViewData(
  gptTable as Ref<TableType>,
  gptView as Ref<ViewType>,
)

const reloadEventHook = createEventHook<boolean | void>()

provide(ReloadViewDataHookInj, reloadEventHook)

reloadEventHook.on(async () => {
  await loadFormView()
  setFormData()
})

const { saveOrUpdate } = useViewColumns(gptView as Ref<ViewType>, gptTable as Ref<TableType>, async () =>
  reloadEventHook.trigger(),
)

// todo: generate hideCols based on default values
const hiddenCols = ['created_at', 'updated_at']

const hiddenColTypes = [UITypes.Rollup, UITypes.Lookup, UITypes.Formula, UITypes.QrCode, UITypes.SpecificDBType]

const state = useGlobal()

const formRef = ref()

const { $api, $e } = useNuxtApp()

const { isUIAllowed } = useUIPermission()

const { t } = useI18n()

const formState = reactive({})

const { syncLTARRefs, row } = useProvideSmartsheetRowStore(
  gptTable as Ref<TableType>,
  ref({
    row: formState,
    oldRow: {},
    rowMeta: { new: true },
  }),
)

const columns = computed(() => (gptTable?.value as TableInfoType)?.column || [])

const localColumns = ref<Record<string, any>[]>([])

const hiddenColumns = ref<Record<string, any>[]>([])

const draggableRef = ref()

const systemFieldsIds = ref<Record<string, any>[]>([])

const showColumnDropdown = ref(false)

const moved = ref(false)

const drag = ref(false)

const emailMe = ref(false)

const submitted = ref(false)

const activeRow = ref('')

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

  $e('a:form-view:reorder')
}

function hideColumn(idx: number) {
  if (shouldSkipColumn(localColumns.value[idx])) {
    // Required field can't be moved
    message.info(t('msg.info.requriedFieldsCantBeMoved'))
    return
  }

  saveOrUpdate(
    {
      ...localColumns.value[idx],
      show: false,
    },
    idx,
  )

  reloadEventHook.trigger()

  $e('a:form-view:hide-columns')
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
  console.log('setFormData')
  const col = formColumnData?.value || []

  formViewData.value = {
    ...formViewData.value,
    submit_another_form: !!(formViewData.value?.submit_another_form ?? 0),
    show_blank_form: !!(formViewData.value?.show_blank_form ?? 0),
  }

  localColumns.value = col
    .filter((f) => !hiddenColTypes.includes(f.uidt))
    .sort((a, b) => a.order - b.order)
    .map((c) => ({ ...c, required: !!c.required }))

  systemFieldsIds.value = getSystemColumns(col).map((c: any) => c.fk_column_id)

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

const updateView = useDebounceFn(
  () => {
    if ((formViewData.value?.subheading?.length || 0) > 255) {
      return message.error(t('msg.error.formDescriptionTooLong'))
    }

    updateFormView(formViewData.value)
  },
  300,
  { maxWait: 2000 },
)

async function submitCallback() {
  await loadFormView()
  setFormData()
  showColumnDropdown.value = false
}

const updateColMeta = useDebounceFn(async (col: Record<string, any>) => {
  if (col.id) {
    try {
      await $api.dbView.formColumnUpdate(col.id, col)
    } catch (e: any) {
      message.error(await extractSdkResponseErrorMsg(e))
    }
  }
}, 250)

watch(gptView, async () => {
  console.log('loading')
  await loadFormView()
  setFormData()
  console.log('formViewData', formViewData)
})
</script>

<template>
  <a-row class="h-full" data-testid="nc-form-wrapper">
    <a-col v-if="formViewData" class="h-full w-full">
      <div class="h-[200px]">
        <!-- intended to be empty -->
      </div>
      <a-card
        class="p-4 border-none h-full bg-primary"
        :body-style="{
          maxWidth: 'max(50vw, 700px)',
          margin: '0 auto',
          marginTop: '-200px',
          padding: '0px',
        }"
      >
        <a-dropdown v-model:visible="showColumnDropdown" :trigger="['click']" overlay-class-name="nc-dropdown-form-add-column">
          <div class="flex items-center flex-wrap justify-end gap-2 px-8">
            <a-button class="flex items-center" @click.stop="showColumnDropdown = true">
              <span class="color-transition group-hover:text-primary break-words"> Add Field </span>
            </a-button>
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

        <a-form ref="formRef" :model="formState" class="nc-form" no-style>
          <a-card class="!rounded !shadow !m-2 md:(!m-4) xl:(!m-8)" :body-style="{ paddingLeft: '0px', paddingRight: '0px' }">
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
                  :class="[
                    `nc-form-drag-${element.title.replaceAll(' ', '')}`,
                    {
                      'bg-primary bg-opacity-5 ring-0.5 ring-accent ring-opacity-100': activeRow === element.title,
                    },
                  ]"
                  data-testid="nc-form-fields"
                  @click="activeRow = element.title"
                >
                  <div
                    v-if="isUIAllowed('editFormView') && !isRequired(element, element.required)"
                    class="absolute flex top-2 right-2"
                  >
                    <MdiEyeOffOutline
                      class="opacity-0 nc-field-remove-icon"
                      data-testid="nc-field-remove-icon"
                      @click.stop="hideColumn(index)"
                    />
                  </div>

                  <div v-if="activeRow === element.title" class="flex flex-col gap-3 mb-3">
                    <div class="flex gap-2 items-center">
                      <span
                        class="text-gray-500 mr-2 nc-form-input-required"
                        data-testid="nc-form-input-required"
                        @click="
                          () => {
                            element.required = !element.required
                            updateColMeta(element)
                          }
                        "
                      >
                        {{ $t('general.required') }}
                      </span>

                      <a-switch
                        v-model:checked="element.required"
                        v-e="['a:form-view:field:mark-required']"
                        size="small"
                        @change="updateColMeta(element)"
                      />
                    </div>

                    <a-form-item class="my-0 w-1/2 !mb-1">
                      <a-input
                        v-model:value="element.label"
                        type="text"
                        class="form-meta-input nc-form-input-label"
                        data-testid="nc-form-input-label"
                        :placeholder="$t('msg.info.formInput')"
                        @change="updateColMeta(element)"
                      >
                      </a-input>
                    </a-form-item>

                    <a-form-item class="mt-2 mb-0 w-1/2 !mb-1">
                      <a-input
                        v-model:value="element.description"
                        type="text"
                        class="form-meta-input text-sm nc-form-input-help-text"
                        data-testid="nc-form-input-help-text"
                        :placeholder="$t('msg.info.formHelpText')"
                        @change="updateColMeta(element)"
                      />
                    </a-form-item>
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
                      v-model="formState[element.title]"
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
                      v-model="formState[element.title]"
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
                <div
                  v-if="!localColumns.length"
                  class="mt-4 border-dashed border-2 border-gray-400 py-3 text-gray-400 text-center"
                >
                  Drag and drop fields here to add
                </div>
              </template>
            </Draggable>
          </a-card>
        </a-form>
      </a-card>
    </a-col>
  </a-row>
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
