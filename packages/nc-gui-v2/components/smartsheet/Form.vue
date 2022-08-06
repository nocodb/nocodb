<script setup lang="ts">
import Draggable from 'vuedraggable'
import { RelationTypes, UITypes, getSystemColumns, isVirtualCol } from 'nocodb-sdk'
import { useToast } from 'vue-toastification'
import type { Permission } from '~/composables/useUIPermission/rolePermissions'
import { computed, inject } from '#imports'
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

const {
  loadData,
  paginationData,
  formattedData: data,
  loadFormData,
  formData,
  changePage,
  updateRowProperty,
} = useViewData(meta, view as any)

const { saveOrUpdate } = useViewColumns(view, meta as any, false)

const columns = computed(() => meta?.value?.columns || [])

const hiddenColumns = computed(() => [])

const filteredColumns = computed(() => [])

const fields = inject(FieldsInj, ref([]))

const formView = ref({})

function updateView() {}

function submitForm() {}

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
    if ((col.rqd && !col.default) || formState?.fields[column.title]?.required) {
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
    if (!columns.value.length || columns.value.length === 1) {
      element.order = 1
    } else if (columns.value.length - 1 === newIndex) {
      element.order = (columns.value[newIndex - 1]?.order || 0) + 1
    } else if (newIndex === 0) {
      element.order = (columns.value[1]?.order || 0) / 2
    } else {
      element.order = (columns.value[newIndex - 1]?.order || 0) + (columns.value[newIndex + 1].order || 0) / 2
    }
    saveOrUpdate(element, newIndex)
  }

  $e('a:form-view:reorder')
}

function hideColumn(idx: number) {
  if (isDbRequired(columns.value[idx])) {
    toast.info("Required field can't be removed")
    return
  }

  saveOrUpdate(
    {
      ...columns.value[idx],
      show: false,
    },
    idx,
  )
  ;(columns.value[idx] as any).show = false

  $e('a:form-view:hide-columns')
}

async function addAllColumns() {}

async function removeAllColumns() {}

async function checkSMTPStatus() {}

function setFormData() {
  Object.assign(formState, {
    heading: formData.value?.heading,
    subheading: formData.value?.subheading,
    submit_another_form: !!formData.value?.submit_another_form,
    show_blank_form: !!formData.value?.email,
    email: formData.value?.submit_another_form,
    success_msg: formData.value?.success_msg,
    fields: fields.value.map((c: Record<string, any>) => ({
      [c.title]: {
        required: false,
      },
    })),
  })
}

onMounted(async () => {
  await loadFormData()
  setFormData()
})

// TODO: check if it's required
watch(
  () => formData,
  (v) => {
    setFormData()
  },
)
</script>

<template>
  <a-row class="h-full flex overflow-auto">
    <a-col v-if="isEditable" :span="6" class="bg-[#f7f7f7] shadow-md pa-5">
      {{ formState }}
      <div class="flex">
        <div class="flex flex-row flex-1 text-lg">
          <span>
            <!-- Fields -->
            {{ $t('objects.fields') }}
          </span>
        </div>
        <div class="flex flex-row">
          <div class="cursor-pointer mr-2">
            <span v-if="hiddenColumns.length" style="border-bottom: 2px solid rgb(218, 218, 218)" @click="addAllColumns()">
              <!-- Add all -->
              {{ $t('general.addAll') }}
            </span>
            <span v-if="columns.length" style="border-bottom: 2px solid rgb(218, 218, 218)" @click="removeAllColumns">
              <!-- Remove all -->
              {{ $t('general.removeAll') }}
            </span>
          </div>
        </div>
      </div>
      <draggable :list="hiddenColumns" item-key="title" handle=".nc-child-draggable-icon">
        <template #item="{ element, index }">
          <a-card size="small" class="ma-0 pa-0 cursor-pointer">
            <div class="flex">
              <div class="flex flex-row flex-1">
                <MdiDragIcon />
                <label class=""> TODO: column name </label>
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
          <a-button type="link" class="w-full caption mt-2" size="large" @click="addNewOption()">
            <div class="flex items-center prose-sm justify-center text-gray-400">
              <MdiPlusIcon />
              <!-- Add new field to this table -->
              {{ $t('activity.addField') }}
            </div>
          </a-button>
        </template>
      </draggable>
    </a-col>
    <a-col :span="isEditable ? 18 : 24">
      <a-card class="px-10 py-20 h-full">
        <a-form :model="formState" class="bg-[#fefefe]">
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
        </a-form>

        <draggable :list="fields" item-key="title" draggable=".item" group="div" class="h-100" @change="onMove($event)">
          <template #item="{ element, index }">
            <div class="nc-editable item cursor-pointer hover:bg-primary/10 pa-3">
              <div class="flex">
                <div class="flex flex-1">
                  <SmartsheetHeaderVirtualCell v-if="isVirtualCol(element)" :column="element" />
                  <SmartsheetHeaderCell v-else :column="element" />
                </div>
                <div v-if="isUIAllowed('editFormView')" class="flex">
                  <MdiHideIcon class="opacity-0 nc-field-remove-icon" @click.stop="hideColumn(index)" />
                </div>
              </div>
              <div
                class="w-full !bg-white rounded px-1 min-h-[40px] mt-2 mb-4 pa-2 flex align-center border-solid border-1 border-primary"
              >
                <SmartsheetVirtualCell v-if="isVirtualCol(element)" v-model="formState[element.title]" :column="element" />
                <SmartsheetCell
                  v-else
                  v-model="formState[element.title]"
                  :column="element"
                  :edit-enabled="true"
                  @update:modelValue="changedColumns.push(element.title)"
                />
              </div>
            </div>
          </template>
          <template #footer>
            <div v-if="!columns.length" class="mt-4 border-dashed border-2 border-gray-400 py-3 text-gray-400 text-center">
              Drag and drop fields here to add
            </div>
          </template>
        </draggable>

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
</style>