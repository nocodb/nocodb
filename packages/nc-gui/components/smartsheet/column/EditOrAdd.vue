<script lang="ts" setup>
import { AiWizardTabsType, type PredictedFieldType } from '#imports'
import { type ColumnReqType, type ColumnType } from 'nocodb-sdk'
import {
  ButtonActionsType,
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
  isAiMode,
  defaultFormState,
  fromTableExplorer,
} = useColumnCreateStoreOrThrow()

const { aiIntegrationAvailable, aiLoading, aiError } = useNocoAi()

const {
  aiMode: aiAutoSuggestMode,
  aiModeStep: aiAutoSuggestModeStep,
  predicted,
  activeTabPredictedFields,
  selected,
  activeTabSelectedFields,
  calledFunction,
  prompt,
  oldPrompt,
  isPromtAlreadyGenerated,
  maxSelectionCount,
  activeAiTab,
  isPredictFromPromptLoading,
  isFormulaPredictionMode,
  activeSelectedField,
  failedToSaveFields,
  onInit,
  toggleAiMode: _toggleAiMode,
  disableAiMode: _disableAiMode,
  predictMore,
  predictRefresh,
  predictFromPrompt,
  handleRefreshOnError,
  saveFields,
  onToggleTag: _onToggleTag,
} = usePredictFields(ref(false))

const { clone } = useUndoRedo()

onBeforeMount(() => {
  if (props.fromTableExplorer || isEdit.value) return

  onInit()
})

const editDescription = toRef(props, 'editDescription')

const { getMeta } = useMetas()

const { t } = useI18n()

const { isMetaReadOnly } = useRoles()

const { eventBus } = useSmartsheetStoreOrThrow()

const columnLabel = computed(() => props.columnLabel || t('objects.field'))

const { $e } = useNuxtApp()

const { appInfo } = useGlobal()

const { isFeatureEnabled } = useBetaFeatureToggle()

const workspaceStore = useWorkspace()

const { openedViewsTab } = storeToRefs(useViewsStore())

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

const uiFilters = (t: UiTypesType) => {
  const systemFiledNotEdited = !isSystemField(t) || formState.value.uidt === t.name || !isEdit.value
  const geoDataToggle = geoDataToggleCondition(t) && (!isEdit.value || !t.virtual || t.name === formState.value.uidt)
  const specificDBType = t.name === UITypes.SpecificDBType && isXcdbBase(meta.value?.source_id)
  const showDeprecatedField = !t.deprecated || showDeprecated.value

  return systemFiledNotEdited && geoDataToggle && !specificDBType && showDeprecatedField
}

const extraIcons = ref<Record<string, string>>({})

const predictedFieldType = ref<UITypes | null>(null)

// const lastPredictedAt = ref<number>(0)

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

  // if prediction is available, move it to the top
  if (predictedFieldType.value) {
    types.sort((a, b) => {
      if (a.name === predictedFieldType.value) return -1
      if (b.name === predictedFieldType.value) return 1

      return 0
    })

    if (!(predictedFieldType.value in extraIcons.value)) {
      extraIcons.value[predictedFieldType.value] = 'magic'
    }
  }

  return types
})

