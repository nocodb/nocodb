<script setup lang="ts">
import Draggable from 'vuedraggable'
import { RelationTypes, UITypes, getSystemColumns, isVirtualCol, ViewTypes } from 'nocodb-sdk'
import {
  ActiveViewInj,
  IsFormInj,
  IsGalleryInj,
  MetaInj,
  ReloadViewDataHookInj,
  computed,
  createEventHook,
  extractSdkResponseErrorMsg,
  inject,
  message,
  onClickOutside,
  provide,
  reactive,
  ref,
  useDebounceFn,
  useGlobal,
  useI18n,
  useNuxtApp,
  useUIPermission,
  useViewColumns,
  useViewData,
  watch,
} from '#imports'
import type { Permission } from '~/lib'

provide(IsFormInj, ref(true))
provide(IsGalleryInj, ref(false))

// todo: generate hideCols based on default values
const hiddenCols = ['created_at', 'updated_at']

const state = useGlobal()

const formRef = ref()

const { $api, $e } = useNuxtApp()

const { isUIAllowed } = useUIPermission()

const formState = reactive({})

const secondsRemain = ref(0)

const isEditable = isUIAllowed('editFormView' as Permission)

const meta = inject(MetaInj, ref())

const view = inject(ActiveViewInj, ref())

const { loadFormView, insertRow, formColumnData, formViewData, updateFormView } = useViewData(meta, view)

const reloadEventHook = createEventHook<boolean | void>()

provide(ReloadViewDataHookInj, reloadEventHook)

reloadEventHook.on(async () => {
  await loadFormView()
  setFormData()
})

const { showAll, hideAll, saveOrUpdate } = useViewColumns(view, meta, async () => reloadEventHook.trigger())

const { syncLTARRefs, row } = useProvideSmartsheetRowStore(
  meta,
  ref({
    row: formState,
    oldRow: {},
    rowMeta: { new: true },
  }),
)

const columns = computed(() => meta?.value?.columns || [])

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

const { t } = useI18n()

function updateView() {
  if ((formViewData.value?.subheading?.length || 0) > 255) {
    message.error(t('msg.error.formDescriptionTooLong'))
    return
  }
  updateFormView(formViewData.value)
}

