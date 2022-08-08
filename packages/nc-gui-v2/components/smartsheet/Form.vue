<script setup lang="ts">
import Draggable from 'vuedraggable'
import { RelationTypes, UITypes, getSystemColumns, isVirtualCol } from 'nocodb-sdk'
import { useToast } from 'vue-toastification'
import type { Permission } from '~/composables/useUIPermission/rolePermissions'
import { computed, inject, onClickOutside, useDebounceFn } from '#imports'
import { ActiveViewInj, FieldsInj, IsFormInj, MetaInj } from '~/context'
import { extractSdkResponseErrorMsg } from '~/utils'
import MdiPlusIcon from '~icons/mdi/plus'
import MdiDragIcon from '~icons/mdi/drag-vertical'
import MdiHideIcon from '~icons/mdi/eye-off-outline'

provide(IsFormInj, true)

// todo: generate hideCols based on default values
const hiddenCols = ['created_at', 'updated_at']

const toast = useToast()

const state = useGlobal()

const formRef = ref()

const { $api, $e } = useNuxtApp()

const { isUIAllowed } = useUIPermission()

const formState = reactive({
  heading: '',
  subheading: '',
  submit_another_form: false,
  show_blank_form: false,
  email: false,
  success_msg: '',
  fields: {},
})

const isEditable = isUIAllowed('editFormView' as Permission)

const meta = inject(MetaInj)

const view = inject(ActiveViewInj)

if (meta) useProvideColumnCreateStore(meta)

const {
  loadData,
  paginationData,
  formattedData: data,
  loadFormView,
  insertRow,
  formColumnData,
  formViewData,
  changePage,
  updateRowProperty,
} = useViewData(meta, view as any)

const { showAll, hideAll, saveOrUpdate } = useViewColumns(view, meta as any, false, async () => {
  await loadFormView()
  setFormData()
})

const columns = computed(() => meta?.value?.columns || [])

const localColumns = ref<Record<string, any>>([])

const hiddenColumns = ref<Record<string, any>>([])

const availableColumns = inject(FieldsInj, ref([]))

const rowRef = ref()

const editOrAddRef = ref()

const systemFieldsIds = ref<Record<string, any>>([])

const showColumnDropdown = ref(false)

const drag = ref(false)

const activeRow = ref('')

const formView = ref({})

function updateView() {}

async function submitForm() {
  try {
    await formRef.value?.validateFields()
  } catch (e: any) {
    e.errorFields.map((f: Record<string, any>) => toast.error(f.errors.join(',')))
    return
  }

  insertRow(formState)
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
    if ((col.rqd && !col.default) || (formState as Record<string, any>)?.fields[column.title]?.required) {
      isRequired = true
    }
  }

  return isRequired
}

function onMove(event: any) {
  const { newIndex, element, oldIndex } = event.added || event.moved || event.removed

  if (event.added) {
    element.show = true
  }

  if (event.removed) {
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
      element.order = (localColumns.value[newIndex - 1]?.order || 0) + (localColumns.value[newIndex + 1].order || 0) / 2
    }
    saveOrUpdate(element, newIndex)
  }

  $e('a:form-view:reorder')
}

function hideColumn(idx: number) {
  if (isDbRequired(localColumns.value[idx]) || localColumns.value[idx].required) {
    toast.info("Required field can't be moved")
    return
  }

  saveOrUpdate(
    {
      ...localColumns.value[idx],
      show: false,
    },
    idx,
  )
  ;(localColumns.value[idx] as any).show = false

  $e('a:form-view:hide-columns')
}

async function addAllColumns() {
  for (const col of (formColumnData as Record<string, any>)?.value) {
    if (!systemFieldsIds.value.includes(col.fk_column_id)) {
      col.show = true
    }
  }
  await showAll(systemFieldsIds.value)
  $e('a:form-view:add-all')
}

async function removeAllColumns() {
  for (const col of (formColumnData as Record<string, any>)?.value) {
    if (isDbRequired(col) || !!col.required) {
      continue
    }
    col.show = false
  }
  await hideAll(
    (localColumns as Record<string, any>)?.value
      .filter((f: Record<string, any>) => isDbRequired(f) || !!f.required)
      .map((f: Record<string, any>) => f.fk_column_id),
  )
  $e('a:form-view:remove-all')
}

async function checkSMTPStatus() {}

