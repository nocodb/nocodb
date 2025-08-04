export interface OnboardingOptionType {
  value: string
  icon?: IconMapKey
  iconColor?: string
  /**
   * `Undefined` will be considered as `iconMap`
   */
  iconType?: 'indexedStepProgressBar' | 'iconMap'
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
   * MinSelection to enable next button if it is multiSelect input type
   */
  minSelection?: number
  options?: OnboardingOptionType[] | ((state?: { [questionId: string]: string | string[] }) => OnboardingOptionType[])
  rightSection: OnboardingRightSectionType | ((state?: { [questionId: string]: string | string[] }) => OnboardingRightSectionType)
}

export const useOnboardingFlow = createSharedComposable(() => {
  const { $e } = useNuxtApp()

  const router = useRouter()

  const route = router.currentRoute

  /**
   * If true, the onboarding flow will be shown in home page - `/`
   */
  const showOnboardingFlowLocalState = ref(true)

  const showOnboardingFlow = computed(() => {
    return showOnboardingFlowLocalState.value && route.value.name === 'index'
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

    if (ncIsUndefined(formState.value[question.id])) {
      return index - 1
    }

    return index
  })

  const visibleQuestions = computed(() => {
    let currentVisibleQuestions: OnboardingQuestionType[] = []
    const index = (stepper.index.value + 1) * 2 - 1

    const question = questions.value[index]!
    if (ncIsUndefined(formState.value[question.id])) {
      currentVisibleQuestions.push(questions.value[index - 1]!)

      return currentVisibleQuestions
    }

    currentVisibleQuestions.push(question)

    currentVisibleQuestions.unshift(questions.value[index - 1]!)

    return currentVisibleQuestions
  })

  const onInitOnboardingFlow = async () => {
    startedAt.value = Date.now()
  }

  const onSelectOption = (option: OnboardingOptionType, question: OnboardingQuestionType, questionIndex: number) => {
    if (question.inputType === 'singleSelect') {
      formState.value[question.id] = option.value
    }

    if (question.inputType === 'multiSelect') {
      const currentValue = (formState.value[question.id] || []) as string[]

      if (currentValue.includes(option.value)) {
        formState.value[question.id] = currentValue.filter((value) => value !== option.value)
      } else {
        formState.value[question.id] = [...currentValue, option.value]
      }
    }

    const nextQuestion = questions.value[questionIndex + 1]

    if (!nextQuestion) return

    if (questionIndex % 2 !== 0) {
      if (!stepper.isLast) {
        if (question.inputType === 'singleSelect') {
          stepper.goToNext()
        } else if (question.inputType === 'multiSelect') {
          if ((formState.value[question.id]?.length ?? 0) >= (nextQuestion.minSelection ?? 0)) {
            stepper.goToNext()
          }
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
    showOnboardingFlow,
    questions,
    questionsMap,
    formState,
    stepper,
    onInitOnboardingFlow,
    onCompleteOnboardingFlow,
    lastVisibleQuestionIndex,
    visibleQuestions,
    onSelectOption,
  }
})
