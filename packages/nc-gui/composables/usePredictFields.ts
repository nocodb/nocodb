import { UITypes } from 'nocodb-sdk'
import type { WritableComputedRef } from '@vue/reactivity'
import { AiWizardTabsType } from '#imports'

enum AiStep {
  init = 'init',
  pick = 'pick',
}

interface PredictedFieldType {
  title: string
  type: UITypes
  column_name?: string
  options?: string[]
  colOptions?: Record<string, any>
  formula?: string
  formState?: Record<string, any>
  selected?: boolean
  tab?: AiWizardTabsType
  ai_temp_id: string
}

const maxSelectionCount = 100

export const usePredictFields = createSharedComposable(
  (isFromTableExplorer?: Ref<boolean>, fields?: WritableComputedRef<Record<string, any>[]>) => {
    const { aiLoading, aiError, predictNextFields: _predictNextFields, predictNextFormulas } = useNocoAi()

    const { meta, view } = useSmartsheetStoreOrThrow()

    const columnsHash = ref<string>()

    const { $api } = useNuxtApp()

    const aiMode = ref(false)

    const isFormulaPredictionMode = ref(false)

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

        prompt.value = ''
        oldPrompt.value = ''

        aiError.value = ''
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

    const aiTabs = [
      {
        title: 'Auto Suggestions',
        key: AiWizardTabsType.AUTO_SUGGESTIONS,
      },
      {
        title: 'Prompt',
        key: AiWizardTabsType.PROMPT,
      },
    ]

    const isPredictFromPromptLoading = computed(() => {
      return aiLoading.value && calledFunction.value === 'predictFromPrompt'
    })

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

      return (
        await (isFormulaPredictionMode.value
          ? predictNextFormulas(
              meta.value?.id as string,
              fieldHistory,
              meta.value?.base_id,
              activeAiTab.value === AiWizardTabsType.PROMPT ? prompt.value : undefined,
            )
          : _predictNextFields(
              meta.value?.id as string,
              fieldHistory,
              meta.value?.base_id,
              activeAiTab.value === AiWizardTabsType.PROMPT ? prompt.value : undefined,
            ))
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
          return {
            ...f,
            tab: activeAiTab.value,
            ai_temp_id: `temp_${++temporaryAddCount.value}`,
          }
        })
    }

    const disableAiMode = () => {
      onInit()
    }

    const predictMore = async () => {
      calledFunction.value = 'predictMore'

      const predictions = await predictNextFields()

      if (predictions.length) {
        predicted.value.push(...predictions)
        predictHistory.value.push(...predictions)
      } else {
        message.info(`No more auto suggestions were found for ${meta.value?.title || 'the current table'}`)
      }
    }

    const predictRefresh = async () => {
      calledFunction.value = 'predictRefresh'

      const predictions = await predictNextFields()

      if (predictions.length) {
        predicted.value = [
          ...predicted.value.filter((t) => t.tab !== activeAiTab.value || (t.tab === activeAiTab.value && !!t.selected)),
          ...predictions,
        ]
        predictHistory.value.push(...predictions)
      } else {
        message.info(`No auto suggestions were found for ${meta.value?.title || 'the current table'}`)
      }
      aiModeStep.value = AiStep.pick
    }

    const predictFromPrompt = async () => {
      calledFunction.value = 'predictFromPrompt'

      const predictions = await predictNextFields()

      if (predictions.length) {
        predicted.value = [
          ...predicted.value.filter((t) => t.tab !== activeAiTab.value || (t.tab === activeAiTab.value && !!t.selected)),
          ...predictions,
        ]
        predictHistory.value.push(...predictions)

        oldPrompt.value = prompt.value
      } else {
        message.info('No suggestions were found with the given prompt. Try again after modifying the prompt.')
      }
      aiModeStep.value = AiStep.pick
      isPromtAlreadyGenerated.value = true
    }

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
        uidt: isFormulaPredictionMode.value ? UITypes.Formula : field.type,
        column_name: field.title.toLowerCase().replace(/\\W/g, '_'),
        ...(field.formula ? { formula_raw: field.formula } : {}),
        ...(field.colOptions ? { colOptions: field.colOptions } : {}),
        meta: {
          ...(field.type in columnDefaultMeta ? columnDefaultMeta[field.type as keyof typeof columnDefaultMeta] : {}),
        },
        is_ai_field: true,
      }
    }

    // Todo: update logic
    const onToggleTag = (field: PredictedFieldType) => {
      if (
        !field.selected &&
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
            t.selected = !field.selected
          }
          return t
        })
      }

      return true
    }

    const onTagClick = (field: PredictedFieldType) => {
      if (selected.value.length >= maxSelectionCount || ncIsArrayIncludes(selected.value, field.title, 'title')) return

      if (!isFromTableExplorer?.value) {
        field.formState = getFieldWithDefautlValue(field)
      }

      selected.value.push(field)
      predicted.value = predicted.value.filter((v) => v.title !== field.title)

      return true
    }

    const onTagClose = (field: PredictedFieldType) => {
      selected.value = selected.value.filter((v) => v.title !== field.title)
      if (ncIsArrayIncludes(predictHistory.value, field.title, 'title')) {
        predicted.value.push(field)
      }
      return true
    }

    const onSelectedTagClick = (field: PredictedFieldType) => {
      activeSelectedField.value = field.title
    }

    const onTagRemoveFromPrediction = (field: PredictedFieldType) => {
      if (selected.value.length >= maxSelectionCount) return

      removedFromPredicted.value.push(field)
      predicted.value = predicted.value.filter((pv) => pv.ai_temp_id !== field.ai_temp_id)
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

    const onDeselectAll = () => {
      const fieldsToRemove = selected.value.filter((sv) => ncIsArrayIncludes(predictHistory.value, sv.title, 'title'))
      predicted.value.push(...fieldsToRemove)
      selected.value = selected.value.filter((sv) => !ncIsArrayIncludes(predictHistory.value, sv.title, 'title'))

      return fieldsToRemove
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

    const saveFields = async (onSuccess: () => Promise<void>) => {
      failedToSaveFields.value = false
      const payload = selected.value
        .filter((f) => f.formState)
        .map((field) => {
          return {
            op: 'add',
            column: {
              ...field.formState,
              column_order: {
                // order: order,
                view_id: view.value?.id,
              },
              view_id: view.value?.id,
            },
          }
        })

      const res = await $api.dbTableColumn.bulk(meta.value?.id, {
        hash: columnsHash.value,
        ops: payload,
      })

      if (res && res.failedOps?.length) {
        const failedColumnTitle = res.failedOps.filter((o) => o?.column?.title).map((o) => o.column.title)
        selected.value = selected.value.filter((f) => {
          if (failedColumnTitle.includes(f.formState?.title)) return true

          return false
        })

        failedToSaveFields.value = true

        return false
      } else {
        await onSuccess?.()

        return true
      }
    }
    const toggleAiMode = async (isFormulaMode: boolean = false) => {
      if (isFormulaMode) {
        isFormulaPredictionMode.value = true
      } else {
        isFormulaPredictionMode.value = false
      }

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
      isFormulaPredictionMode.value = false
      aiMode.value = false
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
        }
      },
      { deep: true, immediate: true },
    )

    return {
      aiMode,
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
      aiTabs,
      isPredictFromPromptLoading,
      isFormulaPredictionMode,
      failedToSaveFields,
      onInit,
      toggleAiMode,
      disableAiMode,
      predictMore,
      predictRefresh,
      predictFromPrompt,
      onTagClick,
      onToggleTag,
      onTagClose,
      onSelectedTagClick,
      onTagRemoveFromPrediction,
      onSelectAll,
      onDeselectAll,
      handleRefreshOnError,
      saveFields,
    }
  },
)
