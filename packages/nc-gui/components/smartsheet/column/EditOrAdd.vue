<script lang="ts" setup>
import type { ColumnReqType, ColumnType } from 'nocodb-sdk'
import { UITypes, isLinksOrLTAR, isVirtualCol } from 'nocodb-sdk'
import {
  IsFormInj,
  IsKanbanInj,
  MetaInj,
  ReloadViewDataHookInj,
  computed,
  inject,
  isJSON,
  isTextArea,
  message,
  onMounted,
  ref,
  uiTypes,
  useBase,
  useColumnCreateStoreOrThrow,
  useGlobal,
  useI18n,
  useMetas,
  useNuxtApp,
  watchEffect,
} from '#imports'
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
  readonly?: boolean
}>()

const emit = defineEmits(['submit', 'cancel', 'mounted', 'add', 'update'])

const { formState, generateNewColumnMeta, addOrUpdate, onAlter, onUidtOrIdTypeChange, validateInfos, isEdit } =
  useColumnCreateStoreOrThrow()

const { getMeta } = useMetas()

const { t } = useI18n()

const columnLabel = computed(() => props.columnLabel || t('objects.field'))

const { $e } = useNuxtApp()

const { appInfo } = useGlobal()

const { betaFeatureToggleState } = useBetaFeatureToggle()

const { openedViewsTab } = storeToRefs(useViewsStore())

const { predictColumnType: _predictColumnType } = useNocoEe()

const meta = inject(MetaInj, ref())

const isForm = inject(IsFormInj, ref(false))

const isKanban = inject(IsKanbanInj, ref(false))

const readOnly = computed(() => props.readonly)

const { isMysql, isMssql, isXcdbBase } = useBase()

const reloadDataTrigger = inject(ReloadViewDataHookInj)

const advancedOptions = ref(false)

const mounted = ref(false)

const columnToValidate = [UITypes.Email, UITypes.URL, UITypes.PhoneNumber]

const onlyNameUpdateOnEditColumns = [UITypes.LinkToAnotherRecord, UITypes.Lookup, UITypes.Rollup, UITypes.Links]

const geoDataToggleCondition = (t: { name: UITypes }) => {
  if (!appInfo.value.ee) return true

  return betaFeatureToggleState.show ? betaFeatureToggleState.show : !t.name.includes(UITypes.GeoData)
}

const showDeprecated = ref(false)

const uiTypesOptions = computed<typeof uiTypes>(() => {
  return [
    ...uiTypes
      .filter((t) => geoDataToggleCondition(t) && (!isEdit.value || !t.virtual) && (!t.deprecated || showDeprecated.value))
      .filter((t) => !(t.name === UITypes.SpecificDBType && isXcdbBase(meta.value?.source_id))),
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
})

const reloadMetaAndData = async () => {
  await getMeta(meta.value?.id as string, true)

  if (!isKanban.value) {
    reloadDataTrigger?.trigger()
  }
}

const saving = ref(false)

async function onSubmit() {
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

// focus and select the column name field
const antInput = ref()
watchEffect(() => {
  if (antInput.value && formState.value && !readOnly.value) {
    // todo: replace setTimeout
    setTimeout(() => {
      // focus and select input only if active element is not an input or textarea
      if (document.activeElement === document.body || document.activeElement === null) {
        antInput.value?.focus()
        antInput.value?.select()
      }
    }, 300)
  }
  advancedOptions.value = false
})

onMounted(() => {
  if (!isEdit.value) {
    generateNewColumnMeta()
  } else {
    if (formState.value.pk) {
      message.info(t('msg.info.editingPKnotSupported'))
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
      onUidtOrIdTypeChange()
      formState.value = {
        ...formState.value,
        colOptions: {
          ...colOptions,
        },
      }
    }
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
  })
})

const handleEscape = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') emit('cancel')
}

const isFieldsTab = computed(() => {
  return openedViewsTab.value === 'field'
})

if (props.fromTableExplorer) {
  watch(
    formState,
    () => {
      if (mounted.value) emit('update', formState.value)
    },
    { deep: true },
  )
}
</script>

