<script setup lang="ts">
import Draggable from 'vuedraggable'
import tinycolor from 'tinycolor2'
import { Pane, Splitpanes } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'

import {
  type AttachmentResType,
  type ColumnType,
  type LinkToAnotherRecordType,
  ProjectRoles,
  RelationTypes,
  UITypes,
  ViewTypes,
  getSystemColumns,
  isLinksOrLTAR,
  isVirtualCol,
} from 'nocodb-sdk'
import type { ValidateInfo } from 'ant-design-vue/es/form/useForm'
import type { ImageCropperConfig } from '#imports'

provide(IsFormInj, ref(true))
provide(IsGalleryInj, ref(false))

// todo: generate hideCols based on default values
const hiddenCols = ['created_at', 'updated_at']

const hiddenBubbleMenuOptions = [
  RichTextBubbleMenuOptions.code,
  RichTextBubbleMenuOptions.blockQuote,
  RichTextBubbleMenuOptions.bulletList,
  RichTextBubbleMenuOptions.numberedList,
  RichTextBubbleMenuOptions.taskList,
]

const enum NcForm {
  heading = 'nc-form-heading',
  subheading = 'nc-form-sub-heading',
}

const { isMobileMode, user } = useGlobal()

const { $api, $e } = useNuxtApp()

const { isUIAllowed } = useRoles()

const { metas, getMeta } = useMetas()

const { base } = storeToRefs(useBase())

const { getPossibleAttachmentSrc } = useAttachment()

const secondsRemain = ref(0)

const isLocked = inject(IsLockedInj, ref(false))

const isEditable = isUIAllowed('viewFieldEdit' as Permission)

const meta = inject(MetaInj, ref())

const view = inject(ActiveViewInj, ref())

const isPublic = inject(IsPublicInj, ref(false))

const { loadFormView, insertRow, formColumnData, formViewData, updateFormView } = useViewData(meta, view)

const {
  formState,
  localColumns,
  visibleColumns,
  activeRow,
  activeField,
  activeColumn,
  isRequired,
  updateView,
  updateColMeta,
  validateInfos,
  validate,
  clearValidate,
  fieldMappings,
  isValidRedirectUrl,
  loadAllviewFilters,
  allViewFilters,
  checkFieldVisibility,
} = useProvideFormViewStore(meta, view, formViewData, updateFormView, isEditable)

const { preFillFormSearchParams } = storeToRefs(useViewsStore())

const reloadEventHook = inject(ReloadViewDataHookInj, createEventHook())

reloadEventHook.on(async (params) => {
  if (params?.isFormFieldFilters) {
    setTimeout(() => {
      checkFieldVisibility()
    }, 100)
  } else {
    await Promise.all([loadFormView(), loadReleatedMetas()])
    setFormData()
  }
})

const { fields, showAll, hideAll } = useViewColumnsOrThrow()

const { state, row } = useProvideSmartsheetRowStore(
  ref({
    row: formState.value,
    oldRow: {},
    rowMeta: { new: true },
  }),
)

const columns = computed(() => meta?.value?.columns || [])

const draggableRef = ref()

const systemFieldsIds = ref<Record<string, any>[]>([])

const dropdownStates = ref({
  showColumnMenu: false,
  showEditColumn: false,
  showAddColumn: false,
})
const drag = ref(false)

const emailMe = ref(false)

const submitted = ref(false)

const isLoadingFormView = ref(false)

const showCropper = ref(false)

const imageCropperData = ref<{
  imageConfig: {
    src: string
    type: string
    name: string
  }
  cropperConfig: ImageCropperConfig
  uploadConfig?: {
    path?: string
  }
  cropFor: 'banner' | 'logo'
}>({
  imageConfig: {
    src: '',
    type: '',
    name: '',
  },
  cropperConfig: {
    stencilProps: {},
    minHeight: 0,
    minWidth: 0,
    imageRestriction: 'none',
  },
  uploadConfig: {
    path: '',
  },
  cropFor: 'banner',
})

const focusLabel = ref<HTMLTextAreaElement>()

const searchQuery = ref('')

const autoScrollFormField = ref(false)

const { t } = useI18n()

const { open, onChange: onChangeFile } = useFileDialog({
  accept: 'image/*',
  multiple: false,
  reset: true,
})

const editOrAddProviderRef = ref()

const onVisibilityChange = (state: 'showAddColumn' | 'showEditColumn') => {
  dropdownStates.value[state] = true

  if (editOrAddProviderRef.value && !editOrAddProviderRef.value?.shouldKeepModalOpen()) {
    dropdownStates.value[state] = false
  }
}

const getFormLogoSrc = computed(() => getPossibleAttachmentSrc(parseProp(formViewData.value?.logo_url)))

const isOpenRedirectUrlOption = ref(false)

const redirectLinkValidation = ref<ValidateInfo>({
  validateStatus: '',
  help: undefined,
})

const isOpenRedirectUrl = computed({
  get: () => {
    return typeof formViewData.value?.redirect_url === 'string'
  },
  set: (value: boolean) => {
    isOpenRedirectUrlOption.value = value
    if (value) {
      formViewData.value = {
        ...formViewData.value,
        redirect_url: '',
      }
    } else {
      formViewData.value = {
        ...formViewData.value,
        redirect_url: null,
      }

      redirectLinkValidation.value = {
        validateStatus: '',
        help: undefined,
      }
    }
    updateView()
  },
})

const handleUpdateRedirectUrl = () => {
  const validStatus = isValidRedirectUrl()

  redirectLinkValidation.value = {
    ...validStatus,
  }

  if (validStatus.validateStatus === 'error') {
    return
  }

  updateView()
}

const getPrefillValue = (c: ColumnType, value: any) => {
  let preFillValue: any

  switch (c.uidt) {
    case UITypes.LinkToAnotherRecord:
    case UITypes.Links: {
      const values = Array.isArray(value) ? value : [value]
      const fk_related_model_id = (c?.colOptions as LinkToAnotherRecordType)?.fk_related_model_id

      if (!fk_related_model_id) return

      const rowIds = values
        .map((row) => {
          return extractPkFromRow(row, metas.value[fk_related_model_id].columns || [])
        })
        .filter((rowId) => !!rowId)
        .join(',')

      preFillValue = rowIds || undefined
      // if bt/oo then extract object from array
      if (c.colOptions?.type === RelationTypes.BELONGS_TO || c.colOptions?.type === RelationTypes.ONE_TO_ONE) {
        preFillValue = rowIds[0]
      }

      break
    }

    default: {
      return value
    }
  }

  return preFillValue
}

const updatePreFillFormSearchParams = useDebounceFn(() => {
  if (isLocked.value || !isUIAllowed('dataInsert')) return

  const preFilledData = { ...formState.value, ...state.value }

  const searchParams = new URLSearchParams()

  for (const c of visibleColumns.value) {
    if (
      !c.title ||
      !isValidValue(preFilledData[c.title]) ||
      (isVirtualCol(c) && !isLinksOrLTAR(c)) ||
      isAttachment(c) ||
      c.uidt === UITypes.SpecificDBType
    ) {
      continue
    }

    const preFillValue = getPrefillValue(c, preFilledData[c.title])

    if (preFillValue !== undefined) {
      searchParams.append(c.title, preFillValue)
    }
  }

  preFillFormSearchParams.value = searchParams.toString()
}, 250)

