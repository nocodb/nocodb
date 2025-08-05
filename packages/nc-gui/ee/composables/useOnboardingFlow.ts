export interface OnboardingOptionType {
  value: string
  description?: string
  icon?: IconMapKey
  iconColor?: string
  /**
   * `Undefined` will be considered as `iconMap`
   */
  iconType?: 'indexedStepProgressBar' | 'iconMap'
  /**
   * `resetOnSelect` will be helpful if option is `None of the above` or `Other` to reset previous selection if user select this option
   */
  resetOnSelect?: boolean
}

export interface OnboardingRightSectionType {
  themeColor?: 'brand' | 'orange' | 'green' | 'purple' | 'pink'
  moscot?:
    | 'moscotWelcomeGreen'
    | 'moscotWelcomeOrange'
    | 'moscotWelcomePurple'
    | 'moscotCollaboration'
    | 'moscotGridTableBrand'
    | 'moscotGridTableOrange'
  imageName?: 'grid' | 'gallery' | 'calendar' | 'kanban'
}

export interface OnboardingQuestionType {
  id: number
  question: string
  inputType: 'singleSelect' | 'multiSelect'
  /**
   * MinSelection to auto navigate to next question if it is multiSelect input type
   */
  minSelection?: number
  options?: OnboardingOptionType[] | ((state?: { [questionId: string]: string | string[] }) => OnboardingOptionType[])
  rightSection: OnboardingRightSectionType | ((state?: { [questionId: string]: string | string[] }) => OnboardingRightSectionType)
  iconSize?: {
    width: number
    height: number
  }
}

