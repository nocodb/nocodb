<script lang="ts" setup>
import { type ColumnReqType, type ColumnType } from 'nocodb-sdk'
import {
  UITypes,
  UITypesName,
  isLinksOrLTAR,
  isSelfReferencingTableColumn,
  isSystemColumn,
  isVirtualCol,
  readonlyMetaAllowedTypes,
} from 'nocodb-sdk'
import MdiPlusIcon from '~icons/mdi/plus-circle-outline'
import MdiMinusIcon from '~icons/mdi/minus-circle-outline'
import MdiIdentifierIcon from '~icons/mdi/identifier'

const props = defineProps<{
  preload?: Partial<ColumnType>
  columnPosition?: Pick<ColumnReqType, 'column_order'>
  // Disable styles like border, shadow to be embedded on other components
  embedMode?: boolean
  // Will be used to show where ever text 'Column' is used.
  // i.e 'Column Name' label in form, thus will be of form `${columnLabel} Name`
  columnLabel?: string
  hideTitle?: boolean
  hideType?: boolean
  hideAdditionalOptions?: boolean
  fromTableExplorer?: boolean
  editDescription?: boolean
  readonly?: boolean
  disableTitleFocus?: boolean
}>()

const emit = defineEmits(['submit', 'cancel', 'mounted', 'add', 'update'])

const {
  formState,
  isWebhookCreateModalOpen,
  generateNewColumnMeta,
  addOrUpdate,
  onAlter,
  onUidtOrIdTypeChange,
  validateInfos,
  isEdit,
  disableSubmitBtn,
  column,
} = useColumnCreateStoreOrThrow()

const editDescription = toRef(props, 'editDescription')

const { getMeta } = useMetas()

const { t } = useI18n()

const { isMetaReadOnly } = useRoles()

const { eventBus } = useSmartsheetStoreOrThrow()

const columnLabel = computed(() => props.columnLabel || t('objects.field'))

const { $e } = useNuxtApp()

const { appInfo } = useGlobal()

const { isFeatureEnabled } = useBetaFeatureToggle()

const { openedViewsTab } = storeToRefs(useViewsStore())

const { predictColumnType: _predictColumnType } = useNocoEe()

const meta = inject(MetaInj, ref())

const isForm = inject(IsFormInj, ref(false))

const isKanban = inject(IsKanbanInj, ref(false))

const readOnly = computed(() => props.readonly)

const { isMysql, isMssql, isDatabricks, isXcdbBase } = useBase()

const reloadDataTrigger = inject(ReloadViewDataHookInj)

const advancedOptions = ref(false)

const mounted = ref(false)

const showDefaultValueInput = ref(false)

const showHoverEffectOnSelectedType = ref(true)

const isVisibleDefaultValueInput = computed({
  get: () => {
    if (isValidValue(formState.value.cdf) && !showDefaultValueInput.value) {
      showDefaultValueInput.value = true
    }

    return isValidValue(formState.value.cdf) || showDefaultValueInput.value
  },
  set: (value: boolean) => {
    showDefaultValueInput.value = value
  },
})

const columnToValidate = [UITypes.Email, UITypes.URL, UITypes.PhoneNumber]

const onlyNameUpdateOnEditColumns = [
  UITypes.LinkToAnotherRecord,
  UITypes.Lookup,
  UITypes.Rollup,
  UITypes.Links,
  UITypes.CreatedTime,
  UITypes.LastModifiedTime,
  UITypes.CreatedBy,
  UITypes.LastModifiedBy,
  UITypes.Formula,
  UITypes.QrCode,
  UITypes.Barcode,
  UITypes.Button,
]

// To close column type dropdown on escape and
// close modal only when the type popup is close
const isColumnTypeOpen = ref(false)

const geoDataToggleCondition = (t: { name: UITypes }) => {
  if (!appInfo.value.ee) return true

  const isColEnabled = isFeatureEnabled(FEATURE_FLAG.GEODATA_COLUMN)

  return isColEnabled || !t.name.includes(UITypes.GeoData)
}

const showDeprecated = ref(false)

const isSystemField = (t: { name: UITypes }) =>
  [UITypes.CreatedBy, UITypes.CreatedTime, UITypes.LastModifiedBy, UITypes.LastModifiedTime].includes(t.name)