function setFormData() {
  Object.assign(formState, {
    heading: formViewData.value?.heading,
    subheading: formViewData.value?.subheading,
    submit_another_form: !!formViewData.value?.submit_another_form,
    show_blank_form: !!formViewData.value?.email,
    email: formViewData.value?.submit_another_form,
    success_msg: formViewData.value?.success_msg,
    fields: (formColumnData.value as Record<string, any>[])?.map((c) => ({
      [c.title]: {
        required: false,
      },
    })),
  })

  const col = (formColumnData as Record<string, any>)?.value

  localColumns.value = col
    .filter((f: Record<string, any>) => f.show && f.uidt !== UITypes.Rollup && f.uidt !== UITypes.Lookup)
    .sort((a: Record<string, any>, b: Record<string, any>) => a.order - b.order)
    .map((c: Record<string, any>) => ({ ...c, required: !!(c.required || 0) }))

  systemFieldsIds.value = getSystemColumns(col).map((c: Record<string, any>) => c.fk_column_id)

  hiddenColumns.value = col.filter((f: Record<string, any>) => !f.show && !systemFieldsIds.value.includes(f.fk_column_id))
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

const updateColMeta = useDebounceFn(async (col: Record<string, any>) => {
  if (col.id) {
    try {
      $api.dbView.formColumnUpdate(col.id, col)
    } catch (e: any) {
      toast.error(await extractSdkResponseErrorMsg(e))
    }
  }
}, 250)

onClickOutside(rowRef, () => {
  activeRow.value = ''
})

onClickOutside(editOrAddRef, () => {
  showColumnDropdown.value = false
})

onMounted(async () => {
  await loadFormView()
  setFormData()
})

// TODO: check if it's required
watch(
  () => formColumnData || formViewData,
  (v) => {
    setFormData()
  },
)
</script>

<template>
  <a-row class="h-full flex">
    <a-col v-if="isEditable" :span="8" class="bg-[#f7f7f7] shadow-md pa-5 h-full overflow-auto scrollbar-thin-primary">
      <div class="flex">
        <div class="flex flex-row flex-1 text-lg">
          <span>
            <!-- Fields -->
            {{ $t('objects.fields') }}
          </span>
        </div>
        <div class="flex flex-row">
          <div class="cursor-pointer mr-2">
            <span
              v-if="hiddenColumns.length"
              class="mr-2"
              style="border-bottom: 2px solid rgb(218, 218, 218)"
              @click="addAllColumns"
            >
              <!-- Add all -->
              {{ $t('general.addAll') }}
            </span>
            <span
              v-if="localColumns.length"
              class="ml-2"
              style="border-bottom: 2px solid rgb(218, 218, 218)"
              @click="removeAllColumns"
            >
              <!-- Remove all -->
              {{ $t('general.removeAll') }}
            </span>
          </div>
        </div>
      </div>
      <draggable :list="hiddenColumns" draggable=".item" group="form-inputs" @start="drag = true" @end="drag = false">
        <template #item="{ element }">
          <a-card size="small" class="ma-0 pa-0 cursor-pointer item mb-2">
            <div class="flex">
              <div class="flex flex-row flex-1">
                <SmartsheetHeaderVirtualCell
                  v-if="isVirtualCol(element)"
                  :column="{ ...element, title: element.label || element.title }"
                  :required="isRequired(element, element.required)"
                />
                <SmartsheetHeaderCell
                  v-else
                  class="w-full"
                  :column="{ ...element, title: element.label || element.title }"
                  :required="isRequired(element, element.required)"
                />
              </div>
              <div class="flex flex-row">
                <MdiDragIcon class="flex flex-1" />
              </div>
            </div>
          </a-card>
        </template>
        <template #footer>
          <div class="mt-4 border-dashed border-2 border-gray-400 py-3 text-gray-400 text-center">
            <!-- Drag and drop fields here to hide -->
            {{ $t('msg.info.dragDropHide') }}
          </div>
          <a-button type="link" class="w-full caption mt-2" size="large" @click="showColumnDropdown = true">
            <div class="flex items-center prose-sm justify-center text-gray-400">
              <MdiPlusIcon />
              <!-- Add new field to this table -->
              {{ $t('activity.addField') }}
            </div>
          </a-button>
          <!-- TODO #2: make the component out of sidebar  -->
          <!-- TODO #3: reload view  -->
          <SmartsheetColumnEditOrAdd
            ref="editOrAddRef"
            v-if="showColumnDropdown"
            @click.stop
            @cancel="showColumnDropdown = false"
          />
        </template>
      </draggable>
    </a-col>
    <a-col :span="isEditable ? 16 : 24" class="h-full overflow-auto scrollbar-thin-primary">
      <a-card class="h-full">
        <a-form ref="formRef" :model="formState" class="bg-[#fefefe]">
          <!-- Header -->
          <div class="pb-2">
            <a-form-item class="ma-0 gap-0 pa-0">
              <a-input
                v-model:value="formState.heading"
                class="w-full text-bold text-h3"
                size="large"
                hide-details
                placeholder="Form Title"
                :bordered="false"
                @blur="updateView()"
                @keydown.enter="updateView()"
              />
            </a-form-item>
          </div>
          <!-- Sub Header -->
          <a-form-item>
            <a-input
              v-model:value="formState.subheading"
              class="w-full"
              size="large"
              hide-details
              :placeholder="$t('msg.info.formDesc')"
              :bordered="false"
              @click="updateView"
            />
          </a-form-item>
          <draggable
            :list="localColumns"
            item-key="fk_column_id"
            draggable=".item"
            group="form-inputs"
            class="h-100"
            filter=".disable-drag"
            @change="onMove($event)"
            @start="drag = true"
            @end="drag = false"
          >
            <template #item="{ element, index }">
              <div
                ref="rowRef"
                class="nc-editable item cursor-pointer hover:bg-primary/10 pa-3"
                :class="{ 'disable-drag': isDbRequired(element) || element.required }"
                @click="activeRow = element.title"
              >
                <div class="flex">
                  <div class="flex flex-1">
                    <SmartsheetHeaderVirtualCell
                      v-if="isVirtualCol(element)"
                      :column="{ ...element, title: element.label || element.title }"
                      :required="isRequired(element, element.required)"
                    />
                    <SmartsheetHeaderCell
                      v-else
                      :column="{ ...element, title: element.label || element.title }"
                      :required="isRequired(element, element.required)"
                    />
                  </div>
                  <div v-if="isUIAllowed('editFormView') && !isRequired(element, element.required)" class="flex">
                    <MdiHideIcon class="opacity-0 nc-field-remove-icon" @click.stop="hideColumn(index)" />
                  </div>
                </div>
                <div class="nc-input">
                  <a-form-item
                    v-if="isVirtualCol(element)"
                    class="ma-0 gap-0 pa-0"
                    :name="element.title"
                    :rules="[{ required: element.required, message: `${element.title} is required` }]"
                  >
                    <SmartsheetVirtualCell v-model="formState[element.title]" :column="element" />
                  </a-form-item>
                  <a-form-item
                    v-else
                    class="ma-0 gap-0 pa-0"
                    :name="element.title"
                    :rules="[{ required: element.required, message: `${element.title} is required` }]"
                  >
                    <SmartsheetCell v-model="formState[element.title]" :column="element" :edit-enabled="true" />
                  </a-form-item>
                </div>

                <div v-if="activeRow === element.title" class="">
                  <a-input
                    v-model:value="element.label"
                    class="nc-input"
                    size="large"
                    :placeholder="$t('msg.info.formInput')"
                    @change="updateColMeta(element)"
                  >
                  </a-input>
                  <a-input
                    v-model:value="element.description"
                    class="nc-input"
                    :placeholder="$t('msg.info.formHelpText')"
                    size="large"
                    @change="updateColMeta(element)"
                  />
                  <a-switch
                    v-model:checked="element.required"
                    class="mb-2"
                    :checked-children="$t('general.required')"
                    un-checked-children="Not Required"
                    @change="updateColMeta(element)"
                  ></a-switch>
                </div>
                <span class="text-gray-500">{{ element.description }}</span>
              </div>
            </template>
            <template #footer>
              <div v-if="!localColumns.length" class="mt-4 border-dashed border-2 border-gray-400 py-3 text-gray-400 text-center">
                Drag and drop fields here to add
              </div>
            </template>
          </draggable>
        </a-form>

        <div class="justify-center flex mt-5">
          <a-button class="flex items-center gap-2 !bg-primary text-white rounded" size="large" @click="submitForm">
            <!-- Submit -->
            {{ $t('general.submit') }}
          </a-button>
        </div>

        <!-- After form is submitted -->
        <div class="text-gray-500 mt-10 mb-4">
          {{ $t('msg.info.afterFormSubmitted') }}
        </div>
        <!-- Show this message -->
        <label class="text-gray-600 text-bold"> {{ $t('msg.info.showMessage') }}: </label>
        <a-textarea v-model="formState.success_msg" rows="3" hide-details @input="updateView" />

        <!-- Other options -->
        <div class="mt-4">
          <div class="my-4">
            <!-- Show "Submit Another Form" button -->
            <a-switch v-model:checked="formState.submit_another_form" v-t="[`a:form-view:submit-another-form`]" />
            <span class="ml-4">{{ $t('msg.info.submitAnotherForm') }}</span>
          </div>

          <div class="my-4">
            <!-- Show a blank form after 5 seconds -->
            <a-switch v-model:checked="formState.show_blank_form" v-t="[`a:form-view:show-blank-form`]" />
            <span class="ml-4">{{ $t('msg.info.showBlankForm') }}</span>
          </div>

          <div class="my-4">
            <a-switch v-model:checked="formState.email" v-t="[`a:form-view:email-me`]" />
            <!-- Email me at <email> -->
            <span class="ml-4">
              {{ $t('msg.info.emailForm') }} <span class="text-bold text-gray-600">{{ state.user.value?.email }}</span>
            </span>
          </div>
        </div>
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
  @apply w-full !bg-white rounded px-2 py-2 min-h-[40px] mt-2 mb-2 flex align-center border-solid border-1 border-primary;
}
</style>
