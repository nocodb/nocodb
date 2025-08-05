export interface OnboardingOptionType {
  value: string
  description?: string
  icon?: IconMapKey | VNode
  iconColor?: string
  /**
   * `Undefined` will be considered as `iconMap`
   */
  iconType?: 'indexedStepProgressBar' | 'iconMap' | 'vNode'
  /**
   * Default `left`
   */
  iconPosition?: 'left' | 'right'
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
  description?: string
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
    fullWidth?: boolean
  }
  config?: {
    /**
     * Default value is 2
     */
    optionsInEachRow?: number
  }
  /**
   * Control visibility of the question
   * @returns true if the question should be visible, false otherwise
   */
  isVisible?: () => boolean
}

export const useOnboardingFlow = createSharedComposable(() => {
  const { $e } = useNuxtApp()

  const router = useRouter()

  const route = router.currentRoute

  const { appInfo } = useGlobal()

  const { isFeatureEnabled } = useBetaFeatureToggle()

  const isEnabledOnboardingFlow = computed(() => {
    return isFeatureEnabled(FEATURE_FLAG.SIGNUP_ONBOARDING_FLOW)
  })

  /**
   * If true, the onboarding flow will be shown in home page - `/`
   */
  const showOnboardingFlowLocalState = ref(true)

  const showOnboardingFlow = computed(() => {
    return isEnabledOnboardingFlow.value && showOnboardingFlowLocalState.value && route.value.name === 'index'
  })

  // Timestamp when the onboarding flow is started
  const startedAt = ref()

  const formState = ref<{ [questionId: string]: string | string[] }>({})

  const questions = computed<OnboardingQuestionType[]>(() => {
    const list: OnboardingQuestionType[] = [
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
            value: 'School',
            icon: 'ncGraduationCap',
            iconColor: 'purple',
          },
          {
            value: 'Non-Profit',
            icon: 'ncHeart',
            iconColor: 'pink',
          },
          {
            value: 'Personal',
            icon: 'ncUser',
            iconColor: 'green',
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
        config: {
          optionsInEachRow: 1,
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
        question: 'How many people work at your company?',
        inputType: 'singleSelect',
        options: ['0-10', '11-50', '51-250', '251-1000', '1000+'].reverse().map((value) => ({ value })),
        rightSection: {
          themeColor: 'orange',
          moscot: 'moscotCollaboration',
          imageName: 'gallery',
        },
      },
      {
        id: 4,
        question: 'How many people are in your team?',
        inputType: 'singleSelect',
        options: ['20+', '11-20', '1-10', 'Only me'].map((value) => ({ value })),
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
        question: 'Choose AI Tools That You Are Familiar With',
        description: 'Unlocks Free Access To NocoAI 🎉 ',
        inputType: 'multiSelect',
        options: [
          {
            value: 'OpenAI',
            icon: 'openai',
          },
          {
            value: 'Claude',
            icon: 'claude',
          },
          {
            value: 'Gemini',
            icon: 'ncLogoGeminiAiColored',
          },
          {
            value: 'Clay',
          },
          {
            value: 'Copy.ai',
          },
          {
            value: 'Manus.im',
            icon: 'ncLogoManusIm',
          },
          {
            value: 'Glean',
          },
          {
            value: 'Moveworks',
          },
          {
            value: 'Genspark.ai',
          },
          {
            value: 'Gamma.ai',
          },
          {
            value: 'Llamaindex',
          },
          {
            value: 'Granola',
          },
          {
            value: 'Langchain',
            icon: 'ncLogoLangchain',
          },
          {
            value: 'Huggingface',
            icon: 'ncLogoHuggingface',
          },
          {
            value: 'CrewAI',
            icon: 'ncLogoCrewAi',
          },
          {
            value: 'Loveable',
          },
          {
            value: 'Replit.ai',
            icon: 'ncLogoReplitAi',
          },
          {
            value: 'Bolt.new',
          },
          {
            value: 'None of the above',
            resetOnSelect: true,
            icon: h('div', {}, '🤨'),
            iconPosition: 'right',
          },
        ],
        minSelection: 3,
        rightSection: {
          themeColor: 'orange',
          moscot: 'moscotGridTableOrange',
          imageName: 'calendar',
        },
        iconSize: {
          width: 24,
          height: 24,
          fullWidth: true,
        },

        isVisible: () => {
          return true || (appInfo.value?.isCloud && !appInfo.value?.isOnPrem)
        },
      },
      /*
      // Commenting for now
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
          // TODO: @rameshmane7218 Enable this when we have templates
          // {
          //   value: 'Start with Template',
          //   description: 'Pick from ready-made setups tailored to popular use cases.',
          //   icon: 'ncLayout',
          //   iconColor: 'orange',
          // },
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
      */
    ]

    return list.filter((q) => {
      return q.isVisible?.() ?? true
    }) as OnboardingQuestionType[]
  })

  const questionsMap = computed(() => {
    return questions.value.reduce((acc, curr) => {
      acc[curr.id] = curr

      return acc
    }, {} as { [questionId: number]: OnboardingQuestionType })
  })

  const steps = computed(() => {
    return questions.value.map((q) => q.id)
  })

  const stepper = useStepper(steps)

  const lastVisibleQuestionIndex = computed(() => {
    // const index = (stepper.index.value + 1) * 2 - 1
    const index = stepper.index.value

    const question = questions.value[index]!

    // if (!question || ncIsUndefined(formState.value[question.id])) {
    //   return index - 1
    // }

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

  const visibleQuestion = computed(() => {
    return questions.value[stepper.index.value]!
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
    return isFilledQuestionAnswer(visibleQuestion.value)
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

    const nextQuestionIndex = currentStepQuestionIndex + 1

    const nextQuestion = questions.value[nextQuestionIndex]

    if (!nextQuestion) {
      return
    }

    /**
     * Don't auto navigate to next question if:
     * 1. It is the last question
     * 2. User has not selected any option
     * 3. Next question is already filled (maybe they have click back button)
     */
    if (stepper.isLast.value || !autoNavigateToNextQuestion || !nextQuestion || isFilledQuestionAnswer(nextQuestion)) return

    if (ncIsUndefined(formState.value[nextQuestion.id]) || question.id === 1) {
      formState.value[nextQuestion.id] = nextQuestion.inputType === 'singleSelect' ? '' : []
    }

    if (question.inputType === 'singleSelect') {
      ncDelay(500).then(() => {
        stepper.goToNext()
      })
    }
    /*
      else if (question.inputType === 'multiSelect') {
        if ((formState.value[question.id]?.length ?? 0) >= (question.minSelection ?? 1)) {
          ncDelay(500).then(() => {
            stepper.goToNext()
          })
        }
      }
      */
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

  const postCompleteOnboardingFlow = (skipped: boolean = false) => {
    const formattedQuestionAnswers = questions.value.map((q) => {
      const answer = formState.value[q.id]

      return {
        question: q.question,
        answer,
      }
    })

    const data = {
      timeTaken: formatTimeSpent(startedAt.value, Date.now()),
      skipped,
      questions: formattedQuestionAnswers,
    }

    $e('a:auth:onboarding-flow', data)
  }

  const onCompleteOnboardingFlow = async (skipped: boolean = false) => {
    postCompleteOnboardingFlow(skipped)

    showOnboardingFlowLocalState.value = false
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
    visibleQuestion,
    isFilledVisibleOptions,
    onSelectOption,
    isFilledQuestionAnswer,
    isEnabledOnboardingFlow,
  }
})