const uiFilters = (t: { name: UITypes; virtual?: number; deprecated?: boolean }) => {
  const systemFiledNotEdited = !isSystemField(t) || formState.value.uidt === t.name || !isEdit.value
  const geoDataToggle = geoDataToggleCondition(t) && (!isEdit.value || !t.virtual || t.name === formState.value.uidt)
  const specificDBType = t.name === UITypes.SpecificDBType && isXcdbBase(meta.value?.source_id)
  const showDeprecatedField = !t.deprecated || showDeprecated.value

  return systemFiledNotEdited && geoDataToggle && !specificDBType && showDeprecatedField
}

const uiTypesOptions = computed<typeof uiTypes>(() => {
  const types = [
    ...uiTypes.filter(uiFilters),
    ...(!isEdit.value && meta?.value?.columns?.every((c) => !c.pk)
      ? [
          {
            name: UITypes.ID,
            icon: MdiIdentifierIcon,
            virtual: 0,
          },
        ]
      : []),
  ]

  // if meta is readonly, move disabled types to the end
  if (isMetaReadOnly.value) {
    types.sort((a, b) => {
      const aDisabled = readonlyMetaAllowedTypes.includes(a.name)
      const bDisabled = readonlyMetaAllowedTypes.includes(b.name)

      if (aDisabled && !bDisabled) return -1
      if (!aDisabled && bDisabled) return 1

      return 0
    })
  }

  return types
})

const onSelectType = (uidt: UITypes) => {
  formState.value.uidt = uidt
  onUidtOrIdTypeChange()
}

const reloadMetaAndData = async () => {
  await getMeta(meta.value?.id as string, true)

  eventBus.emit(SmartsheetStoreEvents.FIELD_RELOAD)

  if (!isKanban.value) {
    reloadDataTrigger?.trigger()
  }
}

const saving = ref(false)

const warningVisible = ref(false)

const saveSubmitted = async () => {
  if (readOnly.value) return

  saving.value = true
  const saved = await addOrUpdate(reloadMetaAndData, props.columnPosition)
  saving.value = false

  if (!saved) return

  // add delay to complete minimize transition
  setTimeout(() => {
    advancedOptions.value = false
  }, 500)
  emit('submit')

  if (isForm.value) {
    $e('a:form-view:add-new-field')
  }
}

async function onSubmit() {
  if (readOnly.value) return

  // Show warning message if user tries to change type of column
  if (isEdit.value && formState.value.uidt !== column.value?.uidt) {
    warningVisible.value = true

    const { close } = useDialog(resolveComponent('DlgColumnUpdateConfirm'), {
      'visible': warningVisible,
      'onUpdate:visible': (value) => (warningVisible.value = value),
      'saving': saving,
      'onSubmit': async () => {
        close()
        await saveSubmitted()
      },
    })
  } else await saveSubmitted()
}

// focus and select the column name field
const antInput = ref()
watchEffect(() => {
  if (antInput.value && formState.value && !readOnly.value) {
    // todo: replace setTimeout
    setTimeout(() => {
      // focus and select input only if active element is not an input or textarea
      if (
        (document.activeElement === document.body ||
          document.activeElement === null ||
          ['BUTTON', 'DIV'].includes(document.activeElement?.tagName)) &&
        !props.disableTitleFocus
      ) {
        antInput.value?.focus()
        antInput.value?.select()
      }
    }, 300)
  }
  advancedOptions.value = false
})

const enableDescription = ref(false)

const descInputEl = ref()

const removeDescription = () => {
  formState.value.description = ''
  enableDescription.value = false
}

onMounted(() => {
  if (column.value?.description?.length || editDescription.value) {
    enableDescription.value = true
  }
  if (!isEdit.value) {
    generateNewColumnMeta(true)
  } else {
    if (formState.value.pk) {
      message.info(t('msg.info.editingPKnotSupported'))
      emit('cancel')
    } else if (isSystemColumn(formState.value) && !isSelfReferencingTableColumn(formState.value)) {
      message.info(t('msg.info.editingSystemKeyNotSupported'))
      emit('cancel')
    }
  }

  if (props.preload) {
    const { colOptions, ...others } = props.preload
    formState.value = {
      ...formState.value,
      ...others,
    }

    if (colOptions) {
      const meta = formState.value.meta || {}
      onUidtOrIdTypeChange()
      formState.value = {
        ...formState.value,
        colOptions: {
          ...colOptions,
        },
        meta,
      }
    }
  } else {
    formState.value.filters = undefined
  }

  // for cases like formula
  if (formState.value && !formState.value.column_name && !isLinksOrLTAR(formState.value)) {
    formState.value.column_name = formState.value?.title
  }

  nextTick(() => {
    mounted.value = true
    emit('mounted')
    if (!isEdit.value) {
      if (!formState.value?.temp_id) {
        emit('add', formState.value)
      }
    }

    if (isForm.value && !props.fromTableExplorer && !enableDescription.value) {
      setTimeout(() => {
        antInput.value?.focus()
        antInput.value?.select()
      }, 100)
    } else if (enableDescription.value) {
      setTimeout(() => {
        descInputEl.value?.focus()
      }, 100)
    }
  })
})

