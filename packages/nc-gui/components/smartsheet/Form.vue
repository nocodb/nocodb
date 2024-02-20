<script setup lang="ts">
import type { VNodeRef } from '@vue/runtime-core'
import Draggable from 'vuedraggable'
import tinycolor from 'tinycolor2'
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
  isEeUI,
  message,
  onClickOutside,
  parseProp,
  provide,
  reactive,
  ref,
  useDebounceFn,
  useEventListener,
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

let formState = reactive({})

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

const drag = ref(false)

const emailMe = ref(false)

const submitted = ref(false)

const activeRow = ref('')

const isTabPressed = ref(false)

const isLoadingFormView = ref(false)

const focusLabel: VNodeRef = (el) => {
  return (el as HTMLInputElement)?.focus()
}

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

async function clearForm() {
  formState = {}
  state.value = {}
  reloadEventHook.trigger()
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

// Todo: reorder visible form fields
function onMove(event: any, isVisibleFormFields = false) {
  const { oldIndex } = event.moved
  let { newIndex, element } = event.moved

  const fieldIndex = fields.value?.findIndex((f) => f?.fk_column_id === element.fk_column_id)

  if (fieldIndex === -1 || fieldIndex === undefined) return

  if (isVisibleFormFields) {
    element = localColumns.value[localColumns.value?.findIndex((c) => c.fk_column_id === element.fk_column_id)]
    newIndex = localColumns.value.findIndex(
      (c) =>
        c.fk_column_id ===
        visibleColumns.value[newIndex > oldIndex ? newIndex - 1 : newIndex < oldIndex ? newIndex + 1 : newIndex].fk_column_id,
    )
  }

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

function showOrHideColumn(column: Record<string, any>, show: boolean, isSidePannel = false) {
  if (shouldSkipColumn(column)) {
    // Required field can't be moved
    !isSidePannel && message.info(t('msg.info.requriedFieldsCantBeMoved'))
    return
  }

  const fieldIndex = fields.value?.findIndex((f) => f?.fk_column_id === column.fk_column_id)

  if (fieldIndex !== -1 && fieldIndex !== undefined) {
    saveOrUpdate(
      {
        ...column,
        show,
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
    meta: {
      hide_branding: false,
      background_color: '#F9F9FA',
      ...(parseProp(formViewData.value?.meta) ?? {}),
    },
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

const columnSupportsScanning = (elementType: UITypes) =>
  betaFeatureToggleState.show &&
  [UITypes.SingleLineText, UITypes.Number, UITypes.Email, UITypes.URL, UITypes.LongText].includes(elementType)

onClickOutside(draggableRef, () => {
  activeRow.value = ''
  isTabPressed.value = false
})

onMounted(async () => {
  isLoadingFormView.value = true
  await loadFormView()
  setFormData()
  isLoadingFormView.value = false
})

watch(view, (nextView) => {
  if (nextView?.type === ViewTypes.FORM) {
    reloadEventHook.trigger()
  }
})

watch(activeRow, (newValue) => {
  if (newValue) {
    document.querySelector(`.nc-form-field-item-${newValue}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
})

const onFormItemClick = (element: any) => {
  if (isLocked.value || !isEditable) return
  activeRow.value = element.title
  isTabPressed.value = false
}

const handleChangeBackground = (color: string) => {
  const tcolor = tinycolor(color)
  if (tcolor.isValid()) {
    ;(formViewData.value?.meta as Record<string, any>).background_color = color
    updateView()
  }
}
useEventListener(
  formRef,
  'focusout',
  (e: FocusEvent) => {
    const nextActiveFieldTitle =
      (e?.relatedTarget as HTMLElement)?.getAttribute('data-title') ||
      (e?.relatedTarget as HTMLElement)?.offsetParent?.closest('.nc-form-focus-element')?.getAttribute('data-title')

    if (activeRow.value && nextActiveFieldTitle && activeRow.value !== nextActiveFieldTitle) {
      if (isTabPressed.value) {
        activeRow.value = nextActiveFieldTitle
      }
    }
    isTabPressed.value = false
  },
  true,
)

useEventListener(
  formRef,
  'keydown',
  (e: KeyboardEvent) => {
    if (e.key === 'Tab') {
      isTabPressed.value = true
    } else {
      isTabPressed.value = false
    }
  },
  true,
)
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
      <div
        v-if="submitted"
        class="h-full p-6"
        :style="{background:(formViewData?.meta as Record<string,any>).background_color || '#F9F9FA'}"
        data-testid="nc-form-wrapper-submit"
      >
        <GeneralFormBanner :banner-image-url="formViewData?.banner_image_url" />

        <div
          class="transition-all duration-300 ease-in relative max-w-[max(33%,688px)] mx-auto my-6 bg-white rounded-3xl border-1 border-gray-200 px-4 py-8 lg:p-12 md:(p-8 dark:bg-slate-700)"
        >
          <div v-if="formViewData" class="items-center justify-center text-center mt-2">
            <div class="text-left">
              <h1 class="prose-2xl font-bold mb-4" style="word-break: break-all">
                {{ formViewData.heading }}
              </h1>

              <h2
                v-if="formViewData.subheading"
                class="prose-lg text-slate-500 dark:text-slate-300 mb-4 leading-6"
                style="word-break: break-all"
              >
                {{ formViewData.subheading }}
              </h2>
            </div>

            <div class="flex justify-center">
              <div class="w-full lg:w-[95%]">
                <a-alert type="success" class="!my-4 text-center !rounded-lg">
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
                  <a-button type="primary" size="large" @click="submitted = false">
                    {{ $t('activity.submitAnotherForm') }}</a-button
                  >
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="h-full w-full flex" data-testid="nc-form-wrapper">
        <div v-if="isLoadingFormView" class="flex-1"></div>
        <div
          v-else-if="formViewData"
          class="flex-1 h-full overflow-auto nc-form-scrollbar p-6"
          :style="{background:(formViewData?.meta as Record<string,any>).background_color || '#F9F9FA'}"
        >
          <div :class="isEditable ? 'min-w-[616px] overflow-x-auto nc-form-scrollbar' : ''">
            <!-- for future implementation of cover image -->
            <!-- Todo: cover image uploader and image cropper to crop image in fixed aspect ratio  -->
            <GeneralFormBanner :banner-image-url="formViewData.banner_image_url" />

            <a-card
              class="!py-8 !lg:py-12 !border-gray-200 !rounded-3xl !mt-6 max-w-[688px] !mx-auto"
              :body-style="{
                margin: '0 auto',
                padding: '0px !important',
              }"
            >
              <a-form ref="formRef" :model="formState" class="nc-form" no-style>
                <!-- form header -->
                <div class="flex flex-col gap-4 px-8 lg:px-12 mb-6">
                  <!-- Form logo  -->
                  <!-- <div v-if="isEditable">
                    <div class="inline-block rounded-xl bg-gray-100 p-3">
                      <NcButton type="secondary" size="small" class="nc-form-upload-logo" data-testid="nc-form-upload-log">
                        <div class="flex gap-2 items-center">
                          <component :is="iconMap.upload" class="w-4 h-4" />
                          <span> Upload Logo </span>
                        </div>
                      </NcButton>
                    </div>
                  </div> -->
                  <!-- form title -->

                  <a-form-item v-if="isEditable">
                    <a-textarea
                      v-model:value="formViewData.heading"
                      class="nc-form-focus-element w-full !font-bold !text-4xl !border-0 !border-b-1 !border-dashed !rounded-none !border-gray-400"
                      :style="{
                        'borderRightWidth': '0px !important',
                        'height': '70px',
                        'max-height': '250px',
                        'resize': 'vertical',
                      }"
                      auto-size
                      size="large"
                      hide-details
                      :disabled="isLocked"
                      placeholder="Form Title"
                      :bordered="false"
                      data-testid="nc-form-heading"
                      data-title="nc-form-heading"
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
                      v-model:value="formViewData.subheading"
                      class="nc-form-focus-element w-full !border-0 !border-b-1 !border-dashed !rounded-none !border-gray-400"
                      :style="{
                        'borderRightWidth': '0px !important',
                        'height': '40px',
                        'min-height': '40px',
                        'resize': 'vertical',
                      }"
                      size="large"
                      auto-size
                      hide-details
                      :placeholder="$t('msg.info.formDesc')"
                      :bordered="false"
                      :disabled="!isEditable || isLocked"
                      data-testid="nc-form-sub-heading"
                      data-title="nc-form-sub-heading"
                      @blur="updateView"
                      @click="updateView"
                    />
                  </a-form-item>

                  <div v-else class="w-full text-bold text-base">
                    {{ formViewData.subheading || '---' }}
                  </div>
                </div>

                <Draggable
                  ref="draggableRef"
                  :list="visibleColumns"
                  item-key="fk_column_id"
                  draggable=".item"
                  handle=".nc-form-field-drag-handler"
                  group="form-inputs"
                  ghost-class="nc-form-field-ghost"
                  class="h-full px-4 lg:px-6"
                  :move="onMoveCallback"
                  :disabled="isLocked || !isEditable"
                  @change="onMove($event, true)"
                  @start="drag = true"
                  @end="drag = false"
                >
                  <template #item="{ element }">
                    <div
                      class="nc-editable nc-form-focus-element item relative bg-white"
                      :class="[
                        `nc-form-drag-${element.title.replaceAll(' ', '')}`,
                        {
                          'rounded-2xl overflow-hidden border-2 cursor-pointer my-1': isEditable,
                        },
                        {
                          'p-4 lg:p-6 border-transparent my-0': !isEditable,
                        },
                        {
                          'nc-form-field-drag-handler border-transparent hover:(bg-gray-50) p-4 lg:p-6 ':
                            activeRow !== element.title && isEditable,
                        },

                        {
                          'border-brand-500': activeRow === element.title,
                        },
                        {
                          '!hover:bg-white !ring-0 !cursor-auto': isLocked,
                        },
                      ]"
                      :style="{
                        transition: 'height 1s ease-in',
                      }"
                      :data-title="element.title"
                      data-testid="nc-form-fields"
                      @click.stop="onFormItemClick(element)"
                    >
                      <div v-if="activeRow !== element.title">
                        <div>
                          <span data-testid="nc-form-input-label">
                            {{ element.label || element.title }}
                          </span>
                          <span v-if="element.required" class="text-red-500">&nbsp;*</span>
                        </div>

                        <div class="nc-form-help-text text-gray-500 text-sm mt-2" data-testid="nc-form-help-text">
                          {{ element.description }}
                        </div>
                      </div>

                      <!-- Field Header  -->
                      <div v-if="activeRow === element.title" class="w-full flex gap-3 items-center px-3 py-2 bg-gray-50">
                        <component
                          :is="iconMap.drag"
                          class="nc-form-field-drag-handler flex-none cursor-move !h-4 !w-4 text-gray-600"
                        />
                        <div class="flex-1 flex items-center max-w-[calc(100%_-_152px)]">
                          <SmartsheetHeaderVirtualCellIcon v-if="element && isVirtualCol(element)" :column-meta="element" />
                          <SmartsheetHeaderCellIcon v-else :column-meta="element" />

                          <NcTooltip class="truncate" show-on-truncate-only>
                            <template #title> {{ element.label || element.title }} </template>
                            <span data-testid="nc-form-input-label">
                              {{ element.label || element.title }}
                            </span>
                          </NcTooltip>
                          <span v-if="element.required" class="text-red-500">&nbsp;*</span>
                        </div>
                        <a-form-item class="my-0 !mb-2">
                          <div class="flex gap-2 items-center">
                            <span
                              class="text-gray-500 mr-2"
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
                              class="nc-form-input-required"
                              data-testid="nc-form-input-required"
                              size="small"
                              @change="updateColMeta(element)"
                            />
                          </div>
                        </a-form-item>
                      </div>

                      <!-- Field Body  -->

                      <div class="nc-form-field-body" :class="activeRow === element.title ? 'p-4 lg:p-6' : ''">
                        <template v-if="activeRow === element.title">
                          <a-form-item class="my-0 !mb-2">
                            <a-textarea
                              :ref="focusLabel"
                              v-model:value="element.label"
                              :rows="1"
                              auto-size
                              hide-details
                              class="form-meta-input nc-form-input-label"
                              data-testid="nc-form-input-label"
                              :placeholder="$t('msg.info.formInput')"
                              @keydown.enter.prevent
                              @change="updateColMeta(element)"
                            />
                          </a-form-item>

                          <a-form-item class="!my-0 !mb-3">
                            <a-textarea
                              v-model:value="element.description"
                              :rows="1"
                              auto-size
                              hide-details
                              class="form-meta-input text-sm nc-form-input-help-text"
                              data-testid="nc-form-input-help-text"
                              :placeholder="$t('msg.info.formHelpText')"
                              @keydown.enter.prevent
                              @change="updateColMeta(element)"
                            />
                          </a-form-item>
                          <a-form-item
                            v-if="columnSupportsScanning(element.uidt)"
                            class="!my-0 !mb-3 nc-form-input-enable-scanner-form-item"
                          >
                            <div class="flex space-x-4 items-center">
                              <a-switch
                                v-model:checked="element.enable_scanner"
                                v-e="['a:form-view:field:mark-enable-scanner']"
                                size="small"
                                @change="updateColMeta(element)"
                              />
                              <span
                                class="text-gray-500 nc-form-input-enable-scanner"
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
                            </div>
                          </a-form-item>
                        </template>
                        <div :class="activeRow !== element.title ? 'mt-2' : ''">
                          <a-form-item
                            :name="element.title"
                            class="!my-0 nc-input-required-error nc-form-input-item"
                            :rules="[
                              {
                                required: isRequired(element, element.required),
                                message: `${element.label || element.title} is required`,
                              },
                            ]"
                          >
                            <LazySmartsheetDivDataCell
                              class="relative"
                              @click.stop="
                                () => {
                                  isTabPressed = false
                                  if (activeRow !== element.title) {
                                    activeRow = ''
                                  }
                                }
                              "
                            >
                              <LazySmartsheetVirtualCell
                                v-if="isVirtualCol(element)"
                                v-model="formState[element.title]"
                                :row="row"
                                class="nc-input"
                                :class="`nc-form-input-${element.title.replaceAll(' ', '')}`"
                                :data-testid="`nc-form-input-${element.title.replaceAll(' ', '')}`"
                                :column="element"
                              />
                              <LazySmartsheetCell
                                v-else
                                v-model="formState[element.title]"
                                class="nc-input truncate"
                                :class="`nc-form-input-${element.title.replaceAll(' ', '')}`"
                                :data-testid="`nc-form-input-${element.title.replaceAll(' ', '')}`"
                                :column="element"
                                :edit-enabled="true"
                              />
                            </LazySmartsheetDivDataCell>
                          </a-form-item>
                        </div>
                      </div>

                      <!-- Field Settings  -->
                      <!-- eslint-disable vue/no-constant-condition -->
                      <div
                        v-if="activeRow === element.title && false"
                        class="nc-form-field-settings border-t border-gray-200 p-4 lg:p-6"
                      >
                        <!-- Todo: Show on conditions, options limit,... -->
                        <div class="flex items-start gap-3 px-3 py-2 border-1 border-gray-200 rounded-lg">
                          <a-switch v-e="['a:form-view:field:show-on-condition']" size="small" />
                          <div>
                            <div class="font-medium text-gray-800">Show on condtions</div>
                            <div class="text-gray-500">Shows field only when conditions are met</div>
                          </div>
                        </div>
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

                <div class="flex justify-between items-center mt-6 !px-8 !lg:px-12">
                  <NcButton
                    html-type="reset"
                    type="secondary"
                    size="small"
                    :disabled="!isUIAllowed('dataInsert')"
                    class="nc-form-clear nc-form-focus-element"
                    data-testid="nc-form-clear"
                    data-title="nc-form-clear"
                    @click="clearForm"
                  >
                    Crear Form
                  </NcButton>
                  <NcButton
                    html-type="submit"
                    type="primary"
                    size="small"
                    :disabled="!isUIAllowed('dataInsert')"
                    class="nc-form-submit nc-form-focus-element"
                    data-testid="nc-form-submit"
                    data-title="nc-form-submit"
                    @click="submitForm"
                  >
                    {{ $t('general.submit') }}
                  </NcButton>
                </div>
              </a-form>

              <div v-if="!parseProp(formViewData?.meta).hide_branding" class="px-8 lg:px-12">
                <a-divider v-if="!isLocked" class="!my-8" />
                <!-- Nocodb Branding  -->
                <div class="inline-block">
                  <GeneralFormBranding />
                </div>
              </div>
            </a-card>
          </div>
        </div>
        <div v-if="isEditable" class="h-full flex-1 max-w-[384px] nc-form-left-drawer border-l border-gray-200">
          <Splitpanes horizontal class="w-full nc-form-right-splitpane">
            <Pane min-size="30" size="50" class="nc-form-right-splitpane-item p-4 flex flex-col space-y-4 !min-h-200px">
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
                  :placeholder="`${$t('placeholder.searchFields')}...`"
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
                <template v-if="localColumns.length">
                  <div
                    key="nc-form-show-all-fields"
                    class="w-full p-2 flex items-center border-b-1 rounded-t-lg border-gray-200 bg-gray-50 sticky top-0 z-100"
                    data-testid="nc-form-show-all-fields"
                    @click.stop
                  >
                    <div class="w-4 h-4 flex-none mr-2"></div>
                    <div class="flex-1 flex flex-row items-center truncate cursor-pointer">
                      <div class="flex-1 font-base">Select all fields</div>
                      <NcSwitch :checked="visibleColumns.length === localColumns.length" @change="handleAddOrRemoveAllColumns" />
                    </div>
                  </div>
                  <Draggable
                    :list="localColumns"
                    item-key="id"
                    ghost-class="nc-form-field-ghost"
                    :style="{ height: 'calc(100% - 64px)' }"
                    @change="onMove($event)"
                  >
                    <template #item="{ element: field }">
                      <div
                        v-if="field.title.toLowerCase().includes(searchQuery.toLowerCase())"
                        :key="field.id"
                        class="w-full p-2 flex flex-row items-center border-b-1 last:border-none border-gray-200"
                        :class="[
                          `nc-form-field-item-${field.title}`,
                          `${activeRow === field.title ? 'bg-brand-50 font-medium' : 'hover:bg-gray-50'}`,
                        ]"
                        :data-testid="`nc-form-field-item-${field.title}`"
                      >
                        <component :is="iconMap.drag" class="flex-none cursor-move !h-4 !w-4 text-gray-600 mr-1" />
                        <div
                          class="flex-1 flex items-center justify-between space-x-2 cursor-pointer max-w-[calc(100%_-_20px)]"
                          @click="showOrHideColumn(field, !field.show, true)"
                        >
                          <div class="flex-1 flex items-center max-w-[calc(100%_-_40px)]">
                            <SmartsheetHeaderVirtualCellIcon v-if="field && isVirtualCol(field)" :column-meta="field" />
                            <SmartsheetHeaderCellIcon v-else :column-meta="field" />

                            <NcTooltip class="truncate ml-1" show-on-truncate-only>
                              <template #title> {{ field.label || field.title }} </template>
                              <span data-testid="nc-field-title">
                                {{ field.label || field.title }}
                              </span>
                            </NcTooltip>
                            <span v-if="field.required" class="text-red-500">&nbsp;*</span>
                          </div>
                          <NcSwitch :checked="!!field.show" :disabled="field.required" />
                        </div>
                      </div>
                    </template>
                    <template
                      v-if="!localColumns?.filter((el) => el.title.toLowerCase().includes(searchQuery.toLowerCase())).length"
                      #footer
                    >
                      <div class="px-0.5 py-2 text-gray-500 text-center">
                        {{ $t('title.noFieldsFound') }} with title `{{ searchQuery }}`
                      </div>
                    </template>
                  </Draggable>
                </template>
              </div>
            </Pane>
            <Pane
              v-if="isEditable && !isLocked && formViewData"
              min-size="20"
              size="50"
              class="nc-form-right-splitpane-item !overflow-y-auto nc-form-scrollbar"
            >
              <div class="p-4 flex flex-col space-y-4 border-b border-gray-200">
                <!-- Appearance Settings -->
                <div class="text-base font-bold text-gray-900">Appearance Settings</div>

                <div>
                  <div class="text-gray-800">Background Color</div>
                  <div class="flex justify-start">
                    <LazyGeneralColorPicker
                      :model-value="(formViewData.meta as Record<string,any>).background_color"
                      :colors="[
                        '#FFFFFF',
                        '#FFDBD9',
                        '#FEE6D6',
                        '#FFF0D1',
                        '#D4F7E0',
                        '#D7F2FF',
                        '#FED8F4',
                        '#E5D4F5',
                        '#FFCFE6',
                      ]"
                      :borders="[
                        '#6A7184',
                        '#FF4A3F',
                        '#FA8231',
                        '#FCBE3A',
                        '#27D665',
                        '#36BFFF',
                        '#FC3AC6',
                        '#7D26CD',
                        '#B33771',
                      ]"
                      :is-new-design="true"
                      class="nc-form-theme-color-picker !p-0 !-ml-1"
                      @input="handleChangeBackground"
                    />
                  </div>
                </div>

                <div class="flex items-center">
                  <!-- Hide NocoDB Branding -->
                  <a-switch
                    v-if="isEeUI"
                    v-e="[`a:form-view:submit-another-form`]"
                    :checked="parseProp(formViewData.meta)?.hide_branding"
                    size="small"
                    class="nc-form-hide-branding"
                    data-testid="nc-form-hide-branding"
                    @change="
                      (value) => {
                        (formViewData!.meta as Record<string,any>).hide_branding = value
                        updateView()
                      }
                    "
                  />
                  <a-switch v-else :checked="false" size="small" :disabled="true" />
                  <span class="ml-4">Hide NocoDB Branding</span>
                </div>
              </div>

              <div class="p-4 flex flex-col space-y-4">
                <!-- Post Form Submission Settings -->
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
                    v-model:value="formViewData.success_msg"
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
                      v-model:checked="formViewData.submit_another_form"
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
                      v-model:checked="formViewData.show_blank_form"
                      v-e="[`a:form-view:show-blank-form`]"
                      size="small"
                      class="nc-form-checkbox-show-blank-form"
                      data-testid="nc-form-checkbox-show-blank-form"
                      @change="updateView"
                    />

                    <span class="ml-4">{{ $t('msg.info.showBlankForm') }}</span>
                  </div>

                  <div class="flex items-center">
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
              </div>
            </Pane>
          </Splitpanes>
        </div>
      </div>
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
  @apply appearance-none w-full !bg-white rounded-lg px-2 py-2 border-solid border-1 border-gray-200 focus-within:border-brand-500;
  &.nc-cell-rating,
  &.nc-cell-geodata {
    @apply !py-1;
  }

  :deep(input) {
    @apply !px-1;
  }
}

.form-meta-input {
  @apply !rounded-lg !text-sm;
  &::placeholder {
    @apply !text-gray-500;
  }
}

.nc-form-input-label {
  @apply !px-4 !py-2;
}
.nc-form-input-help-text {
  @apply !px-4 !py-1;
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

.nc-form-input-enable-scanner-form-item {
  :deep(.ant-form-item-control-input) {
    @apply min-h-max;
  }
}
:deep(.nc-form-right-splitpane .splitpanes__splitter) {
  @apply !border-t-1 !border-gray-200 relative;

  &::before {
    @apply content-[':::'] block h-4 leading-12px px-2 font-bold text-gray-800 border-1 border-gray-200 rounded bg-white absolute -top-2.5 z-100 left-[calc(50%_-_16px)];
  }
}

.nc-form-scrollbar {
  @apply scrollbar scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent;
  &::-webkit-scrollbar-thumb:hover {
    @apply !scrollbar-thumb-gray-300;
  }
}
:deep(.nc-form-theme-color-picker .color-selector) {
  @apply !text-white;
}

:deep(.nc-form-field-body .nc-cell) {
  @apply my-0;
}
.nc-form-field-ghost {
  @apply bg-gray-50;
}
:deep(.nc-form-input-required):focus {
  box-shadow: 0 0 0 2px #fff, 0 0 0 4px #3366ff;
}
</style>