async function submitForm() {
  if (!isUIAllowed('dataInsert')) return

  for (const col of localColumns.value) {
    if (col.show && col.title && isRequired(col, col.required) && formState.value[col.title] === undefined) {
      formState.value[col.title] = null
    }

    // handle filter out conditionally hidden field data
    if ((!col.visible || !col.show) && col.title) {
      delete formState.value[col.title]
      delete state.value[col.title]
    }
  }

  try {
    await validate(
      Object.keys(formState.value)
        .map((title) => fieldMappings.value[title])
        .filter((v) => v !== undefined),
    )
  } catch (e: any) {
    console.error(e)

    if (e?.errorFields?.length) {
      message.error(t('msg.error.someOfTheRequiredFieldsAreEmpty'))
      return
    }
  }

  const res = await insertRow({
    row: { ...formState.value, ...state.value },
    oldRow: {},
    rowMeta: { new: true },
  })

  if (res) {
    submitted.value = true
  }
}

async function clearForm() {
  if (!isUIAllowed('dataInsert')) return

  formState.value = {}
  state.value = {}
  clearValidate()
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
      !isValidValue(column?.cdf) &&
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

async function onMove(event: any, isVisibleFormFields = false) {
  if (isLocked.value || !isEditable) return

  let { newIndex, element } = event.moved

  const fieldIndex = fields.value?.findIndex((f) => f?.fk_column_id === element.fk_column_id)

  if (fieldIndex === -1 || fieldIndex === undefined || !fields.value?.[fieldIndex]) return

  if (isVisibleFormFields) {
    element = localColumns.value[localColumns.value?.findIndex((c) => c.fk_column_id === element.fk_column_id)]
    newIndex = localColumns.value.findIndex((c) => c.fk_column_id === visibleColumns.value[newIndex].fk_column_id)
  }
  if (!localColumns.value.length || localColumns.value.length === 1) {
    element.order = 1
  } else if (localColumns.value.length - 1 === newIndex) {
    element.order = Math.max(...localColumns.value.map((e) => e?.order ?? 0)) + 1
  } else if (newIndex === 0) {
    element.order = Math.min(...localColumns.value.map((e) => e?.order ?? 0)) / 2
  } else {
    element.order = ((localColumns.value[newIndex - 1]?.order ?? 0) + (localColumns.value[newIndex + 1].order ?? 0)) / 2
  }

  await $api.dbView.formColumnUpdate(element.id, element)

  fields.value[fieldIndex] = element as any

  localColumns.value = [...localColumns.value].sort((a, b) => {
    if (a.order !== undefined && b.order !== undefined) {
      return a.order - b.order
    }
    return 0
  })

  checkFieldVisibility()

  $e('a:form-view:reorder')
}

async function showOrHideColumn(column: Record<string, any>, show: boolean, isFormSettings = false) {
  if (isLocked.value || !isEditable) return

  if (shouldSkipColumn(column)) {
    // Required field can't be moved
    !isFormSettings && message.info(t('msg.info.requriedFieldsCantBeMoved'))
    return
  }
  const fieldIndex = fields.value?.findIndex((f) => f?.fk_column_id === column.fk_column_id)

  if (fieldIndex !== -1 && fieldIndex !== undefined && fields.value?.[fieldIndex]) {
    column.show = show
    await $api.dbView.formColumnUpdate(column.id, column)

    fields.value[fieldIndex] = column as any

    reloadEventHook.trigger()

    if (show) {
      $e('a:form-view:show-columns')
    } else {
      $e('a:form-view:hide-columns')
    }
  }
  if (!show && !isFormSettings && activeRow.value) {
    activeRow.value = ''
  }
}

function shouldSkipColumn(col: Record<string, any>) {
  return (
    isDbRequired(col) || !!col.required || (!!col.rqd && !col.cdf) || col.uidt === UITypes.QrCode || col.uidt === UITypes.Barcode
  )
}

async function handleAddOrRemoveAllColumns<T>(value: T) {
  if (isLocked.value || !isEditable) return

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
  if (emailMe.value && !isEeUI) {
    const emailPluginActive = await $api.plugin.status('smtp')
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
    banner_image_url: null,
    logo_url: null,
    ...formViewData.value,
    submit_another_form: !!(formViewData.value?.submit_another_form ?? 0),
    show_blank_form: !!(formViewData.value?.show_blank_form ?? 0),
    meta: {
      hide_branding: false,
      background_color: '#F9F9FA',
      hide_banner: false,
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
    .filter((f) => !formViewHiddenColTypes.includes(f.uidt) && !systemFieldsIds.value.includes(f.fk_column_id))
    .sort((a, b) => a.order - b.order)
    .map((c) => ({ ...c, required: !!c.required }))

  checkFieldVisibility()
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

function resetFormFieldState() {
  if (!activeField.value) return

  // Reset the formstate if column type is changed or if column is deleted
  delete formState.value[activeField.value.title]
  if (isVirtualCol(activeField.value)) {
    delete state.value[activeField.value.title]
  }
}

async function addColumnCallback() {
  dropdownStates.value.showAddColumn = false

  reloadEventHook.trigger()
}

async function editColumnCallback() {
  dropdownStates.value.showEditColumn = false

  if (activeField.value && activeField.value.uidt !== activeColumn.value?.uidt) {
    resetFormFieldState()
  }

  reloadEventHook.trigger()
}

async function deleteColumnCallback() {
  resetFormFieldState()
  reloadEventHook.trigger()
}

const onFormItemClick = (element: any, sidebarClick = false) => {
  if (isLocked.value || !isEditable) return

  if (sidebarClick) {
    autoScrollFormField.value = true
  }

  activeRow.value = element.id
}

const handleChangeBackground = (color: string) => {
  if (isLocked.value || !isEditable) return

  const tcolor = tinycolor(color)
  if (tcolor.isValid()) {
    ;(formViewData.value?.meta as Record<string, any>).background_color = color
    updateView()
  }
}

const openUploadImage = (isUploadBanner: boolean) => {
  if (!isEditable || !isEeUI) return

  imageCropperData.value.uploadConfig = {
    path: [NOCO, base.value.id, meta.value?.id, formViewData.value?.id].join('/'),
  }
  if (isUploadBanner) {
    imageCropperData.value.cropperConfig = {
      ...imageCropperData.value.cropperConfig,
      stencilProps: {
        aspectRatio: 4 / 1,
      },
      minHeight: 100,
      minWidth: 0,
    }
    imageCropperData.value.cropFor = 'banner'
  } else {
    imageCropperData.value.cropperConfig = {
      ...imageCropperData.value.cropperConfig,
      stencilProps: {
        aspectRatio: undefined,
      },
      minHeight: 150,
      minWidth: 150,
    }
    imageCropperData.value.cropFor = 'logo'
  }

  open()
}

onChangeFile((files) => {
  if (files && files[0]) {
    // 1. Revoke the object URL, to allow the garbage collector to destroy the uploaded before file
    if (imageCropperData.value.imageConfig.src) {
      URL.revokeObjectURL(imageCropperData.value.imageConfig.src)
    }
    // 2. Create the blob link to the file to optimize performance:
    const blob = URL.createObjectURL(files[0])

    // 3. Update the image. The type will be derived from the extension
    imageCropperData.value.imageConfig = {
      src: blob,
      type: files[0].type,
      name: files[0].name,
    }

    showCropper.value = true
  }
})

const handleOnUploadImage = (data: AttachmentResType = null) => {
  if (imageCropperData.value.cropFor === 'banner') {
    formViewData.value!.banner_image_url = data
  } else {
    formViewData.value!.logo_url = data
  }
  updateView()
}

const isFocusedFieldLabel = ref(false)

const onFocusActiveFieldLabel = (e: FocusEvent) => {
  isFocusedFieldLabel.value = true

  if (activeField.value && !activeField.value.label) {
    activeField.value.label = activeField.value?.title ?? ''
  }

  ;(e.target as HTMLTextAreaElement).select()
}

const activeFieldLabel = computed(() => {
  if (!isFocusedFieldLabel.value && !activeField.value?.label) {
    return activeField.value?.title
  }

  return activeField.value?.label ?? ''
})

onClickOutside(focusLabel, () => {
  isFocusedFieldLabel.value = false
})

const updateFieldTitle = (value: string) => {
  if (!activeField.value) return

  activeField.value.label = value.trimStart()
}

const handleAutoScrollFormField = (title: string, isSidebar: boolean) => {
  const field = document.querySelector(
    `${isSidebar ? '.nc-form-field-item-' : '.nc-form-drag-'}${CSS.escape(title?.replaceAll(' ', ''))}`,
  )

  if (field) {
    setTimeout(() => {
      field?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 50)
  }
}

async function loadReleatedMetas() {
  await Promise.all(
    (localColumns.value || []).map(async (c: ColumnType) => {
      const fk_related_model_id = (c?.colOptions as LinkToAnotherRecordType)?.fk_related_model_id

      if (isVirtualCol(c) && isLinksOrLTAR(c) && fk_related_model_id) {
        await getMeta(fk_related_model_id)
      }
      return c
    }),
  )
}

const updateActiveFieldDescription = (value) => {
  if (!activeField.value || activeField.value?.description === value) return

  activeField.value.description = value
  updateColMeta(activeField.value)
}

onMounted(async () => {
  if (imageCropperData.value.src) {
    URL.revokeObjectURL(imageCropperData.value.imageConfig.src)
  }

  preFillFormSearchParams.value = ''

  isLoadingFormView.value = true

  await Promise.all([loadFormView(), loadReleatedMetas(), loadAllviewFilters()])

  setFormData()

  isLoadingFormView.value = false
})

watch(submitted, (v) => {
  if (v && formViewData.value?.show_blank_form) {
    secondsRemain.value = 5
    const intvl = setInterval(() => {
      if (--secondsRemain.value < 0) {
        submitted.value = false
        clearForm()
        clearInterval(intvl)
      }
    }, 1000)
  }
})

watch(view, (nextView, oldView) => {
  if (nextView?.type === ViewTypes.FORM && nextView?.id !== oldView?.id) {
    reloadEventHook.trigger()
  }
})

watch(
  [formState, state],
  async () => {
    for (const virtualField in state.value) {
      formState.value[virtualField] = state.value[virtualField]
    }
    updatePreFillFormSearchParams()

    try {
      await validate(
        Object.keys(formState.value)
          .map((title) => fieldMappings.value[title])
          .filter((v) => v !== undefined),
      )
    } catch {}
  },
  {
    deep: true,
  },
)

watch(activeField, (newValue, oldValue) => {
  if (newValue && autoScrollFormField.value) {
    nextTick(() => {
      handleAutoScrollFormField(newValue.title, false)
    })
  } else if (oldValue) {
    nextTick(() => {
      handleAutoScrollFormField(oldValue.title, true)
    })
  }

  autoScrollFormField.value = false

  dropdownStates.value = {
    ...dropdownStates.value,
    showColumnMenu: false,
    showEditColumn: false,
  }
})

watch(focusLabel, () => {
  if (activeField.value && focusLabel.value) {
    nextTick(() => {
      focusLabel.value?.focus()
    })
  }
})

watch(isLocked, (newValue) => {
  if (newValue) {
    activeRow.value = ''
  }

  clearForm()
})

useEventListener(
  document,
  'keydown',
  (e: KeyboardEvent) => {
    const cmdOrCtrl = isMac() ? e.metaKey : e.ctrlKey

    switch (e.key?.toLowerCase()) {
      case 's':
        if (
          cmdOrCtrl &&
          !(
            ['input', 'textarea'].includes((e.target as any).nodeName.toLowerCase()) ||
            (e.target as any)?.getAttribute('contenteditable')
          )
        ) {
          e.preventDefault()
          updateView()
        }
        break
    }
  },
  true,
)

useEventListener(
  document,
  'mousedown',
  (e: MouseEvent) => {
    if (
      (draggableRef.value?.targetDomElement && draggableRef.value?.targetDomElement.contains(e.target)) ||
      (e.target as HTMLElement)?.closest(
        '.nc-form-right-panel, [class*="dropdown"], .nc-form-rich-text-field, .ant-modal, .ant-modal-wrap, .nc-share-base-button, .nc-form-right-sidebar-content-resizable-wrapper .splitpanes__splitter',
      )
    ) {
      return
    }

    activeRow.value = ''
  },
  true,
)

const { message: templatedMessage } = useTemplatedMessage(
  computed(() => formViewData?.value?.success_msg),
  computed(() => formState.value),
)
</script>

<template>
  <div class="h-full relative">
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
        class="h-full p-6 overflow-auto nc-form-scrollbar"
        :style="{ background: parseProp(formViewData?.meta)?.background_color || '#F9F9FA' }"
        data-testid="nc-form-wrapper-submit"
      >
        <div class="max-w-[max(33%,688px)] mx-auto">
          <GeneralFormBanner
            v-if="!parseProp(formViewData?.meta).hide_banner"
            :banner-image-url="formViewData?.banner_image_url"
          />

          <div
            class="transition-all duration-300 ease-in relative my-6 bg-white rounded-3xl border-1 border-gray-200 px-4 py-8 lg:p-12 md:(p-8 dark:bg-slate-700)"
          >
            <div v-if="formViewData" class="items-center justify-center text-left mt-2">
              <div>
                <h1 class="text-2xl font-bold text-gray-900 mb-4">
                  {{ formViewData.heading }}
                </h1>

                <div v-if="formViewData.subheading?.trim()">
                  <LazyCellRichText
                    :value="formViewData.subheading"
                    class="font-medium text-base text-gray-500 !h-auto mb-4 -ml-1"
                    is-form-field
                    read-only
                    sync-value-change
                  />
                </div>
              </div>

              <div class="flex justify-center">
                <div class="w-full">
                  <a-alert class="nc-form-success-msg !my-4 !py-4 text-left !rounded-lg" type="success" outlined>
                    <template #message>
                      <LazyCellRichText
                        v-if="templatedMessage"
                        :value="templatedMessage"
                        class="!h-auto -ml-1"
                        is-form-field
                        read-only
                        sync-value-change
                      />
                      <span v-else> {{ $t('msg.successfullySubmittedFormData') }} </span>
                    </template>
                  </a-alert>

                  <div class="mt-16 w-full flex justify-between items-center gap-3">
                    <div v-if="formViewData.show_blank_form" class="text-gray-400">
                      {{
                        $t('msg.newFormWillBeLoaded', {
                          seconds: secondsRemain,
                        })
                      }}
                    </div>

                    <div v-if="formViewData.submit_another_form || !isPublic" class="flex-1 flex justify-end">
                      <NcButton
                        type="primary"
                        size="small"
                        @click="
                          () => {
                            submitted = false
                            clearForm()
                          }
                        "
                      >
                        {{ $t('activity.submitAnotherForm') }}
                      </NcButton>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="nc-form-wrapper h-full w-full flex relative" data-testid="nc-form-wrapper">
        <div v-if="isLoadingFormView" class="flex-1 flex items-center justify-center text-center h-full">
          <div>
            <GeneralLoader size="xlarge" />
            <div class="mt-2">
              {{ $t('general.loading') }}
            </div>
          </div>
        </div>
        <template v-else-if="formViewData">
          <SmartsheetFormLayout>
            <template #preview>
              <div
                class="w-full h-full overflow-auto nc-form-scrollbar p-6"
                :style="{background:(formViewData?.meta as Record<string,any>).background_color || '#F9F9FA'}"
              >
                <div class="min-w-[616px] overflow-x-auto nc-form-scrollbar">
                  <GeneralImageCropper
                    v-if="isEditable"
                    v-model:show-cropper="showCropper"
                    :image-config="imageCropperData.imageConfig"
                    :cropper-config="imageCropperData.cropperConfig"
                    :upload-config="imageCropperData.uploadConfig"
                    @submit="handleOnUploadImage"
                  ></GeneralImageCropper>
                  <!-- cover image -->
                  <div v-if="!parseProp(formViewData?.meta).hide_banner" class="group relative max-w-[max(33%,688px)] mx-auto">
                    <GeneralFormBanner
                      :key="formViewData.banner_image_url?.path"
                      :banner-image-url="formViewData.banner_image_url"
                    />
                    <div class="absolute bottom-0 right-0 hidden group-hover:block">
                      <div class="flex items-center space-x-1 m-2">
                        <NcTooltip :disabled="isEeUI || isLocked">
                          <template #title>
                            <div class="text-center">
                              {{ $t('msg.info.thisFeatureIsOnlyAvailableInEnterpriseEdition') }}
                            </div>
                          </template>

                          <NcButton
                            type="secondary"
                            size="small"
                            class="nc-form-upload-banner-btn"
                            data-testid="nc-form-upload-banner-btn"
                            :disabled="!isEeUI || isLocked"
                            @click="openUploadImage(true)"
                          >
                            <div class="flex gap-2 items-center">
                              <component :is="iconMap.upload" class="w-4 h-4" />
                              <span>
                                {{ formViewData.banner_image_url ? $t('general.replace') : $t('general.upload') }}
                                {{ $t('general.banner') }}
                              </span>
                            </div>
                          </NcButton>
                        </NcTooltip>
                        <NcTooltip v-if="isEeUI && formViewData.banner_image_url" :disabled="isLocked">
                          <template #title> {{ $t('general.delete') }} {{ $t('general.banner') }} </template>
                          <NcButton
                            type="secondary"
                            size="small"
                            class="nc-form-delete-banner-btn"
                            data-testid="nc-form-delete-banner-btn"
                            :disabled="isLocked"
                            @click="
                              () => {
                                if (isEditable) {
                                  formViewData!.banner_image_url = null
                                  updateView()
                                }
                              }
                            "
                          >
                            <div class="flex gap-2 items-center">
                              <component :is="iconMap.delete" class="w-4 h-4" />
                            </div>
                          </NcButton>
                        </NcTooltip>
                      </div>
                    </div>
                  </div>
                  <a-card
                    class="!py-8 !lg:py-12 !border-gray-200 !rounded-3xl !mt-6 !max-w-[max(33%,688px)] !mx-auto"
                    :body-style="{
                      margin: '0 auto',
                      padding: '0px !important',
                    }"
                  >
                    <a-form :model="formState" class="nc-form" no-style>
                      <!-- form header -->
                      <div class="flex flex-col px-4 lg:px-6">
                        <!-- Form logo  -->
                        <div class="mb-4">
                          <div
                            class="nc-form-logo-wrapper mx-6 group relative inline-block h-56px overflow-hidden flex items-center"
                            :class="
                              formViewData.logo_url
                                ? 'max-w-189px hover:(w-full bg-gray-100 rounded-xl) '
                                : 'bg-gray-100 max-w-147px rounded-xl'
                            "
                            style="transition: all 0.3s ease-in"
                          >
                            <LazyCellAttachmentPreviewImage
                              v-if="formViewData.logo_url"
                              :key="formViewData.logo_url?.path"
                              :srcs="getFormLogoSrc"
                              class="flex-none nc-form-logo !object-contain object-left max-h-full max-w-full !m-0"
                            />
                            <div
                              class="items-center space-x-1 flex-nowrap m-3"
                              :class="formViewData.logo_url ? 'hidden absolute top-0 left-0 group-hover:flex' : 'flex'"
                            >
                              <NcTooltip :disabled="isEeUI || isLocked">
                                <template #title>
                                  <div class="text-center">
                                    {{ $t('msg.info.thisFeatureIsOnlyAvailableInEnterpriseEdition') }}
                                  </div>
                                </template>
                                <NcButton
                                  v-if="isEditable"
                                  type="secondary"
                                  size="small"
                                  class="nc-form-upload-logo-btn"
                                  data-testid="nc-form-upload-log-btn"
                                  :disabled="!isEeUI || isLocked"
                                  @click="openUploadImage(false)"
                                >
                                  <div class="flex gap-2 items-center">
                                    <component :is="iconMap.upload" class="w-4 h-4" />
                                    <span> {{ formViewData.logo_url ? $t('general.replace') : $t('general.upload') }} Logo</span>
                                  </div>
                                </NcButton>
                              </NcTooltip>
                              <NcTooltip v-if="isEeUI && formViewData.logo_url" :disabled="isLocked">
                                <template #title> {{ $t('general.delete') }} {{ $t('general.logo') }} </template>
                                <NcButton
                                  type="secondary"
                                  size="small"
                                  class="nc-form-delete-logo-btn"
                                  data-testid="nc-form-delete-logo-btn"
                                  :disabled="isLocked"
                                  @click="
                              () => {
                                if (isEditable) {
                                  formViewData!.logo_url = null
                                  updateView()
                                }
                              }
                            "
                                >
                                  <div class="flex gap-2 items-center">
                                    <component :is="iconMap.delete" class="w-4 h-4" />
                                  </div>
                                </NcButton>
                              </NcTooltip>
                            </div>
                          </div>
                        </div>

                        <!-- form title -->
                        <div
                          class="border-transparent px-4 lg:px-6"
                          :class="[
                            {
                              'rounded-2xl overflow-hidden border-2 cursor-pointer mb-1 py-4 lg:py-6 focus-within:bg-gray-50':
                                isEditable,
                            },
                            {
                              'mb-4 py-0 lg:py-0': !isEditable,
                            },
                            {
                              'hover:bg-gray-50': activeRow !== NcForm.heading && isEditable,
                            },
                            {
                              'bg-gray-50': activeRow === NcForm.heading && isEditable,
                            },
                            {
                              '!hover:bg-white !ring-0 !cursor-auto': isLocked,
                            },
                          ]"
                          @click.stop="onFormItemClick({ id: NcForm.heading })"
                        >
                          <a-form-item v-if="isEditable" class="!my-0">
                            <a-textarea
                              v-model:value="formViewData.heading"
                              class="nc-form-focus-element !p-0 !m-0 w-full !font-bold !text-2xl !border-0 !rounded-none !text-gray-900"
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
                              :data-testid="NcForm.heading"
                              :data-title="NcForm.heading"
                              @input="updateView"
                              @focus="activeRow = NcForm.heading"
                              @blur="activeRow = ''"
                            />
                          </a-form-item>

                          <div v-else class="font-bold text-2xl text-gray-900">
                            {{ formViewData.heading }}
                          </div>
                        </div>

                        <!-- form description  -->
                        <div
                          class="border-transparent px-4 lg:px-6 empty:hidden"
                          :class="[
                            {
                              'rounded-2xl border-2 cursor-pointer mb-1 py-4 lg:py-6 focus-within:bg-gray-50': isEditable,
                            },
                            {
                              'mb-4 py-0 lg:py-0': !isEditable,
                            },
                            {
                              'hover:bg-gray-50': activeRow !== NcForm.subheading && isEditable,
                            },
                            {
                              'bg-gray-50': activeRow === NcForm.subheading && isEditable,
                            },
                            {
                              '!hover:bg-white !ring-0 !cursor-auto': isLocked,
                            },
                          ]"
                          @click.stop="onFormItemClick({ id: NcForm.subheading })"
                        >
                          <LazyCellRichText
                            v-if="isEditable && !isLocked"
                            v-model:value="formViewData.subheading"
                            :placeholder="$t('msg.info.formDesc')"
                            class="nc-form-description nc-form-focus-element font-medium text-base !text-gray-500 -ml-1"
                            is-form-field
                            :autofocus="activeRow === NcForm.subheading"
                            :data-testid="NcForm.subheading"
                            :data-title="NcForm.subheading"
                            hide-mention
                            @update:value="updateView"
                            @focus="activeRow = NcForm.subheading"
                            @blur="activeRow = ''"
                          />
                          <LazyCellRichText
                            v-else-if="formViewData.subheading"
                            :value="formViewData.subheading"
                            class="font-medium text-base !text-gray-500 -ml-1"
                            is-form-field
                            read-only
                            sync-value-change
                          />
                        </div>
                      </div>

                      <Draggable
                        ref="draggableRef"
                        :model-value="visibleColumns"
                        item-key="fk_column_id"
                        draggable=".item"
                        handle=".nc-form-field-drag-handler"
                        group="form-inputs"
                        ghost-class="nc-form-field-ghost"
                        class="h-full px-4 lg:px-6"
                        :move="onMoveCallback"
                        :disabled="isLocked || !isEditable"
                        @change="onMove($event, true)"
                      >
                        <template #item="{ element }">
                          <div
                            v-if="!isLocked || (isLocked && element?.visible)"
                            :key="element.id"
                            class="nc-editable nc-form-focus-element item relative bg-white p-4 lg:p-6"
                            :class="[
                              `nc-form-drag-${element.title.replaceAll(' ', '')}`,
                              {
                                'rounded-2xl border-2 my-1': isEditable,
                              },
                              {
                                'border-transparent my-0': !isEditable,
                              },
                              {
                                'nc-form-field-drag-handler border-transparent hover:(bg-gray-50) cursor-pointer':
                                  activeRow !== element.id && isEditable,
                              },

                              {
                                'border-brand-500': activeRow === element.id,
                              },
                              {
                                '!hover:bg-white !ring-0 !cursor-auto': isLocked,
                              },
                            ]"
                            :data-title="element.title"
                            data-testid="nc-form-fields"
                            @click.stop="onFormItemClick(element)"
                          >
                            <div v-if="activeRow === element.id" class="absolute -left-3 top-6">
                              <NcButton
                                type="primary"
                                size="small"
                                class="nc-form-field-drag-handler !cursor-move !p-1 !min-w-6 !h-auto !rounded"
                              >
                                <component
                                  :is="iconMap.drag"
                                  class="nc-form-field-drag-handler flex-none !h-4 !w-4 text-white font-bold"
                                />
                              </NcButton>
                            </div>
                            <div class="flex items-center gap-3">
                              <NcTooltip
                                v-if="allViewFilters[element.fk_column_id]?.length && !isLocked"
                                class="relative h-3.5 w-3.5 flex cursor-pointer"
                                placement="topLeft"
                              >
                                <template #title> Conditionally visible field </template>
                                <Transition name="icon-fade" :duration="500">
                                  <GeneralIcon
                                    v-if="element?.visible"
                                    icon="eye"
                                    class="nc-field-visibility-icon nc-field-visible w-3.5 h-3.5 flex-none text-nc-content-gray-muted"
                                  />
                                  <GeneralIcon
                                    v-else
                                    icon="eyeSlash"
                                    class="nc-field-visibility-icon w-3.5 h-3.5 flex-none text-nc-content-gray-muted"
                                  />
                                </Transition>
                              </NcTooltip>
                              <div class="text-sm font-semibold text-gray-800">
                                <span data-testid="nc-form-input-label">
                                  {{ element.label || element.title }}
                                </span>
                                <span v-if="isRequired(element, element.required)" class="text-red-500 text-base leading-[18px]"
                                  >&nbsp;*</span
                                >
                              </div>
                            </div>

                            <LazyCellRichText
                              v-if="element.description"
                              :value="element.description"
                              is-form-field
                              read-only
                              sync-value-change
                              class="nc-form-help-text text-gray-500 text-sm mt-2 -ml-1"
                              data-testid="nc-form-help-text"
                              @update:value="updateColMeta(element)"
                            />

                            <!-- Field Body  -->

                            <div class="nc-form-field-body">
                              <div class="mt-2">
                                <a-form-item
                                  v-if="fieldMappings[element.title]"
                                  :name="fieldMappings[element.title]"
                                  class="!my-0 nc-input-required-error nc-form-input-item"
                                  v-bind="validateInfos[fieldMappings[element.title]]"
                                >
                                  <LazySmartsheetDivDataCell class="relative" @click.stop>
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
                                      :class="[
                                        `nc-form-input-${element.title.replaceAll(' ', '')}`,
                                        { 'layout-list': element.meta.isList },
                                      ]"
                                      :data-testid="`nc-form-input-${element.title.replaceAll(' ', '')}`"
                                      :column="element"
                                      :edit-enabled="true"
                                    />
                                  </LazySmartsheetDivDataCell>
                                </a-form-item>

                                <div>
                                  <LazySmartsheetFormFieldConfigError :column="element" mode="preview" />
                                </div>
                              </div>
                            </div>
                          </div>
                        </template>

                        <template #footer>
                          <div
                            v-if="!visibleColumns.length && isEditable"
                            class="mt-4 border-dashed border-2 border-gray-400 py-3 text-gray-400 text-center"
                          >
                            {{ $t('title.selectFieldsFromRightPannelToAddHere') }}
                          </div>
                        </template>
                      </Draggable>

                      <div class="flex justify-between items-center mt-6 !px-8 !lg:px-12">
                        <NcButton
                          type="secondary"
                          size="small"
                          :disabled="!isUIAllowed('dataInsert') || !visibleColumns.length"
                          class="nc-form-clear nc-form-focus-element"
                          data-testid="nc-form-clear"
                          data-title="nc-form-clear"
                          @click="clearForm"
                        >
                          {{ $t('activity.clearForm') }}
                        </NcButton>

                        <NcButton
                          type="primary"
                          size="small"
                          :disabled="!isUIAllowed('dataInsert') || !visibleColumns.length"
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
                      <a-divider class="!my-8" />
                      <!-- Nocodb Branding  -->
                      <div class="inline-block">
                        <GeneralFormBranding />
                      </div>
                    </div>
                  </a-card>
                </div>
              </div>
            </template>
            <template #sidebar>
              <!-- Right Panel -->
              <div
                class="nc-form-right-panel h-full flex-grow max-w-full"
                :class="{
                  'overflow-y-auto nc-form-scrollbar': activeField,
                  'relative': isLocked,
                }"
              >
                <!-- Form Field settings -->
                <div v-if="activeField && activeColumn" :key="activeField?.id" class="nc-form-field-right-panel">
                  <!-- Field header -->
                  <div class="px-3 pt-4 pb-2 flex items-center justify-between border-b border-gray-200 font-medium">
                    <div class="flex items-center">
                      <div class="text-gray-600 font-medium cursor-pointer select-none hover:underline" @click="activeRow = ''">
                        {{ $t('objects.viewType.form') }}
                      </div>
                      <div class="px-1.75 text-gray-500 text-xl font-normal">/</div>

                      <div class="flex items-center pr-1 py-1.5 text-gray-800">
                        <SmartsheetHeaderVirtualCellIcon
                          v-if="isVirtualCol(activeField)"
                          :column-meta="activeField"
                          class="flex-none"
                        />
                        <SmartsheetHeaderCellIcon v-else :column-meta="activeField" class="flex-none" />

                        <NcTooltip class="truncate max-w-[120px] text-sm font-semibold" show-on-truncate-only>
                          <template #title>
                            <div class="text-center">
                              {{ activeField.title }}
                            </div>
                          </template>

                          <span data-testid="nc-form-input-label">
                            {{ activeField.title }}
                          </span>
                        </NcTooltip>
                      </div>
                    </div>
                    <div class="flex items-center space-x-2">
                      <a-dropdown
                        v-model:visible="dropdownStates.showEditColumn"
                        :trigger="['click']"
                        overlay-class-name="nc-dropdown-form-edit-column"
                        :disabled="!isUIAllowed('fieldEdit') || isLocked"
                        @visible-change="onVisibilityChange('showEditColumn')"
                      >
                        <NcButton type="secondary" size="small" class="nc-form-add-field" data-testid="nc-form-add-field">
                          {{ $t('general.edit') }} {{ $t('objects.field') }}
                        </NcButton>
                        <template #overlay>
                          <div class="nc-edit-or-add-provider-wrapper">
                            <LazySmartsheetColumnEditOrAddProvider
                              v-if="dropdownStates.showEditColumn"
                              ref="editOrAddProviderRef"
                              :column="activeColumn"
                              @submit="editColumnCallback"
                              @cancel="dropdownStates.showEditColumn = false"
                              @click.stop
                              @keydown.stop
                            />
                          </div>
                        </template>
                      </a-dropdown>
                      <SmartsheetFormFieldMenu
                        v-model:is-open="dropdownStates.showColumnMenu"
                        :column="activeColumn"
                        :form-column="activeField"
                        :is-required="isRequired(activeField, activeField.required)"
                        :on-delete="
                          () => {
                            deleteColumnCallback()
                          }
                        "
                        @hide-field="showOrHideColumn(activeField, false, false)"
                      />
                    </div>
                  </div>
                  <!-- Field text -->
                  <div class="nc-form-field-text p-4 flex flex-col gap-4 border-b border-gray-200">
                    <div class="text-sm font-bold text-gray-800">
                      {{ $t('objects.field') }} {{ $t('general.text').toLowerCase() }}
                    </div>

                    <a-textarea
                      ref="focusLabel"
                      :value="activeFieldLabel"
                      :rows="1"
                      auto-size
                      hide-details
                      class="form-meta-input nc-form-input-label !max-h-7.5rem nc-form-scrollbar"
                      data-testid="nc-form-input-label"
                      :placeholder="$t('msg.info.formInput')"
                      @focus="onFocusActiveFieldLabel"
                      @blur="isFocusedFieldLabel = false"
                      @keydown.enter.prevent
                      @input="updateFieldTitle($event.target.value)"
                      @change="updateColMeta(activeField)"
                    />

                    <LazyCellRichText
                      :value="activeField.description"
                      :placeholder="$t('msg.info.formHelpText')"
                      class="form-meta-input nc-form-input-help-text"
                      is-form-field
                      :hidden-bubble-menu-options="hiddenBubbleMenuOptions"
                      hide-mention
                      data-testid="nc-form-input-help-text"
                      @update:value="updateActiveFieldDescription"
                    />
                  </div>
                  <LazySmartsheetFormFieldSettings v-if="activeField"></LazySmartsheetFormFieldSettings>
                </div>

                <!-- Form Settings -->
                <template v-else>
                  <Splitpanes v-if="formViewData" horizontal class="nc-form-settings w-full nc-form-right-splitpane">
                    <Pane min-size="30" size="50" class="nc-form-right-splitpane-item p-4 flex flex-col space-y-4 !min-h-200px">
                      <div class="flex flex-wrap justify-between items-center gap-2">
                        <div class="flex items-center gap-3">
                          <div class="text-sm font-bold text-gray-800">
                            {{ $t('objects.viewType.form') }} {{ $t('objects.fields') }}
                          </div>
                          <NcBadge color="border-gray-200">
                            {{ visibleColumns.length }}/{{ localColumns.length }} {{ $t('objects.field') }}
                          </NcBadge>
                        </div>

                        <a-dropdown
                          v-if="isUIAllowed('fieldAdd')"
                          v-model:visible="dropdownStates.showAddColumn"
                          :trigger="['click']"
                          :disabled="isLocked"
                          overlay-class-name="nc-dropdown-form-add-column"
                          @visible-change="onVisibilityChange('showAddColumn')"
                        >
                          <NcButton type="secondary" size="small" class="nc-form-add-field" data-testid="nc-form-add-field">
                            <div class="flex gap-2 items-center">
                              <component :is="iconMap.plus" class="w-4 h-4" />
                              <span> {{ $t('activity.addFieldFromFormView') }} </span>
                            </div>
                          </NcButton>

                          <template #overlay>
                            <div class="nc-edit-or-add-provider-wrapper">
                              <LazySmartsheetColumnEditOrAddProvider
                                v-if="dropdownStates.showAddColumn"
                                ref="editOrAddProviderRef"
                                @submit="addColumnCallback"
                                @cancel="dropdownStates.showAddColumn = false"
                                @click.stop
                                @keydown.stop
                              />
                            </div>
                          </template>
                        </a-dropdown>
                      </div>

                      <form autocomplete="off">
                        <a-input
                          key="nc-form-field-search-input"
                          v-model:value="searchQuery"
                          type="text"
                          autocomplete="off"
                          class="!h-9 !px-3 !py-1 !rounded-lg"
                          :placeholder="`${$t('placeholder.searchFields')}...`"
                          name="nc-form-field-search-input"
                          data-testid="nc-form-field-search-input"
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
                      </form>

                      <div class="nc-form-fields-list border-1 border-gray-200 rounded-lg overflow-y-auto nc-form-scrollbar">
                        <div v-if="!localColumns.length" class="px-0.5 py-2 text-gray-500 text-center">
                          {{ $t('title.noFieldsFound') }}
                        </div>
                        <template v-if="localColumns.length">
                          <div
                            key="nc-form-show-all-fields"
                            class="w-full flex items-center border-b-1 rounded-t-lg border-gray-200 bg-gray-50 sticky top-0 z-49"
                            data-testid="nc-form-show-all-fields"
                            @click.stop
                          >
                            <div class="w-4 h-4 flex-none mx-2"></div>
                            <div class="flex-1 flex flex-row items-center truncate cursor-pointer">
                              <div class="flex-1 font-base my-1.5">{{ $t('activity.selectAllFields') }}</div>
                              <div class="flex items-center px-2">
                                <a-switch
                                  :checked="visibleColumns.length === localColumns.length"
                                  size="small"
                                  class="nc-switch"
                                  :disabled="isLocked"
                                  @change="handleAddOrRemoveAllColumns"
                                />
                              </div>
                            </div>
                          </div>
                          <Draggable
                            :list="localColumns"
                            item-key="id"
                            ghost-class="nc-form-field-ghost"
                            :style="{ height: 'calc(100% - 64px)' }"
                            :disabled="isLocked || !isEditable"
                            @change="onMove($event)"
                            @start="drag = true"
                            @end="drag = false"
                          >
                            <template #item="{ element: field }">
                              <div
                                v-if="field.title.toLowerCase().includes(searchQuery.toLowerCase())"
                                :key="field.id"
                                class="w-full px-2 flex flex-row items-center border-b-1 last:border-none border-gray-200"
                                :class="[
                                  `nc-form-field-item-${field.title.replaceAll(' ', '')}`,
                                  `${activeRow === field.id ? 'bg-brand-50 font-medium' : 'hover:bg-gray-50'}`,
                                ]"
                                :data-testid="`nc-form-field-item-${field.title}`"
                              >
                                <div class="py-1.5 flex items-center">
                                  <component :is="iconMap.drag" class="flex-none cursor-move !h-4 !w-4 text-gray-600 mr-1" />
                                </div>
                                <div
                                  class="flex-1 flex items-center justify-between cursor-pointer max-w-[calc(100%_-_20px)] py-1.5"
                                >
                                  <div
                                    class="flex-1 flex items-center cursor-pointer max-w-[calc(100%_-_40px)]"
                                    @click.prevent="onFormItemClick(field, true)"
                                  >
                                    <SmartsheetHeaderVirtualCellIcon
                                      v-if="field && isVirtualCol(field)"
                                      :column-meta="field"
                                      class="!text-gray-600"
                                    />
                                    <SmartsheetHeaderCellIcon v-else :column-meta="field" class="!text-gray-600" />
                                    <div class="flex-1 flex items-center justify-start max-w-[calc(100%_-_28px)]">
                                      <div class="w-full flex items-center">
                                        <div class="ml-1 inline-flex" :class="field.label?.trim() ? 'max-w-1/2' : 'max-w-[95%]'">
                                          <NcTooltip class="truncate text-sm" :disabled="drag" show-on-truncate-only>
                                            <template #title>
                                              <div class="text-center">
                                                {{ field.title }}
                                              </div>
                                            </template>
                                            <span data-testid="nc-field-title"> {{ field.title }} </span>
                                          </NcTooltip>
                                        </div>
                                        <div
                                          v-if="field.label?.trim() && field.title !== field.label?.trim()"
                                          class="truncate inline-flex text-xs font-normal text-gray-700"
                                        >
                                          <span>&nbsp;(</span>
                                          <NcTooltip class="truncate" :disabled="drag" show-on-truncate-only>
                                            <template #title>
                                              <div class="text-center">
                                                {{ field.label }}
                                              </div>
                                            </template>
                                            <span data-testid="nc-field-title ">{{ field.label?.trim() }}</span>
                                          </NcTooltip>
                                          <span>)</span>
                                        </div>

                                        <span v-if="isRequired(field, field.required)" class="text-red-500 text-sm align-top">
                                          &nbsp;*
                                        </span>
                                        <div class="flex items-center">
                                          <LazySmartsheetFormFieldConfigError :column="field" mode="list" />
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  <NcTooltip
                                    :disabled="!field.required || isLocked || !isEditable"
                                    class="flex"
                                    placement="topRight"
                                  >
                                    <template #title> You can't hide a required field.</template>
                                    <a-switch
                                      :checked="!!field.show"
                                      :disabled="field.required || isLocked || !isEditable"
                                      class="flex-none nc-switch"
                                      size="small"
                                      @change="
                                        (value) => {
                                          showOrHideColumn(field, value, true)
                                        }
                                      "
                                    />
                                  </NcTooltip>
                                </div>
                              </div>
                            </template>
                            <template
                              v-if="
                                !localColumns?.filter((el) => el.title.toLowerCase().includes(searchQuery.toLowerCase())).length
                              "
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
                    <Pane min-size="20" size="50" class="nc-form-right-splitpane-item !overflow-y-auto nc-form-scrollbar">
                      <div class="p-4 flex flex-col space-y-4 border-b border-gray-200">
                        <!-- Appearance Settings -->
                        <div class="text-sm font-bold text-gray-800">{{ $t('labels.appearanceSettings') }}</div>

                        <div class="flex flex-col space-y-3">
                          <div :class="isLocked || !isEditable ? 'pointer-events-none' : ''">
                            <div class="text-gray-800">{{ $t('labels.backgroundColor') }}</div>
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
                                color-box-border
                                is-new-design
                                class="nc-form-theme-color-picker !pb-0 !pl-0 -ml-1"
                                @input="handleChangeBackground"
                              />
                            </div>
                          </div>

                          <div class="flex items-center justify-between gap-3">
                            <!-- Hide NocoDB Branding -->

                            <span>{{ $t('labels.hideNocodbBranding') }}</span>

                            <a-switch
                              v-if="isEeUI"
                              v-e="[`a:form-view:hide-branding`]"
                              :checked="parseProp(formViewData.meta)?.hide_branding"
                              size="small"
                              class="nc-form-hide-branding"
                              data-testid="nc-form-hide-branding"
                              :disabled="isLocked || !isEditable"
                              @change="(value) => {
                                  if (isLocked || !isEditable) return

                                  (formViewData!.meta as Record<string,any>).hide_branding = value
                                  updateView()
                                }"
                            />

                            <NcTooltip v-else placement="top">
                              <template #title>
                                <div class="text-center">
                                  {{ $t('msg.info.thisFeatureIsOnlyAvailableInEnterpriseEdition') }}
                                </div>
                              </template>
                              <a-switch :checked="false" size="small" :disabled="true" />
                            </NcTooltip>
                          </div>
                          <div class="flex items-center justify-between gap-3">
                            <!-- Hide Banner -->
                            <span>{{ $t('general.hide') }} {{ $t('general.banner') }}</span>
                            <a-switch
                              v-e="[`a:form-view:hide-banner`]"
                              :checked="parseProp(formViewData.meta)?.hide_banner"
                              size="small"
                              class="nc-form-hide-banner"
                              data-testid="nc-form-hide-banner"
                              :disabled="isLocked || !isEditable"
                              @change="(value) => {
                                  if (isLocked || !isEditable) return

                                  (formViewData!.meta as Record<string,any>).hide_banner = value
                                  updateView()
                                }"
                            />
                          </div>
                        </div>
                      </div>

                      <div class="p-4 flex flex-col space-y-4">
                        <!-- Post Form Submission Settings -->
                        <div class="text-sm font-bold text-gray-800">
                          {{ $t('msg.info.postFormSubmissionSettings') }}
                        </div>

                        <div class="flex flex-col gap-3">
                          <div class="flex flex-col gap-3">
                            <div class="flex items-center justify-between gap-3">
                              <!-- Redirect to URL -->
                              <span>{{ $t('labels.redirectToUrl') }}</span>
                              <a-switch
                                v-model:checked="isOpenRedirectUrl"
                                v-e="[`a:form-view:redirect-url`]"
                                size="small"
                                class="nc-form-checkbox-redirect-url"
                                data-testid="nc-form-checkbox-redirect-url"
                                :disabled="isLocked || !isEditable"
                                @change="updateView"
                              />
                            </div>
                            <div v-if="isOpenRedirectUrl" class="flex flex-col gap-2 max-w-[calc(100%_-_40px)]">
                              <a-form-item class="!my-0" v-bind="redirectLinkValidation">
                                <a-input
                                  v-model:value="formViewData.redirect_url"
                                  type="text"
                                  class="!h-8 !px-3 !py-1 !rounded-lg"
                                  placeholder="Paste redirect URL here"
                                  data-testid="nc-form-redirect-url-input"
                                  @input="handleUpdateRedirectUrl"
                                ></a-input>
                              </a-form-item>
                              <div class="text-small leading-[18px] text-gray-400 pl-3">
                                Use {record_id} to get ID of the newly created record.
                                <a
                                  href="https://docs.nocodb.com/views/view-types/form/#redirect-url"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  class="!no-underline !hover:underline"
                                >
                                  Learn more
                                </a>
                              </div>
                            </div>
                          </div>
                          <template v-if="!isOpenRedirectUrl">
                            <div class="flex items-center justify-between gap-3">
                              <!-- Show "Submit Another Form" button -->
                              <span>{{ $t('msg.info.submitAnotherForm') }}</span>
                              <a-switch
                                v-model:checked="formViewData.submit_another_form"
                                v-e="[`a:form-view:submit-another-form`]"
                                size="small"
                                class="nc-form-checkbox-submit-another-form"
                                data-testid="nc-form-checkbox-submit-another-form"
                                :disabled="isLocked || !isEditable"
                                @change="updateView"
                              />
                            </div>

                            <div class="flex items-center justify-between gap-3">
                              <!-- Show a blank form after 5 seconds -->
                              <span>{{ $t('msg.info.showBlankForm') }}</span>
                              <a-switch
                                v-model:checked="formViewData.show_blank_form"
                                v-e="[`a:form-view:show-blank-form`]"
                                size="small"
                                class="nc-form-checkbox-show-blank-form"
                                data-testid="nc-form-checkbox-show-blank-form"
                                :disabled="isLocked || !isEditable"
                                @change="updateView"
                              />
                            </div>
                          </template>

                          <div class="flex items-center justify-between gap-3">
                            <!-- Email me at <email> -->
                            <span>
                              {{ $t('msg.info.emailForm') }}
                              <span class="text-bold text-gray-600 underline">{{ user?.email }}</span>
                            </span>
                            <a-switch
                              v-model:checked="emailMe"
                              v-e="[`a:form-view:email-me`]"
                              size="small"
                              class="nc-form-checkbox-send-email"
                              data-testid="nc-form-checkbox-send-email"
                              :disabled="isLocked || !isEditable"
                              @change="onEmailChange"
                            />
                          </div>
                        </div>

                        <!-- Show this message -->
                        <div v-if="!isOpenRedirectUrl" class="pb-10">
                          <div class="text-gray-800 mb-2 flex items-center">
                            {{ $t('msg.info.formDisplayMessage') }}
                            <NcTooltip>
                              <template #title>
                                Use column name/title for templated field instead of field label. For example: "Hello {Title}!"
                              </template>
                              <GeneralIcon icon="info" class="text-gray-400 ml-1" />
                            </NcTooltip>
                          </div>
                          <a-form-item class="!my-0">
                            <LazyCellRichText
                              v-if="!isLocked && isEditable"
                              v-model:value="formViewData.success_msg"
                              class="nc-form-after-submit-msg editable"
                              is-form-field
                              :hidden-bubble-menu-options="hiddenBubbleMenuOptions"
                              hide-mention
                              data-testid="nc-form-after-submit-msg"
                              @update:value="updateView" />
                            <LazyCellRichText
                              v-else
                              :value="formViewData.success_msg"
                              class="nc-form-after-submit-msg"
                              is-form-field
                              read-only
                              data-testid="nc-form-after-submit-msg"
                          /></a-form-item>
                        </div>
                      </div>
                    </Pane>
                  </Splitpanes>
                </template>

                <div v-if="isLocked" class="absolute inset-0 bg-black/12 z-500 grid place-items-center px-6">
                  <LazyDlgLockView />
                </div>
              </div>
            </template>
          </SmartsheetFormLayout>
        </template>
      </div>
    </template>
    <div
      v-if="user?.base_roles?.viewer || user?.base_roles?.commenter"
      class="absolute inset-0 bg-black/40 z-500 grid place-items-center"
    >
      <div class="text-center bg-white px-6 py-8 rounded-xl max-w-lg">
        <div class="text-2xl text-gray-800 font-bold">
          {{ $t('msg.info.yourCurrentRoleIs') }}
          '<span class="capitalize"> {{ Object.keys(user.base_roles)?.[0] ?? ProjectRoles.NO_ACCESS }}</span
          >'.
        </div>
        <div class="text-sm text-gray-700 pt-6">
          {{ $t('msg.info.pleaseRequestAccessForView', { viewName: 'form view' }) }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.nc-editable:hover {
  :deep(.nc-field-remove-icon) {
    @apply opacity-100;
  }
}

.nc-input {
  @apply appearance-none w-full;
  &:not(.layout-list) {
    &:not(.nc-cell-attachment) {
      @apply !bg-white rounded-lg border-solid border-1 border-gray-200 !focus-within:border-brand-500;
    }
  }
  &.layout-list {
    @apply h-auto !pl-0 !py-1;
  }

  &.nc-cell-geodata {
    @apply !py-1;
  }
  &.nc-cell-currency {
    @apply !py-0 !pl-0 flex items-stretch;
  }

  :deep(input) {
    &:not(.ant-select-selection-search-input) {
      @apply !px-1;
    }
  }

  &.nc-cell-longtext {
    @apply p-0 h-auto;
  }
  &.nc-cell:not(.nc-cell-longtext) {
    @apply p-2;
  }
  &.nc-virtual-cell {
    @apply px-2 py-1 min-h-10;
  }

  &.nc-cell-json {
    @apply min-h-[38px] h-auto;
    & > div {
      @apply w-full;
    }
  }

  :deep(.ant-picker) {
    @apply !py-0;
  }
  :deep(input.nc-cell-field) {
    @apply !py-0;
  }
}

.nc-form-input-label {
  @apply !px-4 !py-2 font-semibold text-gray-800 !rounded-lg !text-sm;
}

.nc-form-help-text,
.nc-input-required-error {
  max-width: 100%;
  white-space: pre-line;
  :deep(.ant-form-item-explain-error) {
    &:first-child {
      @apply mt-2;
    }
  }
}
.nc-input-required-error {
  &:focus-within {
    :deep(.ant-form-item-explain-error) {
      @apply text-gray-400;
    }
  }
}
:deep(.ant-form-item-has-error .ant-select:not(.ant-select-disabled) .ant-select-selector) {
  border: none !important;
}
:deep(.ant-form-item-has-success .ant-select:not(.ant-select-disabled) .ant-select-selector) {
  border: none !important;
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
    @apply content-[':::'] block h-4 leading-12px px-2 font-bold text-gray-800 border-1 border-gray-200 rounded bg-white absolute -top-2.5 z-49 left-[calc(50%_-_16px)];
  }
}