const handleEscape = (event: KeyboardEvent): void => {
  if (isColumnTypeOpen.value || isWebhookCreateModalOpen.value) return

  if (event.key === 'Escape') emit('cancel')
}

const isFieldsTab = computed(() => {
  return openedViewsTab.value === 'field'
})

const onDropdownChange = (value: boolean) => {
  if (value) {
    isColumnTypeOpen.value = value
  } else {
    showHoverEffectOnSelectedType.value = true
    setTimeout(() => {
      isColumnTypeOpen.value = value
    }, 300)
  }
}

const handleResetHoverEffect = () => {
  if (!showHoverEffectOnSelectedType.value) return

  showHoverEffectOnSelectedType.value = false
}

if (props.fromTableExplorer) {
  watch(
    formState,
    () => {
      if (mounted.value) emit('update', formState.value)
    },
    { deep: true },
  )
}

const submitBtnLabel = computed(() => {
  return {
    label: `${isEdit.value && !props.columnLabel ? t('general.update') : t('general.save')} ${columnLabel.value}`,
    loadingLabel: `${isEdit.value && !props.columnLabel ? t('general.updating') : t('general.saving')} ${columnLabel.value}`,
  }
})

const filterOption = (input: string, option: { value: UITypes }) => {
  return (
    option.value.toLowerCase().includes(input.toLowerCase()) ||
    (UITypesName[option.value] && UITypesName[option.value].toLowerCase().includes(input.toLowerCase()))
  )
}

const triggerDescriptionEnable = () => {
  if (enableDescription.value) {
    enableDescription.value = false
  } else {
    enableDescription.value = true
    setTimeout(() => {
      descInputEl.value?.focus()
    }, 100)
  }
}

const isFullUpdateAllowed = computed(() => {
  if (isMetaReadOnly.value && !readonlyMetaAllowedTypes.includes(formState.value?.uidt) && !isVirtualCol(formState.value)) {
    return false
  }

  return true
})
</script>

