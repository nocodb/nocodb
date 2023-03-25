<script setup lang="ts">
import Draggable from 'vuedraggable'
import type { TableInfoType, TableType, ViewType } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { RelationTypes, UITypes, getSystemColumns, isVirtualCol } from 'nocodb-sdk'
import {
  ActiveViewInj,
  MetaInj,
  Modal,
  extractSdkResponseErrorMsg,
  resolveComponent,
  useCowriterStoreOrThrow,
  useDialog,
  useI18n,
  useProvideSmartsheetRowStore,
  useProvideSmartsheetStore,
  useUIPermission,
  useViewData,
} from '#imports'

const {
  unsupportedColumnTypes,
  cowriterFormState,
  cowriterFormRef,
  cowriterTable,
  cowriterFormView,
  loadCowriterTable,
  deleteCowriterFormColumn,
} = useCowriterStoreOrThrow()

const { t } = useI18n()

const { $e } = useNuxtApp()

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

const isCreateColumnUsingAIDlgOpen = ref(false)

const isLoadingForm = ref(true)

// todo: generate hideCols based on default values
const hiddenCols = ['created_at', 'updated_at']

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

function onMove(event: any) {
  const { newIndex, element } = event.added || event.moved || event.removed

  element.show = true

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

  $e('a:cowriter-form:reorder')
}

useDialog(resolveComponent('CowriterCreateColumnUsingAIDlg'), {
  'modelValue': isCreateColumnUsingAIDlgOpen,
  'onUpdate:modelValue': (isOpen: boolean) => (isCreateColumnUsingAIDlgOpen.value = isOpen),
  'onSuccess': async () => {
    isCreateColumnUsingAIDlgOpen.value = false
    await loadCowriterTable()
  },
})

function deleteColumn(ele: Record<string, any>) {
  console.log(ele.fk_column_id)
  Modal.confirm({
    title: h('div', ['Do you want to delete ', h('span', { class: 'font-weight-bold' }, [ele.title]), ' column ?']),
    wrapClassName: 'nc-modal-column-delete',
    okText: t('general.delete'),
    okType: 'danger',
    cancelText: t('general.cancel'),
    async onOk() {
      try {
        await deleteCowriterFormColumn(ele.fk_column_id)
      } catch (e: any) {
        message.error(await extractSdkResponseErrorMsg(e))
      }
    },
  })
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
    .filter((f) => !unsupportedColumnTypes.includes(f.uidt) && !systemFieldsIds.value.includes(f.fk_column_id))
    .sort((a, b) => a.order - b.order)
    .map((c) => ({ ...c, required: !!c.required }))

  hiddenColumns.value = col.filter(
    (f) => !f.show && !systemFieldsIds.value.includes(f.fk_column_id) && !unsupportedColumnTypes.includes(f.uidt),
  )
}

async function submitCallback() {
  showColumnDropdown.value = false
}

watch(cowriterFormView, async () => {
  isLoadingForm.value = true
  await loadFormView()
  setFormData()
  isLoadingForm.value = false
})
</script>

<template>
  <a-skeleton v-if="isLoadingForm" class="p-4" />
  <div v-else class="bg-[#FAFAFA] px-[30px] py-[15px] max-h-[max(calc(100vh_-_200px)_,300px)] overflow-y-scroll">
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
            <a-menu-item key="add-column-using-ai" @click="isCreateColumnUsingAIDlgOpen = true">
              <div class="flex items-center py-3">
                <GeneralIcon icon="magic" class="mr-2 text-orange-400" />
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
        @change="onMove($event)"
        @start="drag = true"
        @end="drag = false"
      >
        <template #item="{ element }">
          <div
            class="color-transition nc-editable item cursor-pointer hover:(bg-primary bg-opacity-10 ring-1 ring-accent ring-opacity-100) px-4 lg:px-12 py-4 relative"
            :class="[`nc-form-drag-${element.title.replaceAll(' ', '')}`]"
            data-testid="nc-form-fields"
          >
            <div v-if="isUIAllowed('editFormView')" class="absolute flex top-2 right-2">
              <MdiDeleteOutline class="opacity-0 nc-field-remove-icon" @click.stop="deleteColumn(element)" />
            </div>

            <div>
              <LazySmartsheetHeaderVirtualCell
                v-if="isVirtualCol(element)"
                :column="{ ...element, title: element.label || element.title }"
                :hide-menu="true"
                data-testid="nc-form-input-label"
              />

              <LazySmartsheetHeaderCell
                v-else
                :column="{ ...element, title: element.label || element.title }"
                :hide-menu="true"
                data-testid="nc-form-input-label"
              />
            </div>

            <a-form-item v-if="isVirtualCol(element)" :name="element.title" class="!mb-0">
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

            <a-form-item v-else :name="element.title" class="!mb-0">
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
          <div v-if="!localColumns.length" class="p-3 text-gray-400 flex gap-y-2 flex-col">
            <div class="font-bold">GET STARTED IN 3 SIMPLE STEPS</div>
            <div>1. Click on <span class="text-[#EC6D45]">Add Field</span> button - to add fields required for your prompt</div>
            <div>2. Click on <span class="text-[#EC6D45]">Prompt</span> tab - to create a prompt statement</div>
            <div>3. Click on <span class="text-[#EC6D45]">Generate</span> button.</div>
            <a href="#">Click here to read more</a>
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