<template>
  <div
    class="overflow-auto"
    :class="{
      'bg-white': !props.fromTableExplorer,
      'w-[400px]': !props.embedMode,
      '!w-146': isTextArea(formState) && formState.meta.richMode,
      '!w-[600px]': formState.uidt === UITypes.Formula && !props.embedMode,
      '!w-[500px]': formState.uidt === UITypes.Attachment && !props.embedMode && !appInfo.ee,
      'shadow-lg border-1 border-gray-100 shadow-gray-300 rounded-xl p-6': !embedMode,
    }"
    @keydown="handleEscape"
    @click.stop
  >
    <a-form v-model="formState" no-style name="column-create-or-edit" layout="vertical" data-testid="add-or-edit-column">
      <div class="flex flex-col gap-2">
        <a-form-item v-if="isFieldsTab" v-bind="validateInfos.title" class="flex flex-grow">
          <div
            class="flex flex-grow px-2 py-1 items-center rounded-lg bg-gray-100 focus:bg-gray-100 outline-none"
            style="outline-style: solid; outline-width: thin"
          >
            <input
              ref="antInput"
              v-model="formState.title"
              :disabled="readOnly"
              class="flex flex-grow nc-fields-input text-lg font-bold outline-none bg-inherit"
              :contenteditable="true"
            />
          </div>
        </a-form-item>
        <a-form-item
          v-if="!props.hideTitle && !isFieldsTab"
          :label="`${columnLabel} ${$t('general.name')}`"
          v-bind="validateInfos.title"
          :required="false"
        >
          <a-input
            ref="antInput"
            v-model:value="formState.title"
            class="nc-column-name-input !rounded !mt-1"
            :disabled="isKanban || readOnly"
            @input="onAlter(8)"
          />
        </a-form-item>

        <div class="flex items-center gap-1">
          <a-form-item
            v-if="!props.hideType && !(isEdit && !!onlyNameUpdateOnEditColumns.find((col) => col === formState.uidt))"
            class="flex-1"
            :label="`${columnLabel} ${$t('general.type')}`"
          >
            <div class="h-1 w-full"></div>
            <a-select
              v-model:value="formState.uidt"
              show-search
              class="nc-column-type-input !rounded"
              :disabled="isKanban || readOnly"
              dropdown-class-name="nc-dropdown-column-type "
              @change="onUidtOrIdTypeChange"
              @dblclick="showDeprecated = !showDeprecated"
            >
              <template #suffixIcon>
                <GeneralIcon icon="arrowDown" class="text-gray-700" />
              </template>
              <a-select-option v-for="opt of uiTypesOptions" :key="opt.name" :value="opt.name" v-bind="validateInfos.uidt">
                <div class="flex gap-1 items-center">
                  <component :is="opt.icon" class="text-gray-700 mx-1" />
                  {{ opt.name }}
                  <span v-if="opt.deprecated" class="!text-xs !text-gray-300">({{ $t('general.deprecated') }})</span>
                </div>
              </a-select-option>
            </a-select>
          </a-form-item>
          <!-- <div v-if="isEeUI && !props.hideType" class="mt-2 cursor-pointer" @click="predictColumnType()">
            <GeneralIcon icon="magic" :class="{ 'nc-animation-pulse': loadMagic }" class="w-full flex mt-2 text-orange-400" />
          </div> -->
        </div>

        <template v-if="!readOnly">
          <LazySmartsheetColumnFormulaOptions v-if="formState.uidt === UITypes.Formula" v-model:value="formState" />
          <LazySmartsheetColumnQrCodeOptions v-if="formState.uidt === UITypes.QrCode" v-model="formState" />
          <LazySmartsheetColumnBarcodeOptions v-if="formState.uidt === UITypes.Barcode" v-model="formState" />
          <LazySmartsheetColumnCurrencyOptions v-if="formState.uidt === UITypes.Currency" v-model:value="formState" />
          <LazySmartsheetColumnLongTextOptions v-if="formState.uidt === UITypes.LongText" v-model:value="formState" />
          <LazySmartsheetColumnDurationOptions v-if="formState.uidt === UITypes.Duration" v-model:value="formState" />
          <LazySmartsheetColumnRatingOptions v-if="formState.uidt === UITypes.Rating" v-model:value="formState" />
          <LazySmartsheetColumnCheckboxOptions v-if="formState.uidt === UITypes.Checkbox" v-model:value="formState" />
          <LazySmartsheetColumnLookupOptions v-if="formState.uidt === UITypes.Lookup" v-model:value="formState" />
          <LazySmartsheetColumnDateOptions v-if="formState.uidt === UITypes.Date" v-model:value="formState" />
          <LazySmartsheetColumnDecimalOptions v-if="formState.uidt === UITypes.Decimal" v-model:value="formState" />
          <LazySmartsheetColumnDateTimeOptions v-if="formState.uidt === UITypes.DateTime" v-model:value="formState" />
          <LazySmartsheetColumnRollupOptions v-if="formState.uidt === UITypes.Rollup" v-model:value="formState" />
          <LazySmartsheetColumnLinkedToAnotherRecordOptions
            v-if="!isEdit && (formState.uidt === UITypes.LinkToAnotherRecord || formState.uidt === UITypes.Links)"
            :key="formState.uidt"
            v-model:value="formState"
          />
          <LazySmartsheetColumnLinkOptions v-if="isEdit && formState.uidt === UITypes.Links" v-model:value="formState" />
          <LazySmartsheetColumnPercentOptions v-if="formState.uidt === UITypes.Percent" v-model:value="formState" />
          <LazySmartsheetColumnSpecificDBTypeOptions v-if="formState.uidt === UITypes.SpecificDBType" />
          <SmartsheetColumnSelectOptions
            v-if="formState.uidt === UITypes.SingleSelect || formState.uidt === UITypes.MultiSelect"
            v-model:value="formState"
          />
        </template>
      </div>
      <a-checkbox
        v-if="formState.meta && columnToValidate.includes(formState.uidt)"
        v-model:checked="formState.meta.validate"
        class="ml-1 mb-1"
      >
        <span class="text-[10px] text-gray-600">
          {{ `${$t('msg.acceptOnlyValid')} ${formState.uidt}` }}
        </span>
      </a-checkbox>
      <template v-if="!readOnly">
        <div class="!my-3">
          <!--
            Default Value for JSON & LongText is not supported in MySQL
            Default Value is Disabled for MSSQL -->
          <LazySmartsheetColumnRichLongTextDefaultValue
            v-if="isTextArea(formState) && formState.meta.richMode"
            v-model:value="formState"
          />
          <LazySmartsheetColumnDefaultValue
            v-else-if="
          !isVirtualCol(formState) &&
          !isAttachment(formState) &&
          !isMssql(meta!.source_id) &&
          !(isMysql(meta!.source_id) && (isJSON(formState) || isTextArea(formState)))
          "
            v-model:value="formState"
          />
        </div>

        <div
          v-if="!props.hideAdditionalOptions && !isVirtualCol(formState.uidt) && (!appInfo.ee || (appInfo.ee && !isXcdbBase(meta!.source_id) && formState.uidt === UITypes.SpecificDBType))"
          class="text-xs cursor-pointer text-gray-400 nc-more-options mb-1 mt-4 flex items-center gap-1 justify-end"
          @click="advancedOptions = !advancedOptions"
        >
          {{ advancedOptions ? $t('general.hideAll') : $t('general.showMore') }}
          <component :is="advancedOptions ? MdiMinusIcon : MdiPlusIcon" />
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

      <template v-if="props.fromTableExplorer">
        <a-form-item></a-form-item>
      </template>
      <template v-else>
        <a-form-item>
          <div
            class="flex gap-x-2 justify-between"
            :class="{
              'mt-6': props.hideAdditionalOptions,
              'mt-2': !props.hideAdditionalOptions,
              'justify-end': !props.embedMode,
            }"
          >
            <!-- Cancel -->
            <NcButton size="small" class="w-full" html-type="button" type="secondary" @click="emit('cancel')">
              {{ $t('general.cancel') }}
            </NcButton>

            <!-- Save -->
            <NcButton
              class="w-full"
              html-type="submit"
              type="primary"
              :loading="saving"
              size="small"
              :label="`${$t('general.save')} ${columnLabel}`"
              :loading-label="`${$t('general.saving')} ${columnLabel}`"
              @click.prevent="onSubmit"
            >
              {{ $t('general.save') }} {{ columnLabel }}
              <template #loading> {{ $t('general.saving') }} {{ columnLabel }} </template>
            </NcButton>
          </div>
        </a-form-item>
      </template>
    </a-form>
  </div>
</template>

<style lang="scss">
.nc-column-type-input {
  .ant-select-selector {
    @apply !rounded;
  }
}
</style>

<style scoped>
:deep(.ant-form-item-label > label) {
  @apply !text-xs;
}

:deep(.ant-form-item-label) {
  @apply !pb-0;
}

:deep(.ant-form-item-control-input) {
  @apply !min-h-min;
}

:deep(.ant-form-item) {
  @apply !mb-1;
}

:deep(.ant-select-selection-item) {
  @apply flex items-center;
}

:deep(.ant-form-item-explain-error) {
  @apply !text-[10px];
}

:deep(.ant-form-item-explain) {
  @apply !min-h-[15px];
}
</style>