const onSelectType = (uidt: UITypes | typeof AIButton, fromSearchList = false) => {
  let preload

  if (fromSearchList && !isEdit.value && aiAutoSuggestMode.value) {
    onInit()
  }

  if (uidt === AIButton) {
    formState.value.uidt = UITypes.Button
    preload = {
      type: ButtonActionsType.Ai,
    }
  } else {
    formState.value.uidt = uidt
  }
  onUidtOrIdTypeChange(preload)
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
  let saved
  saving.value = true
  if (aiAutoSuggestMode.value) {
    saved = await saveFields(reloadMetaAndData)

    if (!saved && !ncIsArrayIncludes(activeTabSelectedFields.value, activeSelectedField.value, 'ai_temp_id')) {
      onSelectedTagClick()
    }
  } else {
    saved = await addOrUpdate(reloadMetaAndData, props.columnPosition)
  }
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

watch(
  formState,
  () => {
    if (mounted.value) {
      if (props.fromTableExplorer) {
        emit('update', formState.value)
      } else if (activeSelectedField.value === formState.value.ai_temp_id) {
        const selectedField = predicted.value.find((f) => f.ai_temp_id === activeSelectedField.value)

        if (!selectedField) return

        selectedField.formState = clone(formState.value)
      }
    }
  },
  { deep: true },
)

const submitBtnLabel = computed(() => {
  const aiAutoSuggestModeLabel = `${t('general.create')} ${
    activeTabSelectedFields.value.length > 1
      ? activeTabSelectedFields.value.length + ' ' + t('objects.fields')
      : t('objects.field')
  }`
  return {
    label: aiAutoSuggestMode.value
      ? aiAutoSuggestModeLabel
      : `${isEdit.value && !props.columnLabel ? t('general.update') : t('general.save')} ${columnLabel.value}`,
    loadingLabel: aiAutoSuggestMode.value
      ? aiAutoSuggestModeLabel
      : `${isEdit.value && !props.columnLabel ? t('general.updating') : t('general.saving')} ${columnLabel.value}`,
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

const onPredictFieldType = async () => {
  /*
  ### disable for now as this is only action triggered without user interaction -- need to be discussed

  if (readOnly.value || (lastPredictedAt.value > 0 && Date.now() - lastPredictedAt.value < 5000)) return

  if (formState.value.title.length > 4) {
    lastPredictedAt.value = Date.now()

    const res = await predictFieldType(formState.value.title, meta.value?.base_id)
    if (res) {
      extraIcons.value = {}
      predictedFieldType.value = res
    }
  }
  */
}

const debouncedOnPredictFieldType = useDebounceFn(onPredictFieldType, 500)

const handleNavigateToIntegrations = () => {
  emit('cancel')

  workspaceStore.navigateToIntegrations(undefined, undefined, {
    categories: 'ai',
  })
}

const toggleAiMode = () => {
  formState.value = {
    ...defaultFormState,
  }
  _toggleAiMode(undefined, true)
}

const disableAiMode = () => {
  activeSelectedField.value = null
  formState.value = {
    ...defaultFormState,
  }
  enableDescription.value = false

  _disableAiMode()
}

function onSelectedTagClick(field: PredictedFieldType | undefined = undefined) {
  if (!field && activeTabSelectedFields.value.length) {
    field = activeTabSelectedFields.value[activeTabSelectedFields.value.length - 1]
  }

  if (!field) {
    activeSelectedField.value = null
    formState.value = {
      title: '',
      description: '',
    }
    enableDescription.value = false

    return
  }

  activeSelectedField.value = field.ai_temp_id
  formState.value.uidt = field.formState?.uidt || field.type
  enableDescription.value = !!field.formState?.description

  onUidtOrIdTypeChange(field.formState)
}

const onToggleTag = (field: PredictedFieldType, select = false) => {
  if (select) {
    _onToggleTag(field)
    onSelectedTagClick(field.selected ? field : undefined)
  } else {
    onSelectedTagClick(field)
  }
}

const isAiButtonSelectOption = (uidt: string) => {
  return uidt === UITypes.Button && formState.value.uidt === UITypes.Button && formState.value.type === ButtonActionsType.Ai
}

const aiPromptInputRef = ref<HTMLElement>()

watch(activeAiTab, (newValue) => {
  if (newValue === AiWizardTabsType.PROMPT) {
    nextTick(() => {
      aiPromptInputRef.value?.focus()
    })
  }
  onSelectedTagClick()
})
</script>

<template>
  <div
    v-if="!warningVisible"
    class="overflow-auto nc-scrollbar-md"
    :class="{
      'bg-white max-h-[max(80vh,500px)]': !props.fromTableExplorer,
      'w-[416px]': !props.embedMode,
      'min-w-[500px]': formState.uidt === UITypes.LinkToAnotherRecord || formState.uidt === UITypes.Links,
      '!w-[600px]': formState.uidt === UITypes.LinkToAnotherRecord || formState.uidt === UITypes.Links,
      'min-w-[422px] !w-full': isLinksOrLTAR(formState.uidt),
      'shadow-lg shadow-gray-300 border-1 border-gray-200 rounded-xl p-5': !embedMode,
      'nc-ai-mode !pb-0': isAiMode,
      'min-w-[446px]': formState.uidt === UITypes.AI,
      '!pb-0': formState.uidt === UITypes.Formula,
      'h-full': props.fromTableExplorer,
      '!bg-nc-bg-gray-extralight': aiAutoSuggestMode && formState.uidt && !props.fromTableExplorer,
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
      class="flex flex-col gap-4 h-full"
    >
      <div
        v-if="!isEdit && !props.fromTableExplorer"
        class="flex flex-col gap-4"
        :class="{
          'bg-white -mx-5 -mt-5 px-5 pt-5': aiAutoSuggestMode,
          'pb-5 border-b-1 border-b-nc-border-gray-medium': aiAutoSuggestMode && formState.uidt,
        }"
      >
        <div class="flex items-center gap-3">
          <div class="flex-1 text-base font-bold text-nc-content-gray">New Field</div>
          <div
            :class="{
              'cursor-wait': aiLoading,
            }"
          >
            <NcButton
              type="text"
              size="small"
              class="-my-1 !text-nc-content-purple-dark hover:text-nc-content-purple-dark"
              :class="{
                '!pointer-events-none !cursor-not-allowed': aiLoading,
                '!bg-nc-bg-purple-dark hover:!bg-gray-100': aiAutoSuggestMode,
              }"
              @click.stop="aiAutoSuggestMode ? disableAiMode() : toggleAiMode()"
            >
              <div class="flex items-center justify-center">
                <GeneralIcon icon="ncAutoAwesome" />
                <span
                  class="overflow-hidden trasition-all ease duration-200"
                  :class="{ 'w-[0px] invisible': aiAutoSuggestMode, 'ml-1 w-[78px]': !aiAutoSuggestMode }"
                >
                  Use NocoAI
                </span>
              </div>
            </NcButton>
          </div>
        </div>
        <template v-if="aiAutoSuggestMode">
          <div v-if="!aiIntegrationAvailable" class="flex items-center gap-3 px-5 pt-2.5 pb-4.5">
            <GeneralIcon icon="alertTriangleSolid" class="!text-nc-content-orange-medium w-4 h-4" />
            <div class="text-sm text-nc-content-gray-subtle flex-1">{{ $t('title.noAiIntegrationAvailable') }}</div>
          </div>

          <AiWizardTabs v-else v-model:active-tab="activeAiTab" class="!-mx-5">
            <template #AutoSuggestedContent>
              <div class="px-5 pt-4 pb-2">
                <div v-if="aiError" class="w-full flex items-center gap-3">
                  <GeneralIcon icon="ncInfoSolid" class="flex-none !text-nc-content-red-dark w-4 h-4" />

                  <NcTooltip class="truncate flex-1 text-sm text-nc-content-gray-subtle" show-on-truncate-only>
                    <template #title>
                      {{ aiError }}
                    </template>
                    {{ aiError }}
                  </NcTooltip>

                  <NcButton size="small" type="text" class="!text-nc-content-brand" @click.stop="handleRefreshOnError">
                    {{ $t('general.refresh') }}
                  </NcButton>
                </div>

                <div v-else-if="aiAutoSuggestModeStep === 'init'">
                  <div class="text-nc-content-purple-light text-sm h-7 flex items-center gap-2">
                    <GeneralLoader size="regular" class="!text-nc-content-purple-dark" />

                    <!-- Todo: add table name  -->
                    <div class="nc-animate-dots">Auto suggesting fields for {{ meta?.title }}</div>
                  </div>
                </div>
                <div v-else-if="aiAutoSuggestModeStep === 'pick'" class="flex gap-3 items-start">
                  <div class="flex-1 flex gap-2 flex-wrap">
                    <template v-if="activeTabPredictedFields.length">
                      <template v-for="t of activeTabPredictedFields" :key="t.title">
                        <NcTooltip :disabled="selected.length < maxSelectionCount || t.selected">
                          <template #title>
                            <div class="w-[150px]">You can only select {{ maxSelectionCount }} fields to create at a time.</div>
                          </template>

                          <a-tag
                            class="nc-ai-suggested-tag"
                            :class="{
                              'nc-disabled': !t.selected && selected.length >= maxSelectionCount,
                              'nc-selected': t.selected,
                              'nc-bg-selected': activeSelectedField === t.ai_temp_id,
                            }"
                            :disabled="selected.length >= maxSelectionCount"
                            @click="onToggleTag(t)"
                          >
                            <div class="flex flex-row items-center gap-2 py-[3px] text-small leading-[18px]">
                              <NcCheckbox :checked="t.selected" theme="ai" class="!-mr-0.5" @click.stop="onToggleTag(t, true)" />

                              <component
                                :is="getUIDTIcon(isFormulaPredictionMode ? UITypes.Formula : t.type)"
                                v-if="isFormulaPredictionMode || t?.type"
                                class="flex-none w-3.5 h-3.5"
                                :class="{
                                  'opacity-60': selected.length >= maxSelectionCount,
                                }"
                              />

                              <div>{{ t.formState?.title || t.title }}</div>
                            </div>
                          </a-tag>
                        </NcTooltip>
                      </template>
                    </template>
                    <div v-else class="text-nc-content-gray-subtle2">{{ $t('labels.noData') }}</div>
                  </div>
                  <div class="flex items-center gap-1">
                    <NcTooltip title="Suggest more" placement="top">
                      <NcButton
                        size="xs"
                        class="!px-1"
                        type="text"
                        theme="ai"
                        :loading="aiLoading && calledFunction === 'predictMore'"
                        icon-only
                        @click="predictMore"
                      >
                        <template #icon>
                          <GeneralIcon icon="ncPlusAi" class="!text-current" />
                        </template>
                      </NcButton>
                    </NcTooltip>
                    <NcTooltip title="Re-suggest" placement="top">
                      <NcButton
                        size="xs"
                        class="!px-1"
                        type="text"
                        theme="ai"
                        :loading="aiLoading && calledFunction === 'predictRefresh'"
                        @click="predictRefresh"
                      >
                        <template #loadingIcon>
                          <!-- eslint-disable vue/no-lone-template -->
                          <template></template>
                        </template>
                        <GeneralIcon
                          icon="refresh"
                          class="!text-current"
                          :class="{
                            'animate-infinite animate-spin': aiLoading && calledFunction === 'predictRefresh',
                          }"
                        />
                      </NcButton>
                    </NcTooltip>
                  </div>
                </div>
              </div>
            </template>
            <template #PromptContent>
              <div class="px-5 pt-4 pb-2 flex flex-col gap-4">
                <div class="relative">
                  <a-textarea
                    ref="aiPromptInputRef"
                    v-model:value="prompt"
                    placeholder="Enter your prompt to get field suggestions.."
                    class="nc-ai-input nc-input-shadow !px-3 !pt-2 !pb-3 !text-sm !min-h-[68px] !rounded-lg"
                    @keydown.enter.stop
                  >
                  </a-textarea>

                  <NcButton
                    size="xs"
                    type="primary"
                    theme="ai"
                    class="!px-1 !absolute bottom-2 right-2"
                    :disabled="
                      !prompt.trim() || isPredictFromPromptLoading || (!!prompt.trim() && prompt.trim() === oldPrompt.trim())
                    "
                    :loading="isPredictFromPromptLoading"
                    @click="predictFromPrompt"
                    icon-only
                  >
                    <template #loadingIcon>
                      <GeneralLoader class="!text-purple-700" size="medium" />
                    </template>
                    <template #icon>
                      <GeneralIcon icon="send" class="flex-none h-4 w-4" />
                    </template>
                  </NcButton>
                </div>

                <div v-if="aiError" class="w-full flex items-center gap-3">
                  <GeneralIcon icon="ncInfoSolid" class="flex-none !text-nc-content-red-dark w-4 h-4" />

                  <NcTooltip class="truncate flex-1 text-sm text-nc-content-gray-subtle" show-on-truncate-only>
                    <template #title>
                      {{ aiError }}
                    </template>
                    {{ aiError }}
                  </NcTooltip>

                  <NcButton size="small" type="text" class="!text-nc-content-brand" @click.stop="handleRefreshOnError">
                    {{ $t('general.refresh') }}
                  </NcButton>
                </div>

                <div v-else-if="isPromtAlreadyGenerated" class="flex flex-col gap-3">
                  <div class="text-nc-content-purple-dark font-semibold text-xs">Generated Field(s)</div>
                  <div class="flex gap-2 flex-wrap">
                    <template v-if="activeTabPredictedFields.length">
                      <template v-for="t of activeTabPredictedFields" :key="t.title">
                        <NcTooltip :disabled="selected.length < maxSelectionCount || t.selected">
                          <template #title>
                            <div class="w-[150px]">You can only select {{ maxSelectionCount }} fields to create at a time.</div>
                          </template>

                          <a-tag
                            class="nc-ai-suggested-tag"
                            :class="{
                              'nc-disabled': !t.selected && selected.length >= maxSelectionCount,
                              'nc-selected': t.selected,
                              'nc-bg-selected': activeSelectedField === t.ai_temp_id,
                            }"
                            :disabled="selected.length >= maxSelectionCount"
                            @click="onToggleTag(t)"
                          >
                            <div class="flex flex-row items-center gap-2 py-[3px] text-small leading-[18px]">
                              <NcCheckbox :checked="t.selected" theme="ai" class="!-mr-0.5" @click.stop="onToggleTag(t, true)" />

                              <component
                                :is="getUIDTIcon(isFormulaPredictionMode ? UITypes.Formula : t.type)"
                                v-if="isFormulaPredictionMode || t?.type"
                                class="flex-none w-3.5 h-3.5"
                                :class="{
                                  'opacity-60': selected.length >= maxSelectionCount,
                                }"
                              />

                              <div>{{ t.formState?.title || t.title }}</div>
                            </div>
                          </a-tag>
                        </NcTooltip>
                      </template>
                    </template>
                    <div v-else class="text-nc-content-gray-subtle2">{{ $t('labels.noData') }}</div>
                  </div>
                </div>
              </div>
            </template>
          </AiWizardTabs>

          <div
            v-if="failedToSaveFields"
            class="w-full p-4 flex items-start gap-4 border-1 border-nc-border-gray-medium rounded-lg"
          >
            <GeneralIcon icon="ncInfoSolid" class="flex-none text-nc-content-red-dark" />
            <div class="flex flex-col gap-1">
              <div class="text-nc-content-gray text-base font-bold">Failed to add fields</div>
              <div class="text-nc-content-gray-muted text-sm">
                NocoDB was unable to add {{ predicted.length }} fields to the table. Please retry adding the fields.
              </div>
            </div>
            <NcButton size="xsmall" type="text" class="!px-1" @click.stop="failedToSaveFields = false">
              <GeneralIcon icon="close" class="text-gray-600" />
            </NcButton>
          </div>
          <a-form-item>
            <div class="flex gap-x-2 justify-end">
              <!-- Cancel -->
              <NcButton size="small" html-type="button" type="secondary" :disabled="saving" @click="emit('cancel')">
                {{ $t('general.cancel') }}
              </NcButton>

              <!-- Save -->
              <NcButton
                v-if="aiIntegrationAvailable"
                html-type="submit"
                type="primary"
                theme="ai"
                :loading="saving"
                :disabled="disableSubmitBtn || !activeTabSelectedFields.length || saving"
                size="small"
                :label="submitBtnLabel.label"
                :loading-label="submitBtnLabel.loadingLabel"
                data-testid="nc-field-modal-submit-btn"
                @click.prevent="onSubmit"
              >
                <template #icon>
                  <GeneralIcon icon="ncAutoAwesome" />
                </template>

                {{ submitBtnLabel.label }}
                <template #loading>
                  {{ submitBtnLabel.loadingLabel }}
                </template>
              </NcButton>
              <NcButton v-else type="primary" size="small" @click="handleNavigateToIntegrations"> Add AI integration </NcButton>
            </div>
          </a-form-item>
        </template>
      </div>
      <a-form-item v-if="isFieldsTab" v-bind="validateInfos.title" class="flex">
        <div
          class="flex flex-grow px-2 py-1 items-center rounded-md bg-gray-100 focus:bg-gray-100 outline-none"
          style="outline-style: solid; outline-width: thin"
        >
          <input
            ref="antInput"
            v-model="formState.title"
            :disabled="readOnly || !isFullUpdateAllowed"
            :placeholder="`${$t('objects.field')} ${$t('general.name').toLowerCase()} ${isEdit ? '' : $t('labels.optional')}`"
            class="flex flex-grow nc-fields-input nc-input-shadow text-sm font-semibold outline-none bg-inherit min-h-6"
            :class="{
              'nc-ai-input': isAiMode,
            }"
            :contenteditable="true"
            @change="debouncedOnPredictFieldType"
            @input="formState.userHasChangedTitle = true"
          />
        </div>
      </a-form-item>
      <a-form-item
        v-if="!props.hideTitle && !isFieldsTab && (aiAutoSuggestMode ? formState.uidt : true)"
        v-bind="validateInfos.title"
        :required="false"
        class="!mb-0"
      >
        <a-input
          ref="antInput"
          v-model:value="formState.title"
          class="nc-column-name-input nc-input-shadow !rounded-lg"
          :class="{
            'nc-ai-input': isAiMode,
          }"
          :placeholder="`${$t('objects.field')} ${$t('general.name').toLowerCase()} ${isEdit ? '' : $t('labels.optional')}`"
          :disabled="isKanban || readOnly || !isFullUpdateAllowed"
          @change="debouncedOnPredictFieldType"
          @input="onAlter(8)"
        />
      </a-form-item>

      <div class="flex items-center gap-1 empty:hidden">
        <template v-if="!props.hideType && !formState.uidt">
          <SmartsheetColumnUITypesOptionsWithSearch
            v-if="!(aiAutoSuggestMode && !props.fromTableExplorer)"
            :options="uiTypesOptions"
            :extra-icons="extraIcons"
            @selected="onSelectType($event, true)"
          />
        </template>

        <a-form-item
          v-else-if="!props.hideType"
          class="flex-1"
          @keydown.up.stop="handleResetHoverEffect"
          @keydown.down.stop="handleResetHoverEffect"
        >
          <NcTooltip :disabled="!(!isEdit && formState.uidt && !!formState?.ai_temp_id)">
            <template #title>
              You cannot edit field types of AI-generated fields. Edits can be made after the field is created.</template
            >
            <a-select
              v-model:value="formState.uidt"
              show-search
              class="nc-column-type-input nc-select-shadow !rounded-lg"
              :class="{
                'nc-ai-input': isAiMode,
                '!pointer-events-none !cursor-not-allowed': !isEdit && formState.uidt && !!formState?.ai_temp_id,
              }"
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
              @change="onSelectType($event)"
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
                  '!text-nc-content-purple-dark': [UITypes.AI, AIButton].includes(opt.name),
                }"
                @mouseover="handleResetHoverEffect"
              >
                <div class="w-full flex gap-2 items-center justify-between" :data-testid="opt.name" :data-title="formState?.type">
                  <div class="flex-1 flex gap-2 items-center">
                    <component
                      :is="isAiButtonSelectOption(opt.name) ? iconMap.cellAiButton : opt.icon"
                      class="nc-field-type-icon w-4 h-4"
                      :class="isMetaReadOnly && !readonlyMetaAllowedTypes.includes(opt.name) ? 'text-gray-300' : 'text-gray-700'"
                    />
                    <div class="flex-1">
                      {{ UITypesName[opt.name] }}
                    </div>
                    <span v-if="opt.deprecated" class="!text-xs !text-gray-300">({{ $t('general.deprecated') }})</span>
                    <!-- <span v-if="opt.isNew || isAiButtonSelectOption(opt.name)" class="text-sm text-nc-content-purple-dark bg-purple-50 px-2 rounded-md">{{ $t('general.new') }}</span> -->
                  </div>
                  <component
                    :is="iconMap.check"
                    v-if="formState.uidt === opt.name"
                    id="nc-selected-item-icon"
                    class="w-4 h-4"
                    :class="{
                      'text-primary': !isAiMode,
                      'text-nc-content-purple-medium': isAiMode,
                    }"
                  />
                </div>
              </a-select-option>
            </a-select>
          </NcTooltip>
        </a-form-item>
      </div>
      <a-form-item v-if="enableDescription && aiAutoSuggestMode">
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
            'nc-ai-input': isAiMode,
          }"
          class="nc-input-sm nc-input-text-area nc-input-shadow !text-gray-800 px-3 !max-h-[300px]"
          hide-details
          data-testid="create-field-description-input"
          :placeholder="$t('msg.info.enterFieldDescription')"
        />
      </a-form-item>

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
          @navigate-to-integrations="handleNavigateToIntegrations"
        />
        <SmartsheetColumnAiButtonOptions
          v-if="formState.uidt === UITypes.Button && formState?.type === ButtonActionsType.Ai"
          v-model:value="formState"
          :submit-btn-label="submitBtnLabel"
          :saving="saving"
          @navigate-to-integrations="handleNavigateToIntegrations"
          @on-submit="onSubmit"
        />
        <SmartsheetColumnAIOptions
          v-if="formState.uidt === UITypes.AI"
          v-model="formState"
          @navigate-to-integrations="handleNavigateToIntegrations"
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
          !(isDatabricks(meta!.source_id) && formState.unique) &&
          !isAI(formState)
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

        <a-form-item v-if="enableDescription && !aiAutoSuggestMode">
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
              'nc-ai-input': isAiMode,
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
          <div class="flex items-center justify-between gap-2 empty:hidden">
            <NcButton v-if="!enableDescription" size="small" type="text" @click.stop="triggerDescriptionEnable">
              <div class="flex !text-gray-700 items-center gap-2">
                <GeneralIcon icon="plus" class="h-4 w-4" />

                <span class="first-letter:capitalize">
                  {{ $t('labels.addDescription').toLowerCase() }}
                </span>
              </div>
            </NcButton>
            <div v-else-if="!aiAutoSuggestMode"></div>

            <a-form-item v-if="!aiAutoSuggestMode">
              <div
                class="flex gap-x-2 justify-end"
                :class="{
                  'justify-end': !props.embedMode,
                }"
              >
                <!-- Cancel -->
                <NcButton size="small" html-type="button" type="secondary" :disabled="saving" @click="emit('cancel')">
                  {{ $t('general.cancel') }}
                </NcButton>

                <!-- Save -->
                <NcButton
                  html-type="submit"
                  type="primary"
                  :theme="isAiMode ? 'ai' : 'default'"
                  :loading="saving"
                  :disabled="!formState.uidt || disableSubmitBtn || saving"
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

      <template v-if="isAiMode">
        <div v-if="props.fromTableExplorer" class="flex-1"></div>
        <SmartsheetColumnAIFooterOptions
          v-model="formState"
          class="-mx-5 sticky bottom-0 z-10"
          :class="{
            'bg-nc-bg-gray-extralight': aiAutoSuggestMode && formState.uidt,
            'bg-white': !(aiAutoSuggestMode && formState.uidt),
          }"
        />
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

.nc-edit-or-add-provider-wrapper .nc-ai-mode {
  .nc-fields-input,
  .nc-column-name-input {
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

:deep(.ant-select-disabled.nc-column-type-input) {
  .nc-field-type-icon {
    @apply text-current;
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

.nc-field-modal-ai-toggle-btn {
  @apply rounded-l-none -ml-[1px] border-transparent;

  &.nc-ai-mode {
    @apply bg-purple-600 hover:bg-purple-500;
  }
  &:not(.nc-ai-mode) {
    @apply !border-purple-100;
  }
}
</style>
