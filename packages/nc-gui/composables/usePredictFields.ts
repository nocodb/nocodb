import { UITypes } from 'nocodb-sdk'
import type { WritableComputedRef } from '@vue/reactivity'
import type { RuleObject } from 'ant-design-vue/es/form'
import { AiWizardTabsType, type PredictedFieldType } from '#imports'

enum AiStep {
  init = 'init',
  pick = 'pick',
}

const maxSelectionCount = 100

const useForm = Form.useForm

export const usePredictFields = createSharedComposable(
  (isFromTableExplorer?: Ref<boolean>, fields?: WritableComputedRef<Record<string, any>[]>) => {
    const { $e } = useNuxtApp()

    const { t } = useI18n()

    const { aiLoading, aiError, predictNextFields: _predictNextFields, predictNextFormulas, predictNextButtons } = useNocoAi()

    const { meta, view } = useSmartsheetStoreOrThrow()

    const isForm = inject(IsFormInj, ref(false))

    const columnsHash = ref<string>()

    const { $api } = useNuxtApp()

    const aiMode = ref(false)

    const localIsFromFieldModal = ref<boolean>(false)

    const isAiModeFieldModal = computed(() => {
      return aiMode.value && localIsFromFieldModal.value
    })

    const fieldPredictionMode = ref<'field' | 'formula' | 'button'>('field')

    const isFormulaPredictionMode = computed(() => fieldPredictionMode.value === 'formula')

    const aiModeStep = ref<AiStep | null>(null)

    const calledFunction = ref<string>('')

    const prompt = ref<string>('')

    const oldPrompt = ref<string>('')

    const isPromtAlreadyGenerated = ref<boolean>(false)

    const activeAiTabLocal = ref<AiWizardTabsType>(AiWizardTabsType.AUTO_SUGGESTIONS)

    const failedToSaveFields = ref<boolean>(false)

    const temporaryAddCount = ref<number>(0)

    const activeAiTab = computed({
      get: () => {
        return activeAiTabLocal.value
      },
      set: (value: AiWizardTabsType) => {
        activeAiTabLocal.value = value

        aiError.value = ''

        if (aiMode.value) {
          $e(`c:column:ai:tab-change:${value}`)
        }
      },
    })

    const predicted = ref<PredictedFieldType[]>([])

    const activeTabPredictedFields = computed(() => predicted.value.filter((f) => f.tab === activeAiTab.value))

    const removedFromPredicted = ref<PredictedFieldType[]>([])

    const predictHistory = ref<PredictedFieldType[]>([])

    const activeTabPredictHistory = computed(() => predictHistory.value.filter((f) => f.tab === activeAiTab.value))

    const activeSelectedField = ref<string | null>(null)

    const selected = ref<PredictedFieldType[]>([])

    const activeTabSelectedFields = computed(() => {
      return predicted.value.filter((field) => !!field.selected && field.tab === activeAiTab.value)
    })

    const isPredictFromPromptLoading = computed(() => {
      return aiLoading.value && calledFunction.value === 'predictFromPrompt'
    })

    const validators = computed(() => {
      const rulesObj: Record<string, RuleObject[]> = {}

      if (!activeTabSelectedFields.value.length) return rulesObj

      for (const column of activeTabSelectedFields.value) {
        const rules: RuleObject[] = [
          {
            validator: (_rule: RuleObject, value: any) => {
              return new Promise((resolve, reject) => {
                const isAiFieldExist = isAiModeFieldModal.value
                  ? activeTabSelectedFields.value.some((c) => {
                      return (
                        c.ai_temp_id !== value?.ai_temp_id &&
                        value?.title &&
                        (value.title.toLowerCase().trim() === (c.formState?.column_name || '').toLowerCase().trim() ||
                          value.title.toLowerCase().trim() === (c.formState?.title || '').toLowerCase().trim() ||
                          value.title.toLowerCase().trim() === (c?.title || '').toLowerCase().trim())
                      )
                    })
                  : false
                if (isAiFieldExist) {
                  return reject(new Error(`${t('msg.error.duplicateColumnName')} "${value?.title}"`))
                }

                return resolve()
              })
            },
          },
        ]

        switch (column.type) {
          case UITypes.Formula: {
            rules.push({
              validator: (_rule: RuleObject, value: any) => {
                return new Promise((resolve, reject) => {
                  if (!value?.formula_raw?.trim()) {
                    return reject(new Error('Formula is required'))
                  }

                  return resolve()
                })
              },
            })
          }
        }

        if (rules.length) {
          rulesObj[column.ai_temp_id] = rules
        }
      }

      return rulesObj
    })

    const fieldMappingFormState = computed(() => {
      if (!activeTabSelectedFields.value.length) return {}

      return activeTabSelectedFields.value.reduce((acc, col) => {
        acc[col.ai_temp_id] = col.formState
        return acc
      }, {} as Record<string, any>)
    })

    // Form field validation
    const { validate } = useForm(fieldMappingFormState, validators)

    const getFieldWithDefautlValue = (field: PredictedFieldType) => {
      if ([UITypes.SingleSelect, UITypes.MultiSelect].includes(field.type)) {
        if (field.options) {
          const options: {
            title: string
            index: number
            color?: string
          }[] = []
          for (const option of field.options) {
            // skip if option already exists
            if (options.find((el) => el.title === option)) continue

            options.push({
              title: option,
              index: options.length,
              color: enumColor.light[options.length % enumColor.light.length],
            })
          }

          field.colOptions = {
            options,
          }
        }
      }

      return {
        title: field.title,
        uidt:
          fieldPredictionMode.value === 'formula'
            ? UITypes.Formula
            : fieldPredictionMode.value === 'button'
            ? UITypes.Button
            : field.type,
        column_name: field.title.toLowerCase().replace(/\\W/g, '_'),
        ...(field.formula ? { formula_raw: field.formula } : {}),
        ...(field.colOptions ? { colOptions: field.colOptions } : {}),
        meta: {
          ...(field.type in columnDefaultMeta ? columnDefaultMeta[field.type as keyof typeof columnDefaultMeta] : {}),
        },
        description: field?.description || null,
        is_ai_field: true,
        ai_temp_id: field.ai_temp_id,
      }
    }

    const predictNextFields = async (): Promise<PredictedFieldType[]> => {
      const fieldHistory = Array.from(
        new Set(
          activeTabPredictHistory.value
            .map((f) => f.title)
            .concat(
              isFromTableExplorer?.value
                ? fields?.value?.filter((f) => !!f?.title && !!f?.temp_id)?.map((f) => f.title) || []
                : [],
            ),
        ),
      )

      const predictionFn =
        fieldPredictionMode.value === 'formula'
          ? predictNextFormulas
          : fieldPredictionMode.value === 'button'
          ? predictNextButtons
          : _predictNextFields

      return (
        await predictionFn(
          meta.value?.id as string,
          fieldHistory,
          meta.value?.base_id,
          activeAiTab.value === AiWizardTabsType.PROMPT ? prompt.value : undefined,
          isForm.value ? formViewHiddenColTypes : [],
        )
      )
        .filter(
          (f) =>
            !ncIsArrayIncludes(
              [
                ...activeTabPredictedFields.value,
                ...(isFromTableExplorer?.value
                  ? fields?.value?.filter((f) => !!f?.title && !!f?.temp_id).map((f) => ({ title: f.title })) || []
                  : []),
              ],

              f.title,
              'title',
            ),
        )
        .map((f) => {
          const state = {
            ...f,
            tab: activeAiTab.value,
            ai_temp_id: `temp_${++temporaryAddCount.value}`,
            selected: false,
          }

          if (isFromTableExplorer?.value) {
            return state
          }

          return {
            ...state,
            formState: getFieldWithDefautlValue(state),
          }
        })
    }

    const disableAiMode = () => {
      $e('c:column:ai:toggle:false', {
        mode: fieldPredictionMode.value,
      })

      onInit()
    }

    const predictMore = async () => {
      calledFunction.value = 'predictMore'

      $e('a:column:ai:predict-more')

      const predictions = await predictNextFields()

      if (predictions.length) {
        predicted.value.push(...predictions)
        predictHistory.value.push(...predictions)
      } else if (!aiError.value) {
        message.info(`No more auto suggestions were found for ${meta.value?.title || 'the current table'}`)
      }
    }

    const predictRefresh = async (callback?: (field?: PredictedFieldType | undefined) => void) => {
      calledFunction.value = 'predictRefresh'

      $e('a:column:ai:predict-refresh')

      const predictions = await predictNextFields()

      if (predictions.length) {
        predicted.value = [
          ...predicted.value.filter(
            (t) => t.tab !== activeAiTab.value || (isFromTableExplorer?.value && t.tab === activeAiTab.value && !!t.selected),
          ),
          ...predictions,
        ]
        predictHistory.value.push(...predictions)

        if (ncIsFunction(callback)) {
          callback()
        }
      } else if (!aiError.value) {
        message.info(`No auto suggestions were found for ${meta.value?.title || 'the current table'}`)
      }
      aiModeStep.value = AiStep.pick
    }

    const predictFromPrompt = async (callback?: (field?: PredictedFieldType | undefined) => void) => {
      calledFunction.value = 'predictFromPrompt'

      $e('a:column:ai:predict-from-prompt', {
        prompt: prompt.value,
      })

      const predictions = await predictNextFields()

      if (predictions.length) {
        predicted.value = [
          ...predicted.value.filter(
            (t) => t.tab !== activeAiTab.value || (isFromTableExplorer?.value && t.tab === activeAiTab.value && !!t.selected),
          ),
          ...predictions,
        ]
        predictHistory.value.push(...predictions)

        oldPrompt.value = prompt.value

        if (ncIsFunction(callback)) {
          callback()
        }
      } else if (!aiError.value) {
        message.info('No suggestions were found with the given prompt. Try again after modifying the prompt.')
      }
      aiModeStep.value = AiStep.pick
      isPromtAlreadyGenerated.value = true
    }

    // Todo: update logic
    const onToggleTag = (field: PredictedFieldType) => {
      if (
        field.selected !== true &&
        (activeTabSelectedFields.value.length >= maxSelectionCount ||
          ncIsArrayIncludes(
            predicted.value.filter((f) => !!f.selected),
            field.title,
            'title',
          ))
      ) {
        return
      }

      if (isFromTableExplorer?.value && field.selected) {
        const fieldIndex = predicted.value.findIndex((f) => f.ai_temp_id === field.ai_temp_id)
        if (fieldIndex === -1) return

        const fieldToDeselect = predicted.value.splice(fieldIndex, 1)[0]

        fieldToDeselect.selected = false

        predicted.value.push(fieldToDeselect)
      } else {
        predicted.value = predicted.value.map((t) => {
          if (t.ai_temp_id === field.ai_temp_id) {
            if (!isFromTableExplorer?.value && !field.selected) {
              activeSelectedField.value = field.ai_temp_id
            }

            t.selected = !field.selected
          }
          return t
        })
      }

      return true
    }

    const onSelectedTagClick = (field: PredictedFieldType) => {
      activeSelectedField.value = field.ai_temp_id
    }

    const onSelectAll = () => {
      if (selected.value.length >= maxSelectionCount) return
      let count = selected.value.length

      const remainingPredictedFields: PredictedFieldType[] = []
      const fieldsToAdd: PredictedFieldType[] = []

      predicted.value.forEach((pv) => {
        // Check if the item can be selected
        if (
          count < maxSelectionCount &&
          !ncIsArrayIncludes(removedFromPredicted.value, pv.title, 'title') &&
          !ncIsArrayIncludes(selected.value, pv.title, 'title')
        ) {
          fieldsToAdd.push(pv) // Add to selected field if it meets the criteria
          count++
        } else {
          remainingPredictedFields.push(pv) // Keep in predicted field if it doesn't meet the criteria
        }
      })

      // Add selected items to the selected view array
      selected.value.push(
        ...fieldsToAdd.map((f) => {
          if (!isFromTableExplorer?.value) {
            f.formState = getFieldWithDefautlValue(f)
          }

          return f
        }),
      )

      // Update predicted with the remaining ones
      predicted.value = remainingPredictedFields

      return fieldsToAdd
    }

    const handleRefreshOnError = () => {
      switch (calledFunction.value) {
        case 'predictMore':
          return predictMore()
        case 'predictRefresh':
          return predictRefresh()
        case 'predictFromPrompt':
          return predictFromPrompt()

        default:
      }
    }

    const validateAllFields = async () => {
      try {
        await validate()
        return true
      } catch (e: any) {
        console.error(e)

        if (e?.errorFields?.length) {
          const errorMsg = e?.errorFields
            .map((field, idx) => (field?.errors?.length ? `${idx + 1}. ${field?.errors?.join(',')}` : ''))
            .join(', ')

          message.error(errorMsg || t('msg.error.someOfTheRequiredFieldsAreEmpty'))

          return false
        }
      }
    }

    const saveFields = async (onSuccess: () => Promise<void>) => {
      const isValid = await validateAllFields()

      if (!isValid) return false

      failedToSaveFields.value = false
      const payload = activeTabSelectedFields.value
        .filter((f) => f.formState)
        .map((field) => {
          return {
            op: 'add',
            column: {
              ...field.formState,
              title: field.formState?.title || field.title,
              column_name: (field.formState?.title || field.title).toLowerCase().replace(/\\W/g, '_'),
              column_order: {
                // order: order,
                view_id: view.value?.id,
              },
              view_id: view.value?.id,
            },
          }
        })

      try {
        const res = await $api.dbTableColumn.bulk(meta.value?.id, {
          hash: columnsHash.value,
          ops: payload,
        })

        if (res && res.failedOps?.length) {
          const failedColumnTitle = res.failedOps.filter((o) => o?.column?.ai_temp_id).map((o) => o.column.ai_temp_id)
          predicted.value = predicted.value.filter((f) => {
            if (failedColumnTitle.includes(f.formState?.ai_temp_id)) return true

            return false
          })

          failedToSaveFields.value = true

          return false
        } else {
          await onSuccess?.()

          return true
        }
      } catch (e: any) {
        console.error(e)
        return false
      }
    }
    const toggleAiMode = async (mode: 'field' | 'button' | 'formula' = 'field', fromFieldModal = false) => {
      $e('c:column:ai:toggle:true', {
        mode,
      })

      if (mode === 'formula') {
        fieldPredictionMode.value = 'formula'
      } else if (mode === 'button') {
        fieldPredictionMode.value = 'button'
      } else {
        fieldPredictionMode.value = 'field'
      }

      localIsFromFieldModal.value = !!fromFieldModal

      aiError.value = ''

      aiMode.value = true
      aiModeStep.value = AiStep.init
      predicted.value = []
      predictHistory.value = []
      prompt.value = ''
      oldPrompt.value = ''
      isPromtAlreadyGenerated.value = false

      const predictions = await predictNextFields()

      predicted.value = predictions
      predictHistory.value.push(...predictions)
      aiModeStep.value = AiStep.pick
    }

    function onInit() {
      activeSelectedField.value = null
      fieldPredictionMode.value = 'field'
      aiMode.value = false
      localIsFromFieldModal.value = false
      aiModeStep.value = null
      predicted.value = []
      removedFromPredicted.value = []
      predictHistory.value = []
      selected.value = []
      calledFunction.value = ''
      prompt.value = ''
      oldPrompt.value = ''
      isPromtAlreadyGenerated.value = false

      activeAiTabLocal.value = AiWizardTabsType.AUTO_SUGGESTIONS

      failedToSaveFields.value = false
    }

    watch(
      meta,
      async (newMeta) => {
        if (newMeta?.id) {
          columnsHash.value = (await $api.dbTableColumn.hash(newMeta.id)).hash
          predictHistory.value = []
        }
      },
      { deep: true, immediate: true },
    )

    return {
      aiMode,
      isAiModeFieldModal,
      aiModeStep,
      predicted,
      activeTabPredictedFields,
      removedFromPredicted,
      predictHistory,
      activeTabPredictHistory,
      activeSelectedField,
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
      fieldPredictionMode,
      failedToSaveFields,
      onInit,
      toggleAiMode,
      disableAiMode,
      predictMore,
      predictRefresh,
      predictFromPrompt,
      onToggleTag,
      onSelectedTagClick,
      onSelectAll,
      handleRefreshOnError,
      saveFields,
    }
  },
)
