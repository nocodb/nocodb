<script setup lang="ts">
import Draggable from 'vuedraggable'
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

const hiddenColTypes = [UITypes.Rollup, UITypes.Lookup, UITypes.Formula, UITypes.QrCode, UITypes.Barcode, UITypes.SpecificDBType]

const { isMobileMode, user } = useGlobal()

const formRef = ref()

const { $api, $e } = useNuxtApp()

const { isUIAllowed } = useRoles()

const formState = reactive({})

const secondsRemain = ref(0)

const isEditable = isUIAllowed('viewFieldEdit' as Permission)

const meta = inject(MetaInj, ref())

const view = inject(ActiveViewInj, ref())

const isPublic = inject(IsPublicInj, ref(false))

const { loadFormView, insertRow, formColumnData, formViewData, updateFormView } = useViewData(meta, view)

const reloadEventHook = inject(ReloadViewDataHookInj, createEventHook<boolean | void>())

reloadEventHook.on(async () => {
  await loadFormView()
  setFormData()
})

const { showAll, hideAll, saveOrUpdate } = useViewColumnsOrThrow()

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

const { t } = useI18n()

const { betaFeatureToggleState } = useBetaFeatureToggle()

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

async function submitForm() {
  try {
    await formRef.value?.validateFields()
  } catch (e: any) {
    e.errorFields.map((f: Record<string, any>) => message.error(f.errors.join(',')))
    if (e.errorFields.length) return
  }

  await insertRow({ row: { ...formState, ...state.value }, oldRow: {}, rowMeta: { new: true } })

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
  return (
    isDbRequired(col) || !!col.required || (!!col.rqd && !col.cdf) || col.uidt === UITypes.QrCode || col.uidt === UITypes.Barcode
  )
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
  const col = formColumnData?.value || []

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
    .filter((f) => f.show && !hiddenColTypes.includes(f.uidt))
    .sort((a, b) => a.order - b.order)
    .map((c) => ({ ...c, required: !!c.required }))

  editEnabled.value = new Array(localColumns.value.length).fill(false)

  systemFieldsIds.value = getSystemColumns(col).map((c) => c.fk_column_id)

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
</script>

<template>
  <template v-if="isMobileMode">
    <div class="pl-6 pr-[120px] py-6 bg-white flex-col justify-start items-start gap-2.5 inline-flex">
      <div class="text-gray-500 text-5xl font-semibold leading-16">
        {{ $t('general.available') }}<br />{{ $t('title.inDesktop') }}
      </div>
      <div class="text-gray-500 text-base font-medium leading-normal">{{ $t('msg.formViewNotSupportedOnMobile') }}</div>
    </div>
  </template>
  <template v-else>
    <a-row v-if="submitted" class="h-full" data-testid="nc-form-wrapper-submit">
      <a-col :span="24">
        <div v-if="formViewData" class="items-center justify-center text-center mt-2">
          <a-alert type="success">
            <template #message>
              <div class="text-center">{{ formViewData.success_msg || $t('msg.successfullySubmittedFormData') }}</div>
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
      <a-col v-if="isEditable" :span="8" class="shadow p-2 md:p-4 h-full overflow-auto scrollbar-thin-dull nc-form-left-drawer">
        <div class="flex flex-wrap gap-2">
          <div class="flex-1 text-lg">
            {{ $t('objects.fields') }}
          </div>

          <div class="flex flex-wrap gap-2 mb-4">
            <NcButton
              v-if="hiddenColumns.length"
              type="secondary"
              class="nc-form-add-all"
              data-testid="nc-form-add-all"
              @click="addAllColumns"
            >
              <!-- Add all -->
              {{ $t('general.addAll') }}
            </NcButton>

            <NcButton
              v-if="localColumns.length"
              type="secondary"
              class="nc-form-remove-all"
              data-testid="nc-form-remove-all"
              @click="removeAllColumns"
            >
              <!-- Remove all -->
              {{ $t('general.removeAll') }}
            </NcButton>
          </div>
        </div>

        <Draggable
          :list="hiddenColumns"
          item-key="id"
          draggable=".item"
          group="form-inputs"
          class="flex flex-col gap-2"
          @start="drag = true"
          @end="drag = false"
        >
          <template #item="{ element, index }">
            <a-card
              size="small"
              class="!border-0 color-transition cursor-pointer item hover:(bg-primary ring-1 ring-accent ring-opacity-100) bg-opacity-10 !rounded !shadow-lg"
              :data-testid="`nc-form-hidden-column-${element.label || element.title}`"
              @mousedown="moved = false"
              @mousemove="moved = false"
              @mouseup="handleMouseUp(element, index)"
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

          <template #footer>
            <div
              class="my-4 select-none border-dashed border-2 border-gray-400 py-3 text-gray-400 text-center nc-drag-n-drop-to-hide"
              data-testid="nc-drag-n-drop-to-hide"
            >
              <!-- Drag and drop fields here to hide -->
              {{ $t('msg.info.dragDropHide') }}
            </div>

            <a-dropdown
              v-model:visible="showColumnDropdown"
              :trigger="['click']"
              overlay-class-name="nc-dropdown-form-add-column"
            >
              <button type="button" class="group w-full mt-2" @click.stop="showColumnDropdown = true">
                <span class="flex items-center flex-wrap justify-center gap-2 prose-sm text-gray-400">
                  <component :is="iconMap.plus" class="color-transition transform group-hover:(text-accent scale-125)" />
                  <!-- Add new field to this table -->
                  <span class="color-transition group-hover:text-primary break-words">
                    {{ $t('activity.addField') }}
                  </span>
                </span>
              </button>

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
          </template>
        </Draggable>
      </a-col>

      <a-col v-if="formViewData" :span="isEditable ? 16 : 24" class="h-full overflow-auto scrollbar-thin-dull">
        <div class="h-[200px] bg-primary bg-opacity-75">
          <!-- for future implementation of cover image -->
        </div>

        <a-card
          class="p-4 border-none"
          :body-style="{
            maxWidth: 'max(50vw, 700px)',
            margin: '0 auto',
            marginTop: '-200px',
            padding: '0px',
          }"
        >
          <a-form ref="formRef" :model="formState" class="nc-form" no-style>
            <a-card class="!rounded !shadow !m-2 md:(!m-4) xl:(!m-8)" :body-style="{ paddingLeft: '0px', paddingRight: '0px' }">
              <!-- Header -->
              <div v-if="isEditable" class="px-4 lg:px-12">
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
                    placeholder="Form Title"
                    :bordered="false"
                    data-testid="nc-form-heading"
                    @blur="updateView"
                    @keydown.enter="updateView"
                  />
                </a-form-item>
              </div>
              <div v-else class="px-4 ml-3 w-full text-bold text-4xl">{{ formViewData.heading }}</div>

              <!-- Sub Header -->
              <div v-if="isEditable" class="px-4 lg:px-12">
                <a-form-item>
                  <a-textarea
                    v-model:value="formViewData.subheading"
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
                    :disabled="!isEditable"
                    data-testid="nc-form-sub-heading"
                    @blur="updateView"
                    @click="updateView"
                  />
                </a-form-item>
              </div>

              <div v-else class="px-4 ml-3 w-full text-bold text-md">{{ formViewData.subheading || '---' }}</div>

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
                      v-if="isUIAllowed('viewFieldEdit') && !isRequired(element, element.required)"
                      class="absolute flex top-2 right-2"
                    >
                      <component
                        :is="iconMap.eyeSlash"
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
                      class="!mb-0 nc-input-required-error"
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
                    v-if="!localColumns.length"
                    class="mt-4 border-dashed border-2 border-gray-400 py-3 text-gray-400 text-center"
                  >
                    {{ $t('activity.dragAndDropFieldsHereToAdd') }}
                  </div>
                </template>
              </Draggable>

              <div class="justify-center flex mt-6">
                <NcButton
                  html-type="submit"
                  type="primary"
                  :disabled="!isUIAllowed('dataInsert')"
                  class="nc-form-submit"
                  data-testid="nc-form-submit"
                  @click="submitForm"
                >
                  {{ $t('general.submit') }}
                </NcButton>
              </div>
            </a-card>
          </a-form>

          <a-divider />

          <div v-if="isEditable" class="px-4 flex flex-col gap-2">
            <!-- After form is submitted -->
            <div class="text-lg text-gray-700">
              {{ $t('msg.info.afterFormSubmitted') }}
            </div>

            <!-- Show this message -->
            <div class="text-gray-500 text-bold">{{ $t('msg.info.showMessage') }}:</div>
            <a-textarea
              v-model:value="formViewData.success_msg"
              :rows="3"
              hide-details
              class="nc-form-after-submit-msg"
              data-testid="nc-form-after-submit-msg"
              @change="updateView"
            />

            <!-- Other options -->
            <div class="flex flex-col gap-2 mt-4">
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
                  {{ $t('msg.info.emailForm') }} <span class="text-bold text-gray-600">{{ user?.email }}</span>
                </span>
              </div>
            </div>
          </div>
        </a-card>
      </a-col>
    </a-row>
  </template>
</template>

<style scoped lang="scss">
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
</style>