<template>
  <div
    v-if="!warningVisible"
    class="overflow-auto nc-scrollbar-md max-h-[max(80vh,500px)]"
    :class="{
      'bg-white': !props.fromTableExplorer,
      'w-[384px]': !props.embedMode,
      'min-w-[500px]': formState.uidt === UITypes.LinkToAnotherRecord || formState.uidt === UITypes.Links,
      '!w-[600px]': formState.uidt === UITypes.LinkToAnotherRecord || formState.uidt === UITypes.Links,
      'min-w-[422px] !w-full': isLinksOrLTAR(formState.uidt),
      'shadow-lg shadow-gray-300 border-1 border-gray-200 rounded-xl p-5': !embedMode,
    }"
    @keydown="handleEscape"
    @click.stop
  >
    <a-form
      v-model="formState"
      no-style
      name="column-create-or-edit"
      layout="vertical"
      data-testid="add-or-edit-column"
      class="flex flex-col gap-4"
    >
      <a-form-item v-if="isFieldsTab" v-bind="validateInfos.title" class="flex flex-grow">
        <div
          class="flex flex-grow px-2 py-1 items-center rounded-md bg-gray-100 focus:bg-gray-100 outline-none"
          style="outline-style: solid; outline-width: thin"
        >
          <input
            ref="antInput"
            v-model="formState.title"
            :disabled="readOnly || !isFullUpdateAllowed"
            :placeholder="`${$t('objects.field')} ${$t('general.name').toLowerCase()} ${isEdit ? '' : $t('labels.optional')}`"
            class="flex flex-grow nc-fields-input text-sm font-semibold outline-none bg-inherit min-h-6"
            :contenteditable="true"
            @input="formState.userHasChangedTitle = true"
          />
        </div>
      </a-form-item>
      <a-form-item v-if="!props.hideTitle && !isFieldsTab" v-bind="validateInfos.title" :required="false" class="!mb-0">
        <a-input
          ref="antInput"
          v-model:value="formState.title"
          class="nc-column-name-input !rounded-lg"
          :placeholder="`${$t('objects.field')} ${$t('general.name').toLowerCase()} ${isEdit ? '' : $t('labels.optional')}`"
          :disabled="isKanban || readOnly || !isFullUpdateAllowed"
          @input="onAlter(8)"
        />
      </a-form-item>

      <div class="flex items-center gap-1">
        <template v-if="!props.hideType && !formState.uidt">
          <SmartsheetColumnUITypesOptionsWithSearch :options="uiTypesOptions" @selected="onSelectType" />
        </template>

        <a-form-item
          v-else-if="!props.hideType"
          class="flex-1"
          @keydown.up.stop="handleResetHoverEffect"
          @keydown.down.stop="handleResetHoverEffect"
        >
          <a-select
            v-model:value="formState.uidt"
            show-search
            class="nc-column-type-input !rounded-lg"
            :disabled="
              (isEdit && isMetaReadOnly && !readonlyMetaAllowedTypes.includes(formState.uidt)) ||
              isKanban ||
              readOnly ||
              (isEdit && !!onlyNameUpdateOnEditColumns.includes(column?.uidt)) ||
              (isEdit && !isFullUpdateAllowed)
            "
            dropdown-class-name="nc-dropdown-column-type border-1 !rounded-lg border-gray-200"
            :filter-option="filterOption"
            @dropdown-visible-change="onDropdownChange"
            @change="onUidtOrIdTypeChange"
            @dblclick="showDeprecated = !showDeprecated"
          >
            <template #suffixIcon>
              <GeneralIcon icon="arrowDown" class="text-gray-700" />
            </template>
            <a-select-option
              v-for="opt of uiTypesOptions"
              :key="opt.name"
              :value="opt.name"
              :disabled="isMetaReadOnly && !readonlyMetaAllowedTypes.includes(opt.name)"
              v-bind="validateInfos.uidt"
              :class="{
                'ant-select-item-option-active-selected': showHoverEffectOnSelectedType && formState.uidt === opt.name,
              }"
              @mouseover="handleResetHoverEffect"
            >
              <div class="w-full flex gap-2 items-center justify-between" :data-testid="opt.name">
                <div class="flex gap-2 items-center">
                  <component
                    :is="opt.icon"
                    class="w-4 h-4"
                    :class="isMetaReadOnly && !readonlyMetaAllowedTypes.includes(opt.name) ? 'text-gray-300' : 'text-gray-700'"
                  />
                  <div class="flex-1">{{ UITypesName[opt.name] }}</div>
                  <span v-if="opt.deprecated" class="!text-xs !text-gray-300">({{ $t('general.deprecated') }})</span>
                </div>
                <component
                  :is="iconMap.check"
                  v-if="formState.uidt === opt.name"
                  id="nc-selected-item-icon"
                  class="text-primary w-4 h-4"
                />
              </div>
            </a-select-option>
          </a-select>
        </a-form-item>
        <!-- <div v-if="isEeUI && !props.hideType" class="mt-2 cursor-pointer" @click="predictColumnType()">
            <GeneralIcon icon="magic" :class="{ 'nc-animation-pulse': loadMagic }" class="w-full flex mt-2 text-orange-400" />
          </div> -->
      </div>

      <template v-if="!readOnly && formState.uidt">
        <SmartsheetColumnFormulaOptions v-if="formState.uidt === UITypes.Formula" v-model:value="formState" />
        <SmartsheetColumnQrCodeOptions v-if="formState.uidt === UITypes.QrCode" v-model="formState" />
        <SmartsheetColumnBarcodeOptions v-if="formState.uidt === UITypes.Barcode" v-model="formState" />
        <SmartsheetColumnCurrencyOptions v-if="formState.uidt === UITypes.Currency" v-model:value="formState" />
        <SmartsheetColumnLongTextOptions v-if="formState.uidt === UITypes.LongText" v-model:value="formState" />
        <SmartsheetColumnDurationOptions v-if="formState.uidt === UITypes.Duration" v-model:value="formState" />
        <SmartsheetColumnRatingOptions v-if="formState.uidt === UITypes.Rating" v-model:value="formState" />
        <SmartsheetColumnCheckboxOptions v-if="formState.uidt === UITypes.Checkbox" v-model:value="formState" />
        <SmartsheetColumnLookupOptions v-if="formState.uidt === UITypes.Lookup" v-model:value="formState" />
        <SmartsheetColumnDateOptions v-if="formState.uidt === UITypes.Date" v-model:value="formState" />
        <SmartsheetColumnTimeOptions v-if="formState.uidt === UITypes.Time" v-model:value="formState" />
        <SmartsheetColumnNumberOptions v-if="formState.uidt === UITypes.Number" v-model:value="formState" />
        <SmartsheetColumnDecimalOptions v-if="formState.uidt === UITypes.Decimal" v-model:value="formState" />
        <SmartsheetColumnDateTimeOptions
          v-if="[UITypes.DateTime, UITypes.CreatedTime, UITypes.LastModifiedTime].includes(formState.uidt)"
          v-model:value="formState"
        />
        <SmartsheetColumnRollupOptions v-if="formState.uidt === UITypes.Rollup" v-model:value="formState" />
        <SmartsheetColumnLinkedToAnotherRecordOptions
          v-if="formState.uidt === UITypes.LinkToAnotherRecord || formState.uidt === UITypes.Links"
          :key="`${formState.uidt}-${formState.id || 'new'}`"
          v-model:value="formState"
          :is-edit="isEdit"
        />
        <SmartsheetColumnPercentOptions v-if="formState.uidt === UITypes.Percent" v-model:value="formState" />
        <SmartsheetColumnSpecificDBTypeOptions v-if="formState.uidt === UITypes.SpecificDBType" />
        <SmartsheetColumnUserOptions v-if="formState.uidt === UITypes.User" v-model:value="formState" :is-edit="isEdit" />
        <SmartsheetColumnSelectOptions
          v-if="formState.uidt === UITypes.SingleSelect || formState.uidt === UITypes.MultiSelect"
          v-model:value="formState"
          :from-table-explorer="props.fromTableExplorer || false"
        />
        <SmartsheetColumnButtonOptions
          v-if="formState.uidt === UITypes.Button"
          v-model:value="formState"
          :from-table-explorer="props.fromTableExplorer || false"
        />
      </template>
      <template v-if="formState.uidt">
        <div v-if="formState.meta && columnToValidate.includes(formState.uidt)" class="flex items-center gap-1">
          <NcSwitch v-model:checked="formState.meta.validate" size="small" class="nc-switch">
            <div class="text-sm text-gray-800">
              {{
                `${$t('msg.acceptOnlyValid', {
                  type:
                    formState.uidt === UITypes.URL
                      ? `${UITypesName[formState.uidt as UITypes]}s`
                      : `${UITypesName[formState.uidt as UITypes]}s`.toLowerCase(),
                })}`
              }}
            </div>
          </NcSwitch>
        </div>

        <template v-if="!readOnly && isFullUpdateAllowed">
          <div class="nc-column-options-wrapper flex flex-col gap-4">
            <!--
            Default Value for JSON & LongText is not supported in MySQL
            Default Value is Disabled for MSSQL -->
            <LazySmartsheetColumnRichLongTextDefaultValue
              v-if="isTextArea(formState) && formState.meta?.richMode"
              v-model:value="formState"
              v-model:is-visible-default-value-input="isVisibleDefaultValueInput"
            />
            <LazySmartsheetColumnDefaultValue
              v-else-if="
          !isVirtualCol(formState) &&
          !isAttachment(formState) &&
          !isMssql(meta!.source_id) &&
          !(isMysql(meta!.source_id) && (isJSON(formState) || isTextArea(formState))) &&
          !(isDatabricks(meta!.source_id) && formState.unique)
          "
              v-model:value="formState"
              v-model:is-visible-default-value-input="isVisibleDefaultValueInput"
            />

            <div
              v-if="isDatabricks(meta!.source_id) && !formState.cdf && ![UITypes.MultiSelect, UITypes.Checkbox, UITypes.Rating, UITypes.Attachment, UITypes.Lookup, UITypes.Rollup, UITypes.Formula, UITypes.Barcode, UITypes.QrCode, UITypes.CreatedTime, UITypes.LastModifiedTime, UITypes.CreatedBy, UITypes.LastModifiedBy].includes(formState.uidt)"
              class="flex gap-1"
            >
              <NcSwitch v-model:checked="formState.unique" size="small" class="nc-switch">
                <div class="text-sm text-gray-800">Set as Unique</div>
              </NcSwitch>
            </div>
          </div>

          <div
            v-if="!props.hideAdditionalOptions && !isVirtualCol(formState.uidt)&&!(!appInfo.ee && isAttachment(formState)) && (!appInfo.ee || (appInfo.ee && !isXcdbBase(meta!.source_id) && formState.uidt === UITypes.SpecificDBType))"
            class="text-xs text-gray-400 flex items-center justify-end"
          >
            <div
              class="nc-more-options flex items-center gap-1 cursor-pointer select-none"
              @click="advancedOptions = !advancedOptions"
            >
              {{ advancedOptions ? $t('general.hideAll') : $t('general.showMore') }}
              <component :is="advancedOptions ? MdiMinusIcon : MdiPlusIcon" />
            </div>
          </div>

          <Transition name="layout" mode="out-in">
            <div v-if="advancedOptions" class="overflow-hidden">
              <LazySmartsheetColumnAttachmentOptions v-if="appInfo.ee && isAttachment(formState)" v-model:value="formState" />

              <LazySmartsheetColumnAdvancedOptions
                v-if="formState.uidt !== UITypes.Attachment"
                v-model:value="formState"
                :advanced-db-options="advancedOptions || formState.uidt === UITypes.SpecificDBType"
              />
            </div>
          </Transition>
        </template>

        <a-form-item v-if="enableDescription">
          <div class="flex gap-3 text-gray-800 h-7 mb-1 items-center justify-between">
            <span class="text-[13px]">
              {{ $t('labels.description') }}
            </span>

            <NcButton type="text" class="!h-6 !w-5" size="xsmall" @click="removeDescription">
              <GeneralIcon icon="delete" class="text-gray-700 w-3.5 h-3.5" />
            </NcButton>
          </div>

          <a-textarea
            ref="descInputEl"
            v-model:value="formState.description"
            :class="{
              '!min-h-[200px]': fromTableExplorer,
              'h-[150px] !min-h-[100px]': !fromTableExplorer,
            }"
            class="nc-input-sm nc-input-text-area nc-input-shadow !text-gray-800 px-3 !max-h-[300px]"
            hide-details
            data-testid="create-field-description-input"
            :placeholder="$t('msg.info.enterFieldDescription')"
          />
        </a-form-item>

        <template v-if="props.fromTableExplorer">
          <a-form-item>
            <NcButton v-if="!enableDescription" size="small" type="text" @click.stop="triggerDescriptionEnable">
              <div class="flex !text-gray-700 items-center gap-2">
                <GeneralIcon icon="plus" class="h-4 w-4" />

                <span class="first-letter:capitalize">
                  {{ $t('labels.addDescription').toLowerCase() }}
                </span>
              </div>
            </NcButton>
          </a-form-item>
        </template>
        <template v-else>
          <div class="flex items-center justify-between gap-2">
            <NcButton v-if="!enableDescription" size="small" type="text" @click.stop="triggerDescriptionEnable">
              <div class="flex !text-gray-700 items-center gap-2">
                <GeneralIcon icon="plus" class="h-4 w-4" />

                <span class="first-letter:capitalize">
                  {{ $t('labels.addDescription').toLowerCase() }}
                </span>
              </div>
            </NcButton>
            <div v-else></div>

            <a-form-item>
              <div
                class="flex gap-x-2 justify-end"
                :class="{
                  'justify-end': !props.embedMode,
                }"
              >
                <!-- Cancel -->
                <NcButton size="small" html-type="button" type="secondary" @click="emit('cancel')">
                  {{ $t('general.cancel') }}
                </NcButton>

                <!-- Save -->
                <NcButton
                  html-type="submit"
                  type="primary"
                  :loading="saving"
                  :disabled="!formState.uidt || disableSubmitBtn"
                  size="small"
                  :label="submitBtnLabel.label"
                  :loading-label="submitBtnLabel.loadingLabel"
                  data-testid="nc-field-modal-submit-btn"
                  @click.prevent="onSubmit"
                >
                  {{ submitBtnLabel.label }}
                  <template #loading>
                    {{ submitBtnLabel.loadingLabel }}
                  </template>
                </NcButton>
              </div>
            </a-form-item>
          </div>
        </template>
      </template>
    </a-form>
  </div>
