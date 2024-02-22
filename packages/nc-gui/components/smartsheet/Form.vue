<script setup lang="ts">
import Draggable from 'vuedraggable'
import { Pane, Splitpanes } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'
import { RelationTypes, UITypes, ViewTypes, getSystemColumns, isLinksOrLTAR, isVirtualCol } from 'nocodb-sdk'
import type { Permission } from '#imports'
import {
  ActiveViewInj,
  IsFormInj,
  IsGalleryInj,
  MetaInj,
  ReloadViewDataHookInj,
  computed,
  createEventHook,
  extractSdkResponseErrorMsg,
  iconMap,
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
  useRoles,
  useViewColumnsOrThrow,
  useViewData,
  watch,
} from '#imports'

provide(IsFormInj, ref(true))
provide(IsGalleryInj, ref(false))

// todo: generate hideCols based on default values
const hiddenCols = ['created_at', 'updated_at']

const hiddenColTypes = [
  UITypes.Rollup,
  UITypes.Lookup,
  UITypes.Formula,
  UITypes.QrCode,
  UITypes.Barcode,
  UITypes.SpecificDBType,
  UITypes.CreatedTime,
  UITypes.LastModifiedTime,
  UITypes.CreatedBy,
  UITypes.LastModifiedBy,
]

const { isMobileMode, user } = useGlobal()

const formRef = ref()

const { $api, $e } = useNuxtApp()

const { isUIAllowed } = useRoles()

const formState = reactive({})

const secondsRemain = ref(0)

const isLocked = inject(IsLockedInj, ref(false))

const isEditable = isUIAllowed('viewFieldEdit' as Permission)

const meta = inject(MetaInj, ref())

const view = inject(ActiveViewInj, ref())

const isPublic = inject(IsPublicInj, ref(false))

const { loadFormView, insertRow, formColumnData, formViewData, updateFormView } = useViewData(meta, view)

const reloadEventHook = inject(ReloadViewDataHookInj, createEventHook())

reloadEventHook.on(async () => {
  await loadFormView()
  setFormData()
})

const { fields, showAll, hideAll, saveOrUpdate } = useViewColumnsOrThrow()