export const useOnboardingFlow = createSharedComposable(() => {
  const { $e } = useNuxtApp()

  const router = useRouter()

  const route = router.currentRoute

  const { isFeatureEnabled } = useBetaFeatureToggle()

  const isEnabledOnboardingFlow = computed(() => {
    return isFeatureEnabled(FEATURE_FLAG.SIGNUP_ONBOARDING_FLOW)
  })

  /**
   * If true, the onboarding flow will be shown in home page - `/`
   */
  const showOnboardingFlowLocalState = ref(false)

  const showOnboardingFlow = computed(() => {
    return isEnabledOnboardingFlow.value && showOnboardingFlowLocalState.value && route.value.name === 'index'
  })

  // Timestamp when the onboarding flow is started
  const startedAt = ref()

  const formState = ref<{ [questionId: string]: string | string[] }>({})

  const questions = computed<OnboardingQuestionType[]>(() => {
    return [
      {
        id: 1,
        question: 'Hey! What do you plan on using NocoDB for?',
        inputType: 'singleSelect',
        options: [
          {
            value: 'Work',
            icon: 'ncBriefcase',
            iconColor: 'orange',
          },
          {
            value: 'Personal',
            icon: 'ncUser',
            iconColor: 'green',
          },
          {
            value: 'School',
            icon: 'ncGraduationCap',
            iconColor: 'purple',
          },
          {
            value: 'Non-Profit',
            icon: 'ncHeart',
            iconColor: 'pink',
          },
        ],
        rightSection: {
          themeColor: 'orange',
          moscot: 'moscotWelcomeOrange',
          imageName: 'grid',
        },
        iconSize: {
          width: 40,
          height: 40,
        },
      },
      {
        id: 2,
        question: 'What best describes your role currently?',
        inputType: 'singleSelect',
        options: (state = formState.value) => {
          const firstQuestionAns = state[1] ?? ''

          if (searchCompare('personal', firstQuestionAns as string)) {
            return [
              'Undergraduate student',
              'Graduate student',
              'Consultant at Digital Agency',
              'Individual Contributor',
              'Team Leader',
              'Director',
              'C-level',
              'VP',
              'Business Owner',
              'Other',
            ].map((value) => ({ value }))
          }

          if (searchCompare('school', firstQuestionAns as string)) {
            return ['Undergraduate student', 'Graduate student', 'Faculty', 'Other'].map((value) => ({ value }))
          }

          return [
            'Consultant at Digital Agency',
            'Individual Contributor',
            'Team Leader',
            'Head of Department',
            'VP',
            'C-level',
            'Business Owner',
          ].map((value) => ({ value }))
        },
        rightSection: (state = formState.value) => {
          let themeColor: OnboardingRightSectionType['themeColor'] = 'orange'
          let moscot: OnboardingRightSectionType['moscot'] = 'moscotWelcomeOrange'

          const firstQuestionAns = state[1] ?? ''

          if (searchCompare('personal', firstQuestionAns as string)) {
            themeColor = 'green'
            moscot = 'moscotWelcomeGreen'
          }

          if (searchCompare('school', firstQuestionAns as string)) {
            themeColor = 'purple'
            moscot = 'moscotWelcomePurple'
          }

          return {
            themeColor,
            moscot,
            imageName: 'grid',
          }
        },
      },
      {
        id: 3,
        question: 'How many people are in your team?',
        inputType: 'singleSelect',
        options: ['Only me', '2-5', '6-10', '11-15', '16-25', '26-50', '51-100', '101+'].map((value) => ({ value })),
        rightSection: {
          themeColor: 'orange',
          moscot: 'moscotCollaboration',
          imageName: 'gallery',
        },
      },
      {
        id: 4,
        question: 'How many people work at your company?',
        inputType: 'singleSelect',
        options: ['1-19', '20-49', '50-99', '100-250', '251-500', '500-1500', '1500+'].map((value) => ({ value })),
        rightSection: {
          themeColor: 'orange',
          moscot: 'moscotCollaboration',
          imageName: 'gallery',
        },
      },
      {
        id: 5,
        question: 'How experienced are you with app building?',
        inputType: 'singleSelect',
        options: [
          {
            value: 'Beginer',
            iconType: 'indexedStepProgressBar',
          },
          {
            value: 'Intermediate',
            iconType: 'indexedStepProgressBar',
          },
          {
            value: 'Advanced',
            iconType: 'indexedStepProgressBar',
          },
          {
            value: 'Expert',
            iconType: 'indexedStepProgressBar',
          },
        ],
        rightSection: {
          themeColor: 'orange',
          moscot: 'moscotGridTableOrange',
          imageName: 'calendar',
        },
      },
      {
        id: 6,
        question: 'Which tools are you familiar with?',
        inputType: 'multiSelect',
        options: [
          {
            value: 'Airtable',
          },
          {
            value: 'Baserow',
          },
          {
            value: 'Monday',
          },
          {
            value: 'Softr',
          },
          {
            value: 'Notion',
          },
          {
            value: 'Coda',
          },
          {
            value: 'Retool',
          },
          {
            value: 'n8n',
          },
          {
            value: 'Zapier',
          },
          {
            value: 'Make',
          },
          {
            value: 'Other',
            resetOnSelect: true,
          },
          {
            value: 'None of the above',
            resetOnSelect: true,
          },
        ],
        minSelection: 3,
        rightSection: {
          themeColor: 'orange',
          moscot: 'moscotGridTableOrange',
          imageName: 'calendar',
        },
      },
      {
        id: 7,
        question: 'How do you want to build your database?',
        inputType: 'singleSelect',
        options: [
          {
            value: 'Build with AI',
            description: 'Describe what you want—AI will generate the structure for you',
            icon: 'ncAutoAwesome',
            iconColor: 'purple',
          },
          {
            value: 'Start with Template',
            description: 'Pick from ready-made setups tailored to popular use cases.',
            icon: 'ncLayout',
            iconColor: 'orange',
          },
          {
            value: 'Import Data',
            description: 'Bring your existing spreadsheets or databases into NocoDB.',
            icon: 'ncDownload',
            iconColor: 'green',
          },
          {
            value: 'Start from Scratch',
            description: 'Begin with a blank canvas and build your base your way.',
            icon: 'ncPlus',
            iconColor: 'brand',
          },
        ],
        rightSection: {
          themeColor: 'brand',
          moscot: 'moscotGridTableBrand',
          imageName: 'kanban',
        },
        iconSize: {
          width: 32,
          height: 32,
        },
      },
    ]
  })

  const questionsMap = computed(() => {
    return questions.value.reduce((acc, curr) => {
      acc[curr.id] = curr

      return acc
    }, {} as { [questionId: number]: OnboardingQuestionType })
  })

  const steps = computed(() => {
    return ncArrayFrom(Math.ceil(questions.value.length / 2)).map((_, index) => index + 1)
  })

  const stepper = useStepper(steps)

  const lastVisibleQuestionIndex = computed(() => {
    const index = (stepper.index.value + 1) * 2 - 1

    const question = questions.value[index]!

    if (!question || ncIsUndefined(formState.value[question.id])) {
      return index - 1
    }

    return index
  })

  const visibleQuestions = computed(() => {
    let currentVisibleQuestions: OnboardingQuestionType[] = []
    const index = (stepper.index.value + 1) * 2 - 1

    const question = questions.value[index]!

    if (!question || ncIsUndefined(formState.value[question.id])) {
      currentVisibleQuestions.push(questions.value[index - 1]!)

      return currentVisibleQuestions
    }

    currentVisibleQuestions.push(question)

    currentVisibleQuestions.unshift(questions.value[index - 1]!)

    return currentVisibleQuestions
  })

  const isFilledQuestionAnswer = (question: OnboardingQuestionType) => {
    return (
      !ncIsUndefined(formState.value[question.id]) &&
      (question.inputType === 'singleSelect'
        ? !!formState.value[question.id]
        : (formState.value[question.id] as string[]).length >= 1)
    )
  }

  const isFilledVisibleOptions = computed(() => {
    if (stepper.isLast.value) return true

    return visibleQuestions.value.every((question) => {
      return isFilledQuestionAnswer(question)
    })
  })

  const onInitOnboardingFlow = async () => {
    startedAt.value = Date.now()
  }

  const onSelectOption = (option: OnboardingOptionType, question: OnboardingQuestionType, currentStepQuestionIndex: number) => {
    let autoNavigateToNextQuestion = true

    if (question.inputType === 'singleSelect') {
      formState.value[question.id] = option.value
    }

    if (question.inputType === 'multiSelect') {
      const currentValue = (formState.value[question.id] || []) as string[]

      const resetOnSelectOptionValues =
        (ncIsFunction(question.options) ? question.options(formState.value) : question.options)
          ?.filter((op) => op.resetOnSelect)
          .map((op) => op.value) || []

      if (currentValue.includes(option.value)) {
        formState.value[question.id] = currentValue.filter((value) => value !== option.value)
        autoNavigateToNextQuestion = false
      } else {
        if (option.resetOnSelect) {
          autoNavigateToNextQuestion = false
          formState.value[question.id] = [option.value]
        } else {
          formState.value[question.id] = [
            ...currentValue.filter((value) => !resetOnSelectOptionValues.includes(value)),
            option.value,
          ]
        }
      }
    }

    const nextQuestionIndex = questions.value.findIndex((q) => q.id === question.id) + 1

    const nextQuestion = questions.value[nextQuestionIndex]

    if (!nextQuestion) return

    if (currentStepQuestionIndex % 2 !== 0) {
      /**
       * Don't auto navigate to next question if:
       * 1. It is the last question
       * 2. User has not selected any option
       * 3. Next question is already filled (maybe they have click back button)
       */
      if (stepper.isLast.value || !autoNavigateToNextQuestion || !nextQuestion || isFilledQuestionAnswer(nextQuestion)) return

      if (question.inputType === 'singleSelect') {
        ncDelay(500).then(() => {
          stepper.goToNext()
        })
      } else if (question.inputType === 'multiSelect') {
        if ((formState.value[question.id]?.length ?? 0) >= (question.minSelection ?? 1)) {
          ncDelay(500).then(() => {
            stepper.goToNext()
          })
        }
      }
    } else if (ncIsUndefined(formState.value[nextQuestion.id]) || question.id === 1) {
      formState.value[nextQuestion.id] = nextQuestion.inputType === 'singleSelect' ? '' : []
    }
  }

  /**
   * Format time taken in minutes (mm:ss)
   * @param startTime - Timestamp when the onboarding flow is started
   * @param endTime - Timestamp when the onboarding flow is completed
   * @returns Time taken in minutes (mm:ss)
   */
  function formatTimeSpent(startTime: number, endTime: number): string {
    const totalSeconds = Math.floor((endTime - startTime) / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60

    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  const onCompleteOnboardingFlow = async (skipped: boolean = false) => {
    /**
     * Time taken in minutes (mm:ss)
     */
    const timeTaken = formatTimeSpent(startedAt.value, Date.now())

    console.log('timeTaken', timeTaken, skipped)

    if (skipped) {
      showOnboardingFlowLocalState.value = false

      // window.location.reload()
    }
  }

  return {
    showOnboardingFlowLocalState,
    showOnboardingFlow,
    questions,
    questionsMap,
    formState,
    stepper,
    onInitOnboardingFlow,
    onCompleteOnboardingFlow,
    lastVisibleQuestionIndex,
    visibleQuestions,
    isFilledVisibleOptions,
    onSelectOption,
    isFilledQuestionAnswer,
    isEnabledOnboardingFlow,
  }
})