.nc-form-scrollbar {
  @apply scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent;
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
:deep(.nc-form-input-required + button):focus-visible {
  box-shadow: 0 0 0 2px #fff, 0 0 0 4px #3366ff;
}
:deep(.nc-form-switch-focus):focus-visible {
  box-shadow: 0 0 0 2px #fff, 0 0 0 4px #3366ff;
}
.nc-form-field-layout {
  @apply !flex !items-center w-full space-x-3;

  :deep(.ant-radio-wrapper) {
    @apply border-1 border-gray-200 rounded-lg !py-2 !px-3 basis-full !mr-0 !items-center bg-white;
    .ant-radio {
      @apply !top-0;

      .ant-radio-input:focus-visible + .ant-radio-inner {
        box-shadow: 0 0 0 2px #fff, 0 0 0 4px #3366ff;
      }
    }
  }
}
</style>

<style lang="scss">
.form-meta-input {
  .nc-textarea-rich-editor {
    @apply pl-3 pr-4 !rounded-lg !text-sm border-1 border-gray-200 focus-within:border-brand-500;

    &:hover {
      @apply border-brand-400;
    }
    &:focus-within {
      @apply shadow-selected;
    }
  }

  &.nc-form-input-label .nc-textarea-rich-editor {
    @apply pt-2 pb-1 font-semibold text-gray-800;
  }
  &.nc-form-input-help-text .nc-textarea-rich-editor {
    @apply pt-1 text-gray-700;
    .ProseMirror {
      max-height: 7.5rem !important;
    }
  }
}
.nc-form-after-submit-msg {
  .editable {
    .nc-textarea-rich-editor {
      &:hover {
        @apply border-brand-400;
      }
    }
  }
  .nc-textarea-rich-editor {
    @apply pl-1 pr-2 pt-2 pb-1 !rounded-lg !text-sm border-1 border-gray-200 focus-within:border-brand-500;

    &:focus-within {
      @apply shadow-selected;
    }

    .ProseMirror {
      min-height: 5rem;
      max-height: 7.5rem !important;
    }
  }
}
.nc-form-description {
  .nc-form-field-bubble-menu-wrapper {
    @apply -bottom-12;
  }
}
</style>