const { state, row } = useProvideSmartsheetRowStore(
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

const editEnabled = ref<boolean[]>([])

const searchQuery = ref('')

const { t } = useI18n()

const { betaFeatureToggleState } = useBetaFeatureToggle()

const visibleColumns = computed(() => localColumns.value.filter((f) => f.show).sort((a, b) => a.order - b.order))

const updateView = useDebounceFn(
  () => {
    updateFormView(formViewData.value)
  },
  300,
  { maxWait: 2000 },
)

async function submitForm() {
  try {
    await formRef.value?.validateFields()
  } catch (e: any) {
    e.errorFields.map((f: Record<string, any>) => message.error(f.errors.join(',')))
    if (e.errorFields.length) return
  }

  await insertRow({
    row: { ...formState, ...state.value },
    oldRow: {},
    rowMeta: { new: true },
  })

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
          isLinksOrLTAR(c.uidt) &&
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

function onMove(event: any, isVisibleFormFields = false) {
  const { newIndex, element, oldIndex } = event.moved

  const fieldIndex = fields.value?.findIndex((f) => f?.fk_column_id === element.fk_column_id)

  if (fieldIndex === -1 || fieldIndex === undefined) return

  const localColumnIndex = localColumns.value?.findIndex((c) => c.fk_column_id === element.fk_column_id)

  if (!localColumns.value.length || localColumns.value.length === 1) {
    element.order = 1
  } else if (localColumns.value.length - 1 === newIndex) {
    element.order = (localColumns.value[newIndex - 1]?.order || 0) + 1
  } else if (newIndex === 0) {
    element.order = (localColumns.value[1]?.order || 0) / 2
  } else {
    element.order = ((localColumns.value[newIndex - 1]?.order || 0) + (localColumns.value[newIndex + 1].order || 0)) / 2
  }

  saveOrUpdate(element, fieldIndex)

  $e('a:form-view:reorder')
}

function showOrHideColumn(column: Record<string, any>, show: boolean) {
  if (shouldSkipColumn(column)) {
    // Required field can't be moved
    message.info(t('msg.info.requriedFieldsCantBeMoved'))
    return
  }

  const fieldIndex = fields.value?.findIndex((f) => f?.fk_column_id === column.fk_column_id)

  if (fieldIndex !== -1 && fieldIndex !== undefined) {
    saveOrUpdate(
      {
        ...column,
        show: show,
      },
      fieldIndex,
    )

    reloadEventHook.trigger()

    if (show) {
      $e('a:form-view:show-columns')
    } else {
      $e('a:form-view:hide-columns')
    }
  }
}

function shouldSkipColumn(col: Record<string, any>) {
  return (
    isDbRequired(col) || !!col.required || (!!col.rqd && !col.cdf) || col.uidt === UITypes.QrCode || col.uidt === UITypes.Barcode
  )
}

async function handleAddOrRemoveAllColumns(value: boolean) {
  if (value) {
    for (const col of (localColumns as Record<string, any>)?.value) {
      col.show = true
    }
    await showAll(systemFieldsIds.value)
    $e('a:form-view:add-all')
  } else {
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
  const col = formColumnData?.value || []
  systemFieldsIds.value = getSystemColumns(col).map((c) => c.fk_column_id)

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

  emailMe.value = data[user.value?.email as string]

  localColumns.value = col
    .filter((f) => !hiddenColTypes.includes(f.uidt) && !systemFieldsIds.value.includes(f.fk_column_id))
    .sort((a, b) => a.order - b.order)
    .map((c) => ({ ...c, required: !!c.required }))

  editEnabled.value = new Array(localColumns.value.length).fill(false)

  hiddenColumns.value = col.filter(
    (f) => !f.show && !systemFieldsIds.value.includes(f.fk_column_id) && !hiddenColTypes.includes(f.uidt),
  )
}

function isRequired(_columnObj: Record<string, any>, required = false) {
  let columnObj = _columnObj
  if (isLinksOrLTAR(columnObj.uidt) && columnObj.colOptions && columnObj.colOptions.type === RelationTypes.BELONGS_TO) {
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
    data[user.value?.email as string] = emailMe.value
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
  if (isLocked.value) return

  if (!moved.value) {
    const index = localColumns.value.length
    col.order = (index ? localColumns.value[index - 1].order : 0) + 1
    col.show = true

    saveOrUpdate(col, index)
  }
}

const columnSupportsScanning = (elementType: UITypes) =>
  betaFeatureToggleState.show &&
  [UITypes.SingleLineText, UITypes.Number, UITypes.Email, UITypes.URL, UITypes.LongText].includes(elementType)

onClickOutside(draggableRef, () => {
  activeRow.value = ''
})

onMounted(async () => {
  await loadFormView()
  setFormData()
})

watch(view, (nextView) => {
  if (nextView?.type === ViewTypes.FORM) {
    reloadEventHook.trigger()
  }
})

const onFormItemClick = (element: any) => {
  if (isLocked.value) return

  activeRow.value = element.title
}
</script>

<template>
  <div class="h-full">
    <template v-if="isMobileMode">
      <div class="pl-6 pr-[120px] py-6 bg-white flex-col justify-start items-start gap-2.5 inline-flex">
        <div class="text-gray-500 text-5xl font-semibold leading-16">
          {{ $t('general.available') }}<br />{{ $t('title.inDesktop') }}
        </div>
        <div class="text-gray-500 text-base font-medium leading-normal">
          {{ $t('msg.formViewNotSupportedOnMobile') }}
        </div>
      </div>
    </template>
    <template v-else>
      <a-row v-if="submitted" class="h-full" data-testid="nc-form-wrapper-submit">
        <a-col :span="24">
          <div v-if="formViewData" class="items-center justify-center text-center mt-2">
            <a-alert type="success">
              <template #message>
                <div class="text-center">
                  {{ formViewData.success_msg || $t('msg.successfullySubmittedFormData') }}
                </div>
              </template>
            </a-alert>

            <div v-if="formViewData.show_blank_form" class="text-gray-400 mt-4">
              {{
                $t('msg.newFormWillBeLoaded', {
                  seconds: secondsRemain,
                })
              }}
            </div>

            <div v-if="formViewData.submit_another_form || !isPublic" class="text-center mt-4">
              <a-button type="primary" size="large" @click="submitted = false"> {{ $t('activity.submitAnotherForm') }}</a-button>
            </div>
          </div>
        </a-col>
      </a-row>

      <a-row v-else class="h-full flex" data-testid="nc-form-wrapper">
        <a-col v-if="formViewData" :span="isEditable ? 16 : 24" class="h-full overflow-auto nc-form-scrollbar p-6 bg-gray-50">
          <div class="h-[160px] bg-primary bg-opacity-75 border-gray-200 rounded-3xl">
            <!-- for future implementation of cover image -->
          </div>

          <a-card
            class="!p-12 <xl:!p-8 border-gray-200 !rounded-3xl !mt-6 max-w-[688px] !mx-auto"
            :body-style="{
              margin: '0 auto',
              padding: '0px !important',
            }"
          >
            <a-form ref="formRef" :model="formState" class="nc-form" no-style>
              <!-- form header -->
              <div class="flex flex-col gap-4">
                <!-- Form logo  -->
                <div v-if="isEditable">
                  <div class="inline-block rounded-xl bg-gray-100 p-3">
                    <NcButton type="secondary" size="small" class="nc-form-upload-logo" data-testid="nc-form-upload-log">
                      <div class="flex gap-2 items-center">
                        <component :is="iconMap.upload" class="w-4 h-4" />
                        <span> Upload Logo </span>
                      </div>
                    </NcButton>
                  </div>
                </div>
                <!-- form title -->

                <a-form-item v-if="isEditable">
                  <a-textarea
                    v-model:value="formViewData.heading"
                    class="w-full !font-bold !text-4xl !border-0 !border-b-1 !border-dashed !rounded-none !border-gray-400"
                    :style="{
                      'borderRightWidth': '0px !important',
                      'height': '70px',
                      'max-height': '250px',
                      'resize': 'vertical',
                    }"
                    autosize
                    size="large"
                    hide-details
                    :disabled="isLocked"
                    placeholder="Form Title"
                    :bordered="false"
                    data-testid="nc-form-heading"
                    @blur="updateView"
                    @keydown.enter="updateView"
                  />
                </a-form-item>

                <div v-else class="w-full text-bold text-4xl">
                  {{ formViewData.heading }}
                </div>

                <!-- form description  -->
                <a-form-item v-if="isEditable" class="w-full">
                  <a-textarea
                    v-model:value="formViewData.subheading as string"
                    class="w-full !border-0 !border-b-1 !border-dashed !rounded-none !border-gray-400"
                    :style="{
                      'borderRightWidth': '0px !important',
                      'height': '40px',
                      'min-height': '40px',
                      'resize': 'vertical',
                    }"
                    size="large"
                    autosize
                    hide-details
                    :placeholder="$t('msg.info.formDesc')"
                    :bordered="false"
                    :disabled="!isEditable || isLocked"
                    data-testid="nc-form-sub-heading"
                    @blur="updateView"
                    @click="updateView"
                  />
                </a-form-item>

                <div v-else class="px-4 ml-3 w-full text-bold text-md">
                  {{ formViewData.subheading || '---' }}
                </div>
              </div>

              <Draggable
                ref="draggableRef"
                :list="visibleColumns"
                item-key="fk_column_id"
                draggable=".item"
                group="form-inputs"
                class="h-full"
                :move="onMoveCallback"
                :disabled="isLocked"
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
                      {
                        '!hover:bg-white !ring-0 !cursor-auto': isLocked,
                      },
                    ]"
                    data-testid="nc-form-fields"
                    @click="onFormItemClick(element)"
                  >
                    <div
                      v-if="isUIAllowed('viewFieldEdit') && !isRequired(element, element.required) && !isLocked"
                      class="absolute flex top-2 right-2"
                    >
                      <component
                        :is="iconMap.eyeSlash"
                        class="opacity-0 nc-field-remove-icon"
                        data-testid="nc-field-remove-icon"
                        @click.stop="showOrHideColumn(element, !element.show)"
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

                      <a-form-item v-if="columnSupportsScanning(element.uidt)" class="my-0 w-1/2 !mb-1">
                        <div class="flex gap-2 items-center">
                          <span
                            class="text-gray-500 mr-2 nc-form-input-required"
                            data-testid="nc-form-input-enable-scanner"
                            @click="
                              () => {
                                element.general.enable_scanner = !element.general.enable_scanner
                                updateColMeta(element)
                              }
                            "
                          >
                            {{ $t('general.enableScanner') }}
                          </span>

                          <a-switch
                            v-model:checked="element.enable_scanner"
                            v-e="['a:form-view:field:mark-enable-scaner']"
                            size="small"
                            @change="updateColMeta(element)"
                          />
                        </div>
                      </a-form-item>

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

                      <a-form-item class="mt-2 mb-0 w-1/2">
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
                      class="!mb-0 nc-input-required-error nc-form-input-item"
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
                        @click.stop.prevent
                      />
                    </a-form-item>

                    <a-form-item
                      v-else
                      :name="element.title"
                      class="!mb-0 nc-input-required-error nc-form-input-item"
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
                          class="nc-input truncate"
                          :class="`nc-form-input-${element.title.replaceAll(' ', '')}`"
                          :data-testid="`nc-form-input-${element.title.replaceAll(' ', '')}`"
                          :column="element"
                          :edit-enabled="editEnabled[index]"
                          @click="editEnabled[index] = true"
                          @cancel="editEnabled[index] = false"
                          @update:edit-enabled="editEnabled[index] = $event"
                          @click.stop.prevent
                        />
                      </LazySmartsheetDivDataCell>
                    </a-form-item>

                    <div class="nc-form-help-text text-gray-500 text-xs truncate" data-testid="nc-form-input-help-text-label">
                      {{ element.description }}
                    </div>
                  </div>
                </template>

                <template #footer>
                  <div
                    v-if="!visibleColumns.length"
                    class="mt-4 border-dashed border-2 border-gray-400 py-3 text-gray-400 text-center"
                  >
                    Select fields from right panel to add here
                  </div>
                </template>
              </Draggable>

              <div class="flex justify-between items-center mt-6">
                <NcButton
                  html-type="reset"
                  type="secondary"
                  size="small"
                  :disabled="!isUIAllowed('dataInsert')"
                  class="nc-form-clear"
                  data-testid="nc-form-clear"
                >
                  Crear Form
                </NcButton>
                <NcButton
                  html-type="submit"
                  type="primary"
                  size="small"
                  :disabled="!isUIAllowed('dataInsert')"
                  class="nc-form-submit"
                  data-testid="nc-form-submit"
                  @click="submitForm"
                >
                  {{ $t('general.submit') }}
                </NcButton>
              </div>
            </a-form>

            <a-divider v-if="!isLocked" class="!my-8" />

            <!-- Nocodb Branding  -->
            <div class="flex items-center gap-3">
              <!-- Todo: add new NocoDB icon -->
              <img src="~assets/img/icons/64x64.png" alt="NocoDB" class="w-6" />
              <div class="text-sm text-gray-700">NocoDB Forms</div>
            </div>
          </a-card>
        </a-col>
        <a-col v-if="isEditable" :span="8" class="h-full nc-form-left-drawer border-l border-gray-200">
          <Splitpanes horizontal class="w-full nc-form-right-splitpane">
            <Pane min-size="25" size="50" class="nc-form-right-splitpane-item p-2 md:p-4 flex flex-col space-y-4">
              <div class="flex flex-wrap justify-between items-center gap-2">
                <div class="flex gap-3">
                  <div class="text-base font-bold text-gray-900">
                    <!-- {{ $t('objects.fields') }} -->
                    Form Fields
                  </div>
                  <NcBadge color="border-gray-200" class="">
                    {{ visibleColumns.length }}/{{ localColumns.length }} Field
                  </NcBadge>
                </div>

                <a-dropdown
                  v-model:visible="showColumnDropdown"
                  :trigger="['click']"
                  overlay-class-name="nc-dropdown-form-add-column"
                >
                  <!-- v-if="localColumns.length" -->
                  <NcButton
                    type="secondary"
                    size="small"
                    class="nc-form-add-field"
                    data-testid="nc-form-add-field"
                    @click.stop="showColumnDropdown = true"
                  >
                    <div class="flex gap-2 items-center">
                      <component :is="iconMap.plus" class="w-4 h-4" />
                      <span> Add Field </span>
                    </div>
                  </NcButton>

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
              </div>
              <div>
                <a-input
                  v-model:value="searchQuery"
                  data-testid="nc-form-field-search-input"
                  class="!h-9 !px-3 !py-1 !rounded-lg"
                  :placeholder="$t('placeholder.searchFields') + '...'"
                >
                  <template #prefix>
                    <GeneralIcon icon="search" class="mr-2 h-4 w-4 text-gray-500 group-hover:text-black" />
                  </template>
                  <template #suffix>
                    <GeneralIcon
                      v-if="searchQuery.length > 0"
                      icon="close"
                      class="ml-2 h-4 w-4 text-gray-500 group-hover:text-black"
                      data-testid="nc-form-field-clear-search"
                      @click="searchQuery = ''"
                    />
                  </template>
                </a-input>
              </div>
              <div class="nc-form-fields-list border-1 border-gray-200 rounded-lg overflow-y-auto nc-form-scrollbar">
                <div v-if="!localColumns.length" class="px-0.5 py-2 text-gray-500 text-center">
                  {{ $t('title.noFieldsFound') }}
                </div>
                <Draggable
                  v-if="localColumns"
                  v-model="localColumns"
                  item-key="id"
                  @change="onMove($event)"
                  :style="{ height: 'calc(100% - 64px)' }"
                >
                  <template #item="{ element: field }">
                    <div
                      v-if="field.title.toLowerCase().includes(searchQuery.toLowerCase())"
                      :key="field.id"
                      class="p-2 flex flex-row items-center border-b-1 last:border-none first:rounded-t-lg border-gray-200"
                      :data-testid="`nc-form-field-item-${field.title}`"
                    >
                      <component :is="iconMap.drag" class="flex-none cursor-move !h-4 !w-4 text-gray-600 mr-1" />
                      <div
                        class="flex-1 flex items-center justify-between cursor-pointer"
                        @click="showOrHideColumn(field, !field.show)"
                      >
                        <div class="flex-1 flex items-center">
                          <SmartsheetHeaderVirtualCellIcon v-if="field && isVirtualCol(field)" :column-meta="field" />
                          <SmartsheetHeaderCellIcon v-else :column-meta="field" />

                          <NcTooltip class="truncate flex-1 ml-1" show-on-truncate-only>
                            <template #title> {{ field.title }} </template>
                            <span data-testid="nc-field-title">
                              {{ field.title }}
                            </span>
                            <span v-if="field.required" class="text-red-500">&nbsp;*</span>
                          </NcTooltip>
                        </div>

                        <NcSwitch :checked="field.show" :disabled="field.required" />
                      </div>
                    </div>
                  </template>
                  <template #header>
                    <div
                      key="nc-form-show-all-fields"
                      class="w-full p-2 flex items-center border-b-1 rounded-t-lg border-gray-200 bg-gray-50 sticky top-0 z-100"
                      data-testid="nc-form-show-all-fields"
                      @click.stop
                    >
                      <div class="w-4 h-4 flex-none mr-2"></div>
                      <div class="flex-1 flex flex-row items-center truncate cursor-pointer">
                        <div class="flex-1 font-base">Select all fields</div>
                        <NcSwitch
                          :checked="visibleColumns.length === localColumns.length"
                          @change="handleAddOrRemoveAllColumns"
                        />
                      </div>
                    </div>
                  </template>
                  <template
                    #footer
                    v-if="!localColumns?.filter((el) => el.title.toLowerCase().includes(searchQuery.toLowerCase())).length"
                  >
                    <div class="px-0.5 py-2 text-gray-500 text-center">
                      {{ $t('title.noFieldsFound') }} for title `{{ searchQuery }}`
                    </div>
                  </template>
                </Draggable>
              </div>
            </Pane>
            <Pane
              v-if="isEditable && !isLocked && formViewData"
              min-size="20"
              size="35"
              class="nc-form-right-splitpane-item p-2 md:p-4 flex flex-col space-y-4 !overflow-y-auto nc-form-scrollbar"
            >
              <!-- After form is submitted -->
              <div class="text-base font-bold text-gray-900">
                Post Form Submission Settings
                <!-- {{ $t('msg.info.afterFormSubmitted') }} -->
              </div>

              <!-- Show this message -->
              <div>
                <div class="text-gray-800 mb-2">
                  Display Message
                  <!-- {{ $t('msg.info.showMessage') }} -->
                </div>
                <a-textarea
                  v-model:value="formViewData.success_msg as string"
                  :rows="3"
                  hide-details
                  class="nc-form-after-submit-msg !rounded-lg !px-3 !py-1"
                  data-testid="nc-form-after-submit-msg"
                  @change="updateView"
                />
              </div>

              <!-- Other options -->
              <div class="flex flex-col gap-3">
                <div class="flex items-center">
                  <!-- Show "Submit Another Form" button -->
                  <a-switch
                    v-model:checked="formViewData.submit_another_form as boolean"
                    v-e="[`a:form-view:submit-another-form`]"
                    size="small"
                    class="nc-form-checkbox-submit-another-form"
                    data-testid="nc-form-checkbox-submit-another-form"
                    @change="updateView"
                  />
                  <span class="ml-4">{{ $t('msg.info.submitAnotherForm') }}</span>
                </div>

                <div class="flex items-center">
                  <!-- Show a blank form after 5 seconds -->
                  <a-switch
                    v-model:checked="formViewData.show_blank_form  as boolean"
                    v-e="[`a:form-view:show-blank-form`]"
                    size="small"
                    class="nc-form-checkbox-show-blank-form"
                    data-testid="nc-form-checkbox-show-blank-form"
                    @change="updateView"
                  />

                  <span class="ml-4">{{ $t('msg.info.showBlankForm') }}</span>
                </div>

                <div class="mb-12 flex items-center">
                  <a-switch
                    v-model:checked="emailMe"
                    v-e="[`a:form-view:email-me`]"
                    size="small"
                    class="nc-form-checkbox-send-email"
                    data-testid="nc-form-checkbox-send-email"
                    @change="onEmailChange"
                  />

                  <!-- Email me at <email> -->
                  <span class="ml-4">
                    {{ $t('msg.info.emailForm') }}
                    <span class="text-bold text-gray-600">{{ user?.email }}</span>
                  </span>
                </div>
              </div>
            </Pane>
          </Splitpanes>
        </a-col>
      </a-row>
    </template>
  </div>
</template>

<style scoped lang="scss">
.nc-editable:hover {
  :deep(.nc-field-remove-icon) {
    @apply opacity-100;
  }
}

.nc-input {
  @apply appearance-none w-full !bg-white rounded px-2 py-2 my-2 border-solid border-1 border-primary border-opacity-50;

  &.nc-cell-rating,
  &.nc-cell-geodata {
    @apply !py-1;
  }

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

.nc-form-input-item .nc-data-cell {
  @apply !border-none rounded-none;

  &:focus-within {
    @apply !border-none;
  }
}

:deep(.nc-form-right-splitpane .splitpanes__splitter) {
  @apply !border-b-1 !border-gray-200;

  ::after {
    content: 'e945';
  }
}
.nc-form-fields-list {
}
.nc-form-scrollbar {
  @apply scrollbar scrollbar-thin scrollbar-thumb-rounded-md scrollbar-thumb-gray-200 scrollbar-track-transparent;
  &::-webkit-scrollbar-thumb:hover {
    @apply !scrollbar-thumb-gray-300;
  }
}
</style>
