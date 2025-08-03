export const useOnboardingFlow = createSharedComposable(() => {
  const { $e } = useNuxtApp()

  // Timestamp when the onboarding flow is started
  const startedAt = ref()

  const formStore = ref<{ [questionId: string]: string | string[] }>({})

  interface OnboardingOptionType {
    value: string
    icon?: IconMapKey
    iconColor?: string
    /**
     * `Undefined` will be considered as `iconMap`
     */
    iconType?: 'indexedStepProgressBar' | 'iconMap'
  }

  interface OnboardingRightSectionType {
    themeColor?: 'brand' | 'orange' | 'green' | 'purple' | 'pink'
    moscot?: 'welcome' | 'collaboration' | 'tableGrid'
    imageName?: 'grid' | 'gallery' | 'calendar' | 'kanban'
  }

  interface OnboardingQuestionType {
    id: number
    question: string
    inputType: 'singleSelect' | 'multiSelect'
    /**
     * MinSelection to enable next button if it is multiSelect input type
     */
    minSelection?: number
    options?: OnboardingOptionType[] | (() => OnboardingOptionType[])
    rightSection: OnboardingRightSectionType | (() => OnboardingRightSectionType)
  }

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
          moscot: 'welcome',
          imageName: 'grid',
        },
      },
      {
        id: 2,
        question: 'Hey! What do you plan on using NocoDB for?',
        inputType: 'singleSelect',
        options: () => {
          const firstQuestionAns = formStore.value[1]

          if (firstQuestionAns === 'personal') {
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

          if (firstQuestionAns === 'school') {
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
        rightSection: () => {
          let themeColor: OnboardingRightSectionType['themeColor'] = 'orange'

          if (formStore.value[1] === 'personal') {
            themeColor = 'green'
          }

          if (formStore.value[1] === 'school') {
            themeColor = 'purple'
          }

          return {
            themeColor,
            moscot: 'welcome',
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

  const onInitOnboardingFlow = async () => {
    startedAt.value = Date.now()
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

  const onCompleteOnboardingFlow = async () => {
    /**
     * Time taken in minutes (mm:ss)
     */
    const timeTaken = formatTimeSpent(startedAt.value, Date.now())

    console.log('timeTaken', timeTaken)
  }

  return { onInitOnboardingFlow, onCompleteOnboardingFlow, questions, questionsMap }
})
