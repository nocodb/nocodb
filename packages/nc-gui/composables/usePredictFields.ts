import { UITypes } from 'nocodb-sdk'
import type { WritableComputedRef } from '@vue/reactivity'

enum AiStep {
  init = 'init',
  pick = 'pick',
}

enum TableWizardTabs {
  AUTO_SUGGESTIONS = 'AUTO_SUGGESTIONS',
  PROMPT = 'PROMPT',
}

interface PredictedFieldType {
  title: string
  type: UITypes
  column_name?: string
  options?: string[]
  colOptions?: Record<string, any>
  formula?: string
  formState?: Record<string, any>
}

const maxSelectionCount = 100

export const usePredictFields = createSharedComposable(
  (isFromTableExplorer?: Ref<boolean>, fields?: WritableComputedRef<Record<string, any>[]>) => {
    const { aiLoading, aiError, predictNextFields, predictNextFormulas } = useNocoAi()

    const { meta, view } = useSmartsheetStoreOrThrow()

    const columnsHash = ref<string>()

    const { $api } = useNuxtApp()

    const aiMode = ref(false)

    const isFormulaPredictionMode = ref(false)

    const aiModeStep = ref<AiStep | null>(null)

    const predicted = ref<PredictedFieldType[]>([])

    const removedFromPredicted = ref<PredictedFieldType[]>([])

    const predictHistory = ref<PredictedFieldType[]>([])

    const activeSelectedField = ref<string | null>(null)

    const selected = ref<PredictedFieldType[]>([])

    const calledFunction = ref<string>('')

    const prompt = ref<string>('')

    const isPromtAlreadyGenerated = ref<boolean>(false)

    const activeAiTabLocal = ref<keyof typeof TableWizardTabs>(TableWizardTabs.AUTO_SUGGESTIONS)

    const activeAiTab = computed({
      get: () => {
        return activeAiTabLocal.value
      },
      set: (value: keyof typeof TableWizardTabs) => {
        activeAiTabLocal.value = value

        predicted.value = []
        predictHistory.value = [...selected.value]

        prompt.value = ''
        isPromtAlreadyGenerated.value = false

        aiError.value = ''
      },
    })

    const aiTabs = [
      {
        title: 'Auto Suggestions',
        key: TableWizardTabs.AUTO_SUGGESTIONS,
      },
      {
        title: 'Prompt',
        key: TableWizardTabs.PROMPT,
      },
    ]

    const isPredictFromPromptLoading = computed(() => {
      return aiLoading.value && calledFunction.value === 'predictFromPrompt'
    })

    const _predictNextFields = async (prompt?: string): Promise<PredictedFieldType[]> => {
      const fieldHistory = Array.from(
        new Set(
          predictHistory.value
            .map((f) => f.title)
            .concat(
              isFromTableExplorer?.value
                ? fields?.value?.filter((f) => !!f?.title && !!f?.temp_id)?.map((f) => f.title) || []
                : [],
            ),
        ),
      )

      return await (isFormulaPredictionMode.value
        ? predictNextFormulas(meta.value?.id as string, fieldHistory, meta.value?.base_id, prompt)
        : predictNextFields(meta.value?.id as string, fieldHistory, meta.value?.base_id, prompt))
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
      isPromtAlreadyGenerated.value = false

      const predictions = await _predictNextFields()

      predicted.value = predictions
      predictHistory.value.push(...predictions)
      aiModeStep.value = AiStep.pick
    }

    const disableAiMode = () => {
      onInit()
    }

    const predictMore = async () => {
      calledFunction.value = 'predictMore'

      const predictions = await _predictNextFields()

      if (predictions.length) {
        predicted.value.push(
          ...predictions.filter(
            (v) =>
              !ncIsArrayIncludes(predicted.value, v.title, 'title') &&
              !ncIsArrayIncludes(selected.value, v.title, 'title') &&
              !ncIsArrayIncludes(removedFromPredicted.value, v.title, 'title'),
          ),
        )
        predictHistory.value.push(...predictions.filter((v) => !ncIsArrayIncludes(selected.value, v.title, 'title')))
      }
    }

    const predictRefresh = async () => {
      calledFunction.value = 'predictRefresh'

      const predictions = (await _predictNextFields()).filter(
        (pv) =>
          !ncIsArrayIncludes(selected.value, pv.title, 'title') &&
          !ncIsArrayIncludes(removedFromPredicted.value, pv.title, 'title'),
      )

      if (predictions.length) {
        predicted.value = predictions
        predictHistory.value.push(...predictions)
        aiModeStep.value = AiStep.pick
      }
    }

    const predictFromPrompt = async () => {
      calledFunction.value = 'predictFromPrompt'

      const predictions = (await _predictNextFields(prompt.value)).filter(
        (pv) =>
          !ncIsArrayIncludes(selected.value, pv.title, 'title') &&
          !ncIsArrayIncludes(removedFromPredicted.value, pv.title, 'title'),
      )

      if (predictions.length) {
        predicted.value = predictions
        predictHistory.value.push(...predictions)
        aiModeStep.value = AiStep.pick
      }

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
      predicted.value = predicted.value.filter((pv) => pv.title !== field.title)
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

      await onSuccess?.()
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
      isPromtAlreadyGenerated.value = false

      activeAiTabLocal.value = TableWizardTabs.AUTO_SUGGESTIONS
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
      removedFromPredicted,
      predictHistory,
      activeSelectedField,
      selected,
      calledFunction,
      prompt,
      isPromtAlreadyGenerated,
      maxSelectionCount,
      activeAiTab,
      aiTabs,
      isPredictFromPromptLoading,
      isFormulaPredictionMode,
      onInit,
      toggleAiMode,
      disableAiMode,
      predictMore,
      predictRefresh,
      predictFromPrompt,
      onTagClick,
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