</template>

<style lang="scss">
.nc-dropdown-column-type {
  .ant-select-item-option-active-selected {
    @apply !bg-gray-100;
  }
}
</style>

<style lang="scss" scoped>
.nc-input-text-area {
  @apply !text-gray-800;
  padding-block: 8px !important;
}

.nc-fields-input {
  &::placeholder {
    @apply font-normal;
  }
}

.nc-column-name-input,
:deep(.nc-formula-input),
:deep(.ant-form-item-control-input-content > input.ant-input) {
  &:not(:hover):not(:focus) {
    box-shadow: 0px 0px 4px 0px rgba(0, 0, 0, 0.08);
  }

  &:hover:not(:focus) {
    @apply border-gray-300;
    box-shadow: 0px 0px 4px 0px rgba(0, 0, 0, 0.24);
  }
}

:deep(.nc-color-picker-dropdown-trigger),
:deep(.nc-default-value-wrapper) {
  @apply transition-all duration-0.3s;

  &:not(:hover):not(:focus-within):not(.shadow-selected) {
    box-shadow: 0px 0px 4px 0px rgba(0, 0, 0, 0.08);
  }

  &:hover:not(:focus-within):not(.shadow-selected) {
    box-shadow: 0px 0px 4px 0px rgba(0, 0, 0, 0.24);
  }
}

