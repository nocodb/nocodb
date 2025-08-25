import boltNewLogo from '~/assets/img/logos/bolt-new.png'
import clayLogo from '~/assets/img/logos/clay.png'
import clioLogo from '~/assets/img/logos/clio.png'
import copyAiLogo from '~/assets/img/logos/copy-ai.png'
import docusignLogo from '~/assets/img/logos/docusign.png'
import gamaAiLogo from '~/assets/img/logos/gamma-ai.png'
import gensparkAiLogo from '~/assets/img/logos/genspark-ai.png'
import gleanLogo from '~/assets/img/logos/glean.png'
import granolaLogo from '~/assets/img/logos/granola.png'
import iconcladLogo from '~/assets/img/logos/iconclad.png'
import llamaindexLogo from '~/assets/img/logos/llamaindex.png'
import loveableLogo from '~/assets/img/logos/loveable.png'
import moveworksLogo from '~/assets/img/logos/moveworks.png'
import zohoLogo from '~/assets/img/logos/zoho.png'

export interface OnboardingOptionIconType {
  icon?: IconMapKey | VNode
  iconColor?: string
  /**
   * @default 'left'
   */
  iconPosition?: 'left' | 'right'
  /**
   * `Undefined` will be considered as `iconMap`
   */
  iconType?: 'indexedStepProgressBar' | 'iconMap' | 'vNode' | 'image'
  /**
   * If `iconType` is `image`, then `img` is required
   * Add only imported image else full path required
   */
  img?: string
}

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
   * Allow multiple icons to be shown in the option
   */
  icons?: OnboardingOptionIconType[]
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
  key?: string
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

  const { appInfo, user, signedIn } = useGlobal()

  const { isSharedBase, isSharedErd } = storeToRefs(useBase())

  const { updateUserProfile } = useUsers()

  const isEnabledOnboardingFlow = computed(() => {
    return (
      !appInfo.value.disableOnboardingFlow &&
      !ncIsPlaywright() &&
      signedIn.value &&
      !isSharedBase.value &&
      !isSharedErd.value &&
      !isSharedViewRoute(route.value) &&
      !isSharedFormViewRoute(route.value) &&
      !isPublicRoute(route.value)
    )
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

  const isSubmitting = ref(false)

  /**
   * @Note - Don't change `id` or `key` as this will be used in tele payload
   */
  const questions = computed<OnboardingQuestionType[]>(() => {
    const list: OnboardingQuestionType[] = [
      {
        id: 1,
        question: 'Hey! What do you plan on using NocoDB for?',
        inputType: 'singleSelect',
        options: [
          {
            value: 'Work',
            icons: [
              {
                icon: 'ncBriefcase',
                iconColor: 'orange',
              },
            ],
          },
          {
            value: 'School',
            icons: [
              {
                icon: 'ncGraduationCap',
                iconColor: 'purple',
              },
            ],
          },
          {
            value: 'Non-Profit',
            icons: [
              {
                icon: 'ncHeart',
                iconColor: 'pink',
              },
            ],
          },
          {
            value: 'Personal',
            icons: [
              {
                icon: 'ncUser',
                iconColor: 'green',
              },
            ],
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
        question: 'Which department are you in?',
        inputType: 'singleSelect',
        options: [
          {
            value: 'Human Resources',
            iconPosition: 'right',
            icons: [
              {
                icon: 'ncLogoBambooHrColored',
              },
              {
                icon: 'ncLogoWorkdayColoredOutline',
              },
              {
                icon: 'lever',
              },
            ],
          },
          {
            value: 'Marketing',
            iconPosition: 'right',
            icons: [
              {
                icon: 'hubspot',
              },
              {
                icon: 'ncLogoMailchimpColored',
              },
              {
                icon: 'ncLogoHootsuiteColored',
              },
            ],
          },
          {
            value: 'Sales',
            iconPosition: 'right',
            icons: [
              {
                icon: 'ncLogoGongColored',
              },
              {
                icon: 'ncLogoPipedriveColored',
              },
              {
                icon: 'salesforce',
              },
            ],
          },
          {
            value: 'Product',
            iconPosition: 'right',
            icons: [
              {
                icon: 'ncLogoJiraColored',
              },
              {
                icon: 'ncLogoNotionColored',
              },
              {
                icon: 'ncLogoProductBoardColored',
              },
            ],
          },
          {
            value: 'Finance',
            iconPosition: 'right',
            icons: [
              {
                iconType: 'image',
                img: zohoLogo,
              },
              {
                icon: 'ncLogoXeroColored',
              },
              {
                icon: 'ncLogoQuickbooksColored',
              },
            ],
          },
          {
            value: 'Design',
            iconPosition: 'right',
            icons: [
              {
                icon: 'ncLogoMiroColored',
              },
              {
                icon: 'ncLogoSketchColored',
              },
              {
                icon: 'ncLogoFigmaColored',
              },
            ],
          },
          {
            value: 'Data Analyst',
            iconPosition: 'right',
            icons: [
              {
                icon: 'ncLogoLookerColored',
              },
              {
                icon: 'ncLogoPowerLogoColored',
              },
              {
                icon: 'tableau',
              },
            ],
          },
          {
            value: 'Engineering',
            iconPosition: 'right',
            icons: [
              {
                icon: 'ncLogoDockerColored',
              },
              {
                icon: 'ncLogoJiraColored',
              },
              {
                icon: 'ncLogoGithubColored',
              },
            ],
          },
          {
            value: 'Legal',
            iconPosition: 'right',
            icons: [
              {
                iconType: 'image',
                img: iconcladLogo,
              },
              {
                iconType: 'image',
                img: clioLogo,
              },
              {
                iconType: 'image',
                img: docusignLogo,
              },
            ],
          },
          {
            value: 'Customer Support',
            iconPosition: 'right',
            icons: [
              {
                icon: 'ncLogoFreshdeskColored',
              },
              {
                icon: 'ncLogoIntercomColored',
              },
              {
                icon: 'ncLogoZendeskColored',
              },
            ],
          },
          {
            value: 'Operations',
            iconPosition: 'right',
            icons: [
              {
                icon: 'ncLogoClickupColored',
              },
              {
                icon: 'ncLogoNotionColored',
              },
              {
                icon: 'ncLogoAsanaColored',
              },
            ],
          },
        ],
        rightSection: {
          themeColor: 'orange',
          moscot: 'moscotWelcomeOrange',
          imageName: 'grid',
        },
        iconSize: {
          width: 24,
          height: 24,
          fullWidth: true,
        },
        config: {
          optionsInEachRow: 1,
        },
      },
      {
        id: 4,
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
        id: 5,
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
        id: 6,
        question: 'How experienced are you with app building?',
        inputType: 'singleSelect',
        options: [
          {
            value: 'Beginner',
            icons: [
              {
                iconType: 'indexedStepProgressBar',
              },
            ],
          },
          {
            value: 'Intermediate',
            icons: [
              {
                iconType: 'indexedStepProgressBar',
              },
            ],
          },
          {
            value: 'Advanced',
            icons: [
              {
                iconType: 'indexedStepProgressBar',
              },
            ],
          },
          {
            value: 'Expert',
            icons: [
              {
                iconType: 'indexedStepProgressBar',
              },
            ],
          },
        ],
        rightSection: {
          themeColor: 'orange',
          moscot: 'moscotGridTableOrange',
          imageName: 'calendar',
        },
      },
      {
        id: 7,
        key: 'ai',
        question: 'Choose AI Tools That You Are Familiar With',
        description: 'Unlocks Free Access To NocoAI 🎉 ',
        inputType: 'multiSelect',
        options: [
          {
            value: 'OpenAI',
            icons: [
              {
                icon: 'openai',
              },
            ],
          },
          {
            value: 'Claude',
            icons: [
              {
                icon: 'claude',
              },
            ],
          },
          {
            value: 'Gemini',
            icons: [
              {
                icon: 'ncLogoGeminiAiColored',
              },
            ],
          },
          {
            value: 'Clay',
            icons: [
              {
                iconType: 'image',
                img: clayLogo,
              },
            ],
          },
          {
            value: 'Copy.ai',
            icons: [
              {
                iconType: 'image',
                img: copyAiLogo,
              },
            ],
          },
          {
            value: 'Manus.im',
            icons: [
              {
                icon: 'ncLogoManusIm',
              },
            ],
          },
          {
            value: 'Glean',
            icons: [
              {
                iconType: 'image',
                img: gleanLogo,
              },
            ],
          },
          {
            value: 'Moveworks',
            icons: [
              {
                iconType: 'image',
                img: moveworksLogo,
              },
            ],
          },
          {
            value: 'Genspark.ai',
            icons: [
              {
                iconType: 'image',
                img: gensparkAiLogo,
              },
            ],
          },
          {
            value: 'Gamma.ai',
            icons: [
              {
                iconType: 'image',
                img: gamaAiLogo,
              },
            ],
          },
          {
            value: 'Llamaindex',
            icons: [
              {
                iconType: 'image',
                img: llamaindexLogo,
              },
            ],
          },
          {
            value: 'Granola',
            icons: [
              {
                iconType: 'image',
                img: granolaLogo,
              },
            ],
          },
          {
            value: 'Langchain',
            icons: [
              {
                icon: 'ncLogoLangchain',
              },
            ],
          },
          {
            value: 'Huggingface',
            icons: [
              {
                icon: 'ncLogoHuggingface',
              },
            ],
          },
          {
            value: 'CrewAI',
            icons: [
              {
                icon: 'ncLogoCrewAi',
              },
            ],
          },
          {
            value: 'Loveable',
            icons: [
              {
                iconType: 'image',
                img: loveableLogo,
              },
            ],
          },
          {
            value: 'Replit.ai',
            icons: [
              {
                icon: 'ncLogoReplitAi',
              },
            ],
          },
          {
            value: 'Bolt.new',
            icons: [
              {
                iconType: 'image',
                img: boltNewLogo,
              },
            ],
          },
          {
            value: 'None of the above',
            resetOnSelect: true,
            icons: [
              {
                iconType: 'vNode',
                icon: h(
                  'div',
                  {
                    style: {
                      fontSize: '20px',
                    },
                  },
                  '🤨',
                ),
              },
            ],
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
      // Commenting for now, we need this later
      {
        id: 8,
        question: 'How do you want to build your database?',
        inputType: 'singleSelect',
        options: [
          {
            value: 'Build with AI',
            description: 'Describe what you want—AI will generate the structure for you',
            icons: [
              {
                icon: 'ncAutoAwesome',
                iconColor: 'purple',
              },
            ],
          },
          // TODO: @rameshmane7218 Enable this when we have templates
          // {
          //   value: 'Start with Template',
          //   description: 'Pick from ready-made setups tailored to popular use cases.',
          //   icons: [
          //     {
          //       icon: 'ncLayout',
          //       iconColor: 'orange',
          //     },
          //   ],
          // },
          {
            value: 'Import Data',
            description: 'Bring your existing spreadsheets or databases into NocoDB.',
            icons: [
              {
                icon: 'ncDownload',
                iconColor: 'green',
              },
            ],
          },
          {
            value: 'Start from Scratch',
            description: 'Begin with a blank canvas and build your base your way.',
            icons: [
              {
                icon: 'ncPlus',
                iconColor: 'brand',
              },
            ],
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
    return stepper.index.value
  })

  const visibleQuestions = computed(() => {
    const currentVisibleQuestions: OnboardingQuestionType[] = []
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

    if (ncIsUndefined(formState.value[nextQuestion.id]) || question.id === 1) {
      formState.value[nextQuestion.id] = nextQuestion.inputType === 'singleSelect' ? '' : []
    }

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

  const formatForSubmission = (payload: {
    timeTaken: string
    skipped: boolean
    questions: {
      question: string
      answer: string | string[]
      key: string
    }[]
  }) => {
    return {
      time_taken: payload.timeTaken,
      skipped: payload.skipped,
      ...payload.questions.reduce((acc, curr) => {
        acc[`onboarding_q_${curr.key}`] = curr.question
        acc[`onboarding_a_${curr.key}`] = Array.isArray(curr.answer) ? curr.answer.join(':') : curr.answer
        return acc
      }, {} as Record<string, string>),
    }
  }

  const postCompleteOnboardingFlow = (skipped: boolean = false) => {
    const formattedQuestionAnswers = questions.value.map((q) => {
      const answer = formState.value[q.id]

      return {
        key: q.key ?? q.id,
        question: q.question,
        answer,
      }
    })

    const data = {
      timeTaken: formatTimeSpent(startedAt.value, Date.now()),
      skipped,
      questions: formattedQuestionAnswers,
    }

    $e('a:auth:onboarding-flow', undefined, formatForSubmission(data))
  }

  const resetOnboardingFlow = () => {
    showOnboardingFlowLocalState.value = false
    formState.value = {}
    stepper.index.value = 0
    startedAt.value = undefined
  }

  const onCompleteOnboardingFlow = async (skipped: boolean = false) => {
    isSubmitting.value = true

    postCompleteOnboardingFlow(skipped)

    /**
     * Mark `is_new_user` as `false` in user object after onboarding flow is completed
     * So that user will not see onboarding flow again
     */
    try {
      await updateUserProfile({
        attrs: {
          is_new_user: false,
        },
      })
    } catch (e) {
      console.error(e)
    } finally {
      resetOnboardingFlow()
      isSubmitting.value = false
    }

    if (route.value.query?.continueAfterOnboardingFlow) {
      await navigateTo(route.value.query.continueAfterOnboardingFlow as string)
    }
  }

  watch(
    () => user.value?.is_new_user,
    (isNewUser) => {
      if (!isNewUser || !isEnabledOnboardingFlow.value) {
        if (showOnboardingFlowLocalState.value) {
          resetOnboardingFlow()
        }

        return
      }

      showOnboardingFlowLocalState.value = true

      // If current route is root route then no need to navigate to root route again
      if (route.value.name === 'index') {
        return
      }

      const continueAfterOnboardingFlow = route.value.query.continueAfterOnboardingFlow ?? route.value.fullPath

      navigateTo({
        path: '/',
        query: {
          continueAfterOnboardingFlow,
        },
      })
    },
    {
      immediate: true,
    },
  )

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
