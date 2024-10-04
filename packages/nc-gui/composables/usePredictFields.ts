import type { UITypes } from 'nocodb-sdk'
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
}

const maxSelectionCount = 6

export const usePredictFields = createSharedComposable((fields: WritableComputedRef<Record<string, any>[]>) => {
  const { aiIntegrationAvailable, aiLoading, aiError, predictNextFields } = useNocoAi()

  const { meta } = useSmartsheetStoreOrThrow()

  const aiMode = ref(false)

  const aiModeStep = ref<AiStep | null>(null)

  const predicted = ref<PredictedFieldType[]>([])

  const removedFromPredicted = ref<PredictedFieldType[]>([])

  const predictHistory = ref<PredictedFieldType[]>([])

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
    return await predictNextFields(
      meta.value?.id as string,
      predictHistory.value.map((f) => f.title),
      meta.value?.base_id,
      prompt,
    )
  }

  const toggleAiMode = async () => {
    if (aiMode.value) return

    aiError.value = ''

    aiMode.value = true
    aiModeStep.value = AiStep.init
    predicted.value = []
    predictHistory.value = []
    prompt.value = ''
    isPromtAlreadyGenerated.value = false

    const predictions = await _predictNextFields()

    if (predictions.length) {
      predicted.value = predictions
      predictHistory.value.push(...predictions)
      aiModeStep.value = AiStep.pick
    }
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

  const onTagClick = (field: PredictedFieldType) => {
    if (selected.value.length >= maxSelectionCount || ncIsArrayIncludes(selected.value, field.title, 'title')) return

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
    selected.value.push(...fieldsToAdd)

    // Update predicted with the remaining ones
    predicted.value = remainingPredictedFields
  }

  const onDeselectAll = () => {
    predicted.value.push(...selected.value.filter((sv) => ncIsArrayIncludes(predictHistory.value, sv.title, 'title')))
    selected.value = selected.value.filter((sv) => !ncIsArrayIncludes(predictHistory.value, sv.title, 'title'))
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

  function onInit() {
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

  return {
    aiMode,
    aiModeStep,
    predicted,
    removedFromPredicted,
    predictHistory,
    selected,
    calledFunction,
    prompt,
    isPromtAlreadyGenerated,
    maxSelectionCount,
    activeAiTab,
    aiTabs,
    isPredictFromPromptLoading,
    onInit,
    toggleAiMode,
    disableAiMode,
    predictMore,
    predictRefresh,
    predictFromPrompt,
    onTagClick,
    onTagClose,
    onTagRemoveFromPrediction,
    onSelectAll,
    onDeselectAll,
    handleRefreshOnError,
  }
})