:deep(.ant-radio-group .ant-radio-wrapper) {
  @apply transition-all duration-0.3s;

  &.ant-radio-wrapper-checked:not(.ant-radio-wrapper-disabled):focus-within {
    @apply shadow-selected;
  }

  &.ant-radio-wrapper-disabled {
    @apply pointer-events-none !bg-[#f5f5f5];
    box-shadow: none;

    &:hover {
      box-shadow: none;
    }
  }

  &:not(.ant-radio-wrapper-disabled):not(:hover):not(:focus-within):not(.shadow-selected) {
    box-shadow: 0px 0px 4px 0px rgba(0, 0, 0, 0.08);
  }

  &:hover:not(:focus-within):not(.ant-radio-wrapper-disabled) {
    box-shadow: 0px 0px 4px 0px rgba(0, 0, 0, 0.24);
  }
}

:deep(.ant-select) {
  &:not(.ant-select-disabled):not(:hover):not(.ant-select-focused) .ant-select-selector,
  &:not(.ant-select-disabled):hover.ant-select-disabled .ant-select-selector {
    box-shadow: 0px 0px 4px 0px rgba(0, 0, 0, 0.08);
  }

  &:hover:not(.ant-select-focused):not(.ant-select-disabled) .ant-select-selector {
    @apply border-gray-300;
    box-shadow: 0px 0px 4px 0px rgba(0, 0, 0, 0.24);
  }

  &.ant-select-disabled .ant-select-selector {
    box-shadow: none;
  }
}

:deep(.ant-form-item-label > label) {
  @apply !text-small !leading-[18px] mb-2 text-gray-700 flex;

  &.ant-form-item-required:not(.ant-form-item-required-mark-optional)::before {
    @apply content-[''] m-0;
  }
}

:deep(.ant-form-item-label) {
  @apply !pb-0 text-small leading-[18px] text-gray-700;
}

:deep(.ant-form-item-control-input) {
  @apply !min-h-min;
}

:deep(.ant-form-item) {
  @apply !mb-0;
}

:deep(.ant-select-selection-item) {
  @apply flex items-center;
}

:deep(.ant-form-item-explain) {
  @apply !text-[10px] leading-normal;

  & > div:first-child {
    @apply mt-0.5;
  }
}

:deep(.ant-form-item-explain) {
  @apply !min-h-[15px];
}

:deep(.ant-alert) {
  @apply !rounded-lg !bg-transparent !border-none !p-0;

  .ant-alert-message {
    @apply text-sm text-gray-800 font-weight-600;
  }

  .ant-alert-description {
    @apply text-small text-gray-500 font-weight-500;
  }
}

:deep(.ant-select) {
  .ant-select-selector {
    @apply !rounded-lg;
  }
}

:deep(input::placeholder),
:deep(textarea::placeholder) {
  @apply text-gray-500;
}

.nc-column-options-wrapper {
  &:empty {
    @apply hidden;
  }
}
</style>