async function submitForm() {
  try {
    await formRef.value?.validateFields()
  } catch (e: any) {
    e.errorFields.map((f: Record<string, any>) => message.error(f.errors.join(',')))
    return
  }

  const insertedRowData = await insertRow(formState)

  if (insertedRowData) {
    await syncLTARRefs(insertedRowData)
  }

  submitted.value = true
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

/** Block user from drag n drop required column to hidden fields */
function onMoveCallback(event: any) {
  if (event.from !== event.to && shouldSkipColumn(event.draggedContext.element)) {
    return false
  }
}

function onMove(event: any) {
  const { newIndex, element, oldIndex } = event.added || event.moved || event.removed

  if (shouldSkipColumn(element)) {
    return
  }

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

async function addAllColumns() {
  for (const col of (localColumns as Record<string, any>)?.value) {
    if (!systemFieldsIds.value.includes(col.fk_column_id)) {
      col.show = true
    }
  }
  await showAll(systemFieldsIds.value)
  $e('a:form-view:add-all')
}

function shouldSkipColumn(col: Record<string, any>) {
  return isDbRequired(col) || !!col.required || (!!col.rqd && !col.cdf)
}

async function removeAllColumns() {
  for (const col of (localColumns as Record<string, any>)?.value) {
    if (!shouldSkipColumn(col)) col.show = false
  }
  await hideAll(
    (localColumns as Record<string, any>)?.value
      .filter((col: Record<string, any>) => shouldSkipColumn(col))
      .map((col: Record<string, any>) => col.fk_column_id),
  )
  $e('a:form-view:remove-all')
}

async function checkSMTPStatus() {
  if (emailMe.value) {
    const emailPluginActive = await $api.plugin.status('SMTP')
    if (!emailPluginActive) {
      emailMe.value = false
      // Please activate SMTP plugin in App store for enabling email notification
      message.info(t('msg.toast.formEmailSMTP'))
      return false
    }
  }
  return true
}

function setFormData() {
  const col = (formColumnData as Record<string, any>)?.value

  formViewData.value = {
    ...formViewData.value,
    submit_another_form: !!(formViewData.value?.submit_another_form ?? 0),
    show_blank_form: !!(formViewData.value?.show_blank_form ?? 0),
  }

  // email me
  let data: Record<string, boolean> = {}
  try {
    data = JSON.parse(formViewData.value?.email || '') || {}
  } catch (e) {}

  emailMe.value = data[state.user.value?.email as string]

  localColumns.value = col
    .filter(
      (f: Record<string, any>) =>
        f.show &&
        f.uidt !== UITypes.Rollup &&
        f.uidt !== UITypes.Lookup &&
        f.uidt !== UITypes.Formula &&
        f.uidt !== UITypes.SpecificDBType,
    )
    .sort((a: Record<string, any>, b: Record<string, any>) => a.order - b.order)
    .map((c: Record<string, any>) => ({ ...c, required: !!(c.required || 0) }))

  systemFieldsIds.value = getSystemColumns(col).map((c: Record<string, any>) => c.fk_column_id)

  hiddenColumns.value = col.filter(
    (f: Record<string, any>) =>
      !f.show &&
      !systemFieldsIds.value.includes(f.fk_column_id) &&
      f.uidt !== UITypes.Rollup &&
      f.uidt !== UITypes.Lookup &&
      f.uidt !== UITypes.Formula &&
      f.uidt !== UITypes.SpecificDBType,
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

async function updateEmail() {
  try {
    if (!(await checkSMTPStatus())) return

    const data = formViewData.value?.email ? JSON.parse(formViewData.value?.email) : {}
    data[state.user.value?.email as string] = emailMe.value
    formViewData.value!.email = JSON.stringify(data)
  } catch (e) {}
}

function onEmailChange() {
  updateEmail()
  updateView()
}

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

watch(submitted, (v) => {
  if (v && formViewData.value?.show_blank_form) {
    secondsRemain.value = 5
    const intvl = setInterval(() => {
      if (--secondsRemain.value < 0) {
        submitted.value = false
        clearInterval(intvl)
      }
    }, 1000)
  }
})

function handleMouseUp(col: Record<string, any>, hiddenColIndex: number) {
  if (!moved.value) {
    const index = localColumns.value.length
    col.order = (index ? localColumns.value[index - 1].order : 0) + 1
    col.show = true

    /** remove column from hiddenColumns and add to localColumns */
    localColumns.value.push(col)
    hiddenColumns.value.splice(hiddenColIndex, 1)

    saveOrUpdate(col, index)
  }
}

onClickOutside(draggableRef, () => {
  activeRow.value = ''
})

onMounted(async () => {
  await loadFormView()
  setFormData()
})

watch(view, (nextView) => {
  if(nextView?.type === ViewTypes.FORM) {
    reloadEventHook.trigger()
  }
})
</script>

<template>
  <a-row v-if="submitted" class="h-full">
    <a-col :span="24">
      <div v-if="formViewData" class="items-center justify-center text-center mt-2">
        <a-alert type="success">
          <template #message>
            <div class="text-center">{{ formViewData.success_msg || 'Successfully submitted form data' }}</div>
          </template>
        </a-alert>
        <div v-if="formViewData.show_blank_form" class="text-gray-400 mt-4">
          New form will be loaded after {{ secondsRemain }} seconds
        </div>
        <div v-if="formViewData.submit_another_form" class="text-center mt-4">
          <a-button type="primary" size="large" @click="submitted = false"> Submit Another Form</a-button>
        </div>
      </div>
    </a-col>
  </a-row>
  <a-row v-else class="h-full flex">
    <a-col
      v-if="isEditable"
      :span="8"
      class="bg-[#f7f7f7] shadow-md p-5 h-full overflow-auto scrollbar-thin-primary nc-form-left-drawer"
    >
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
              class="mr-2 nc-form-add-all"
              style="border-bottom: 2px solid rgb(218, 218, 218)"
              @click="addAllColumns"
            >
              <!-- Add all -->
              {{ $t('general.addAll') }}
            </span>
            <span
              v-if="localColumns.length"
              class="ml-2 nc-form-remove-all"
              style="border-bottom: 2px solid rgb(218, 218, 218)"
              @click="removeAllColumns"
            >
              <!-- Remove all -->
              {{ $t('general.removeAll') }}
            </span>
          </div>
        </div>
      </div>
      <Draggable
        :list="hiddenColumns"
        item-key="id"
        draggable=".item"
        group="form-inputs"
        @start="drag = true"
        @end="drag = false"
      >
        <template #item="{ element, index }">
          <a-card
            size="small"
            class="m-0 p-0 cursor-pointer item mb-2"
            @mousedown="moved = false"
            @mousemove="moved = false"
            @mouseup="handleMouseUp(element, index)"
          >
            <div class="flex">
              <div class="flex flex-row flex-1">
                <LazySmartsheetHeaderVirtualCell
                  v-if="isVirtualCol(element)"
                  :column="{ ...element, title: element.label || element.title }"
                  :required="isRequired(element, element.required)"
                  :hide-menu="true"
                />
                <LazySmartsheetHeaderCell
                  v-else
                  class="w-full"
                  :column="{ ...element, title: element.label || element.title }"
                  :required="isRequired(element, element.required)"
                  :hide-menu="true"
                />
              </div>
              <div class="flex flex-row">
                <MdiDragVertical class="flex flex-1" />
              </div>
            </div>
          </a-card>
        </template>
        <template #footer>
          <div class="mt-4 border-dashed border-2 border-gray-400 py-3 text-gray-400 text-center nc-drag-n-drop-to-hide">
            <!-- Drag and drop fields here to hide -->
            {{ $t('msg.info.dragDropHide') }}
          </div>
          <a-dropdown v-model:visible="showColumnDropdown" :trigger="['click']" overlay-class-name="nc-dropdown-form-add-column">
            <a-button type="link" class="w-full caption mt-2" size="large" @click.stop="showColumnDropdown = true">
              <div class="flex items-center prose-sm justify-center text-gray-400">
                <mdi-plus />
                <!-- Add new field to this table -->
                {{ $t('activity.addField') }}
              </div>
            </a-button>
            <template #overlay>
              <LazySmartsheetColumnEditOrAddProvider
                v-if="showColumnDropdown"
                @submit="submitCallback"
                @cancel="showColumnDropdown = false"
                @click.stop
                @keydown.stop
              />
            </template>
          </a-dropdown>
        </template>
      </Draggable>
    </a-col>
    <a-col v-if="formViewData" :span="isEditable ? 16 : 24" class="h-full overflow-auto scrollbar-thin-primary">
      <div class="h-[200px] !bg-[#dbdad7]">
        <!-- for future implementation of cover image -->
      </div>
      <a-card
        class="m-0 rounded-b-0 p-4 border-none"
        :body-style="{
          maxWidth: '700px',
          margin: '0 auto',
          marginTop: '-200px',
        }"
      >
        <a-form ref="formRef" :model="formState" class="nc-form">
          <a-card class="rounded m-2 py-10 px-5">
            <!-- Header -->
            <a-form-item v-if="isEditable" class="m-0 gap-0 p-0">
              <a-input
                v-model:value="formViewData.heading"
                class="w-full !font-bold !text-4xl"
                size="large"
                hide-details
                placeholder="Form Title"
                :bordered="false"
                @blur="updateView"
                @keydown.enter="updateView"
              />
            </a-form-item>

            <div v-else class="ml-3 w-full text-bold text-h3">{{ formViewData.heading }}</div>

            <!-- Sub Header -->
            <a-form-item v-if="isEditable" class="m-0 gap-0 p-0">
              <a-input
                v-model:value="formViewData.subheading"
                class="w-full"
                size="large"
                hide-details
                :placeholder="$t('msg.info.formDesc')"
                :bordered="false"
                :disabled="!isEditable"
                @blur="updateView"
                @click="updateView"
              />
            </a-form-item>

            <div v-else class="ml-3 mb-5 w-full text-bold text-h3">{{ formViewData.subheading }}</div>

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
                  class="nc-editable item cursor-pointer hover:(bg-primary bg-opacity-10) p-3 my-2 relative"
                  :class="[
                    `nc-form-drag-${element.title.replaceAll(' ', '')}`,
                    {
                      'border-1': activeRow === element.title,
                    },
                  ]"
                  @click="activeRow = element.title"
                >
                  <div
                    v-if="isUIAllowed('editFormView') && !isRequired(element, element.required)"
                    class="absolute flex top-2 right-2"
                  >
                    <mdi-eye-off-outline class="opacity-0 nc-field-remove-icon" @click.stop="hideColumn(index)" />
                  </div>
                  <template v-if="activeRow === element.title">
                    <div class="flex">
                      <div
                        class="flex flex-1 opacity-0 align-center gap-2"
                        :class="{ 'opacity-100': activeRow === element.title }"
                      >
                        <div class="flex flex-row">
                          <mdi-drag-vertical class="flex flex-1" />
                        </div>
                        <div class="items-center flex">
                          <span
                            class="text-xs text-gray-500 mr-2 nc-form-input-required"
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
                            class="ml-2"
                            @change="updateColMeta(element)"
                          />
                        </div>
                      </div>
                    </div>

                    <div class="my-3">
                      <a-form-item class="my-0 w-1/2 !mb-1">
                        <a-input
                          v-model:value="element.label"
                          size="small"
                          class="form-meta-input !bg-[#dbdbdb] nc-form-input-label"
                          :placeholder="$t('msg.info.formInput')"
                          @change="updateColMeta(element)"
                        >
                        </a-input>
                      </a-form-item>

                      <a-form-item class="mt-2 mb-0 w-1/2 !mb-1">
                        <a-input
                          v-model:value="element.description"
                          size="small"
                          class="form-meta-input !bg-[#dbdbdb] text-sm nc-form-input-help-text"
                          :placeholder="$t('msg.info.formHelpText')"
                          @change="updateColMeta(element)"
                        />
                      </a-form-item>
                    </div>
                  </template>
                  <div>
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

                  <a-form-item
                    v-if="isVirtualCol(element)"
                    class="!m-0 gap-0 p-0"
                    :name="element.title"
                    :rules="[{ required: isRequired(element, element.required), message: `${element.title} is required` }]"
                  >
                    <LazySmartsheetVirtualCell
                      v-model="formState[element.title]"
                      :row="row"
                      class="nc-input"
                      :class="`nc-form-input-${element.title.replaceAll(' ', '')}`"
                      :column="element"
                      @click.stop.prevent
                    />
                  </a-form-item>

                  <a-form-item
                    v-else
                    class="!m-0 gap-0 p-0"
                    :name="element.title"
                    :rules="[{ required: isRequired(element, element.required), message: `${element.title} is required` }]"
                  >
                    <LazySmartsheetCell
                      v-model="formState[element.title]"
                      class="nc-input"
                      :class="`nc-form-input-${element.title.replaceAll(' ', '')}`"
                      :column="element"
                      :edit-enabled="true"
                      @click.stop.prevent
                    />
                  </a-form-item>

                  <span class="text-gray-500 text-xs -mt-1 block">{{ element.description }}</span>
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

            <div class="justify-center flex mt-10">
              <a-button type="primary" class="flex items-center gap-2 nc-form-submit" size="large" @click="submitForm">
                <!-- Submit -->
                {{ $t('general.submit') }}
              </a-button>
            </div>
          </a-card>
        </a-form>

        <div v-if="isEditable" class="mx-10 px-10">
          <!-- After form is submitted -->
          <div class="text-gray-500 mt-4 mb-2">
            {{ $t('msg.info.afterFormSubmitted') }}
          </div>

          <!-- Show this message -->
          <label class="text-gray-600 text-bold"> {{ $t('msg.info.showMessage') }}: </label>
          <a-textarea
            v-model:value="formViewData.success_msg"
            :rows="3"
            hide-details
            class="nc-form-after-submit-msg"
            @change="updateView"
          />

          <!-- Other options -->
          <div class="mt-4">
            <div class="my-4">
              <!-- Show "Submit Another Form" button -->
              <a-switch
                v-model:checked="formViewData.submit_another_form"
                v-e="[`a:form-view:submit-another-form`]"
                size="small"
                class="nc-form-checkbox-submit-another-form"
                @change="updateView"
              />
              <span class="ml-4">{{ $t('msg.info.submitAnotherForm') }}</span>
            </div>

            <div class="my-4">
              <!-- Show a blank form after 5 seconds -->
              <a-switch
                v-model:checked="formViewData.show_blank_form"
                v-e="[`a:form-view:show-blank-form`]"
                size="small"
                class="nc-form-checkbox-show-blank-form"
                @change="updateView"
              />
              <span class="ml-4">{{ $t('msg.info.showBlankForm') }}</span>
            </div>

            <div class="my-4">
              <a-switch
                v-model:checked="emailMe"
                v-e="[`a:form-view:email-me`]"
                size="small"
                class="nc-form-checkbox-send-email"
                @change="onEmailChange"
              />
              <!-- Email me at <email> -->
              <span class="ml-4">
                {{ $t('msg.info.emailForm') }} <span class="text-bold text-gray-600">{{ state.user.value?.email }}</span>
              </span>
            </div>
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
  @apply w-full !bg-white rounded px-2 py-2 min-h-[40px] mt-2 mb-2 flex items-center border-solid border-1 border-primary;
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
</style>
