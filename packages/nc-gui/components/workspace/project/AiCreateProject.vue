<script lang="ts" setup>
import { stringToViewTypeMap } from 'nocodb-sdk'
import type { NcProjectType } from '#imports'

interface Props {
  dialogShow: boolean
  aiMode: boolean | null
  workspaceId?: string
  baseType: NcProjectType
}

const props = withDefaults(defineProps<Props>(), {})

const emit = defineEmits(['update:dialogShow', 'update:aiMode', 'navigateToProject'])

enum SchemaPreviewTabs {
  TABLES_AND_VIEWS = 'TABLES_AND_VIEWS',
  RELATIONSHIP_DIAGRAM = 'RELATIONSHIP_DIAGRAM',
}

const loadingMessages = ['Suggesting tables', 'Suggesting fields', 'Suggesting links', 'Suggesting views']

const dialogShow = useVModel(props, 'dialogShow', emit)

const aiMode = useVModel(props, 'aiMode', emit)

const { workspaceId, baseType } = toRefs(props)

const { navigateToProject } = useGlobal()

const { $e } = useNuxtApp()

const { clone } = useUndoRedo()

const { aiIntegrationAvailable, aiError, aiLoading, createSchema, predictSchema } = useNocoAi()

const callFunction = ref<string | null>(null)

const isExpandedPredefiendBasePromts = ref<boolean>(false)

const aiPromptInputRef = ref<HTMLElement>()

const predefinedBasePrompts = computed(() => {
  return isExpandedPredefiendBasePromts.value ? aiBaseSchemaPrompts : aiBaseSchemaPrompts.slice(0, 7)
})

const leftPaneContentRef = ref<HTMLElement | null>(null)

const showBtnTopBorder = ref<boolean>(false)

enum ExpansionPanelKeys {
  additionalDetails = 'additionalDetails',
}

const expansionPanel = ref<ExpansionPanelKeys[]>([])

const handleUpdateExpansionPanel = (key: ExpansionPanelKeys) => {
  if (expansionPanel.value.includes(key)) {
    expansionPanel.value = expansionPanel.value.filter((k) => k !== key)
  } else {
    expansionPanel.value.push(key)
  }
}

const activeLoadingText = ref<string[]>([])

const activePreviewTab = ref<keyof typeof SchemaPreviewTabs>(SchemaPreviewTabs.TABLES_AND_VIEWS)

const previewExpansionPanel = ref<string[]>([])

const handleUpdatePreviewExpansionPanel = (key: string, disabled = false) => {
  if (disabled) return

  if (previewExpansionPanel.value.includes(key)) {
    previewExpansionPanel.value = previewExpansionPanel.value.filter((k) => k !== key)
  } else {
    previewExpansionPanel.value.push(key)
  }
}

enum AI_STEP {
  LOADING = 0,
  PROMPT = 1,
  MODIFY = 2,
}

const aiStep = ref(AI_STEP.PROMPT)

const defaultAiFormState = {
  prompt: '',
  onHoverTagPrompt: '',
  organization: '',
  industry: '',
  audience: '',
}

const oldAiFormState = ref<typeof defaultAiFormState | null>(null)

const aiFormState = ref(defaultAiFormState)

const isOldPromptChanged = computed(() => {
  return (
    aiFormState.value.prompt !== oldAiFormState.value?.prompt ||
    aiFormState.value.organization !== oldAiFormState.value?.organization ||
    aiFormState.value.industry !== oldAiFormState.value?.industry ||
    aiFormState.value.audience !== oldAiFormState.value?.audience
  )
})

const additionalDetails = [
  {
    title: 'Organisation',
    placeholder: '(optional)',
    key: 'organization',
  },
  {
    title: 'Industry',
    placeholder: '(optional)',
    key: 'industry',
  },
  {
    title: 'Audience',
    placeholder: '(optional)',
    key: 'audience',
  },
]

const predictedSchema = ref<any>()

const viewsGrouped = computed(() => {
  const grouped: Record<string, any[]> = {}
  predictedSchema.value.views.forEach((view: { table: string }) => {
    if (!grouped[view.table]) {
      grouped[view.table] = []
    }
    grouped[view.table].push(view)
  })
  return grouped
})

let timerId: NodeJS.Timeout

const onPredictSchema = async () => {
  callFunction.value = 'onPredictSchema'
  aiStep.value = AI_STEP.LOADING
  activeLoadingText.value = [''] // Initialize with an empty string for the first message
  let currentMessageIndex = 0
  let currentCharIndex = 0

  let prompt = `${aiFormState.value.prompt}`

  // Append optional information if provided
  if (aiFormState.value.organization?.trim()) {
    prompt += ` | Organization: ${aiFormState.value.organization}`
  }
  if (aiFormState.value.industry?.trim()) {
    prompt += ` | Industry: ${aiFormState.value.industry}`
  }
  if (aiFormState.value.audience?.trim()) {
    prompt += ` | Audience: ${aiFormState.value.audience}`
  }

  $e('a:base:ai:generate', prompt)

  try {
    const displayCharByChar = () => {
      const currentMessage = loadingMessages[currentMessageIndex]

      // If we are still processing the current message
      if (currentCharIndex < currentMessage.length) {
        // Update the current message in the array with the next character
        activeLoadingText.value[currentMessageIndex] += currentMessage[currentCharIndex]
        currentCharIndex++
      } else if (currentMessageIndex < loadingMessages.length - 1) {
        // Once the current message is done, move to the next message
        currentMessageIndex++
        currentCharIndex = 0
        // Add an empty string to the array to start the next message
        activeLoadingText.value.push('')
      } else {
        // All messages are displayed, stop the interval
        clearInterval(timerId)
      }
    }

    // Set interval to display characters one by one
    timerId = setInterval(displayCharByChar, 40) // Adjust the speed as needed (100ms)

    const res = await predictSchema(prompt)

    if (!res?.tables) {
      aiStep.value = AI_STEP.PROMPT
    } else {
      predictedSchema.value = res
      activePreviewTab.value = SchemaPreviewTabs.TABLES_AND_VIEWS

      previewExpansionPanel.value = ((predictedSchema.value || {}).tables || []).map((t) => t?.title).filter(Boolean)
      aiStep.value = AI_STEP.MODIFY
      oldAiFormState.value = clone(aiFormState.value)
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
    aiStep.value = AI_STEP.PROMPT
  } finally {
    activeLoadingText.value = []
    clearInterval(timerId)
  }
}

const onExcludeTable = (table: any) => {
  table.excluded = !table.excluded
  if (table.excluded) {
    predictedSchema.value.views.forEach((view: any) => {
      if (view.table === table.title) {
        view.excluded = true
      }
    })
  } else {
    predictedSchema.value.views.forEach((view: any) => {
      if (view.table === table.title) {
        view.excluded = false
      }
    })
  }
}

const onExcludeView = (view: any) => {
  view.excluded = !view.excluded

  if (!view.excluded) {
    const table = predictedSchema.value.tables.find((table: { title: string }) => table.title === view.table)
    if (table) {
      table.excluded = false
    }
  }
}

const finalSchema = computed(() => {
  const schema = {
    title: predictedSchema.value.title,
    tables: predictedSchema.value.tables.filter((table: any) => !table.excluded),
    relationships: predictedSchema.value.relationships.filter((relationship: { from: string; to: string }) => {
      const fromTable = predictedSchema.value.tables.find((table: { title: string }) => table.title === relationship.from)
      const toTable = predictedSchema.value.tables.find((table: { title: string }) => table.title === relationship.to)
      return !fromTable.excluded && !toTable.excluded
    }),
    views: predictedSchema.value.views.filter((view: any) => !view.excluded),
  }
  return schema
})

const previewTabs = computed(() => {
  return [
    {
      title: 'Tables & Views',
      key: SchemaPreviewTabs.TABLES_AND_VIEWS,
    },
    {
      title: 'Relationship Diagram',
      key: SchemaPreviewTabs.RELATIONSHIP_DIAGRAM,
    },
  ]
})

const onCreateSchema = async () => {
  callFunction.value = 'onCreateSchema'

  try {
    const base = await createSchema(finalSchema.value)

    if (base?.id) {
      navigateToProject({
        baseId: base.id!,
        workspaceId: isEeUI ? workspaceId.value : 'nc',
        type: baseType.value,
      })

      dialogShow.value = false
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
    aiStep.value = AI_STEP.PROMPT
  }
}

const handleUpdatePrompt = (description: string) => {
  if (!aiIntegrationAvailable.value || (aiLoading.value && callFunction.value === 'onPredictSchema')) return

  aiFormState.value.prompt = description
}

const onToggleShowMore = () => {
  isExpandedPredefiendBasePromts.value = !isExpandedPredefiendBasePromts.value
}

const resetToDefault = () => {
  aiMode.value = null
  aiStep.value = AI_STEP.PROMPT
  oldAiFormState.value = null
  aiFormState.value = defaultAiFormState
  isExpandedPredefiendBasePromts.value = false
  expansionPanel.value = []
}

watch(dialogShow, async (n, o) => {
  if (n === o && !n) return

  resetToDefault()
})

watch([() => expansionPanel.value.length, () => isExpandedPredefiendBasePromts.value], () => {
  // Wait for collapse transition
  setTimeout(() => {
    showBtnTopBorder.value = leftPaneContentRef.value?.scrollHeight > leftPaneContentRef.value?.parentElement?.clientHeight
  }, 500)
})

onMounted(() => {
  setTimeout(async () => {
    await nextTick()

    aiPromptInputRef.value?.focus()
  }, 5)

  until(() => leftPaneContentRef.value)
    .toBeTruthy()
    .then(() => {
      showBtnTopBorder.value = leftPaneContentRef.value?.scrollHeight > leftPaneContentRef.value?.parentElement?.clientHeight
    })
})
</script>

<template>
  <div class="h-full">
    <div class="flex items-center gap-2.5 px-4 py-2 border-b-1 border-purple-100">
      <div class="flex-1 flex items-center gap-3 text-nc-content-purple-dark">
        <GeneralIcon icon="ncAutoAwesome" class="flex-none h-5 w-5 !text-current" />
        <div class="text-base leading-8 font-bold">{{ $t('title.nocoAiBaseBuilder') }}</div>
      </div>

      <NcButton size="small" type="text" @click.stop="dialogShow = false">
        <GeneralIcon icon="close" class="text-gray-600" />
      </NcButton>
    </div>

    <div class="h-[calc(100%_-_49px)] flex">
      <div
        ref="leftPaneContentRef"
        class="w-[480px] h-full relative flex flex-col nc-scrollbar-thin border-r-1 border-purple-100"
      >
        <!-- create base config panel -->
        <div class="flex-1 p-6 flex flex-col gap-6">
          <div class="text-sm font-bold text-nc-content-purple-dark">Tell us more about your usecase</div>
          <div class="flex flex-wrap gap-3 max-h-[188px] nc-scrollbar-thin overflow-visible">
            <!-- Predefined tags -->

            <template v-for="prompt of predefinedBasePrompts" :key="prompt.tag">
              <a-tag
                class="nc-ai-base-schema-tag nc-ai-suggested-tag relative"
                :class="{
                  'nc-selected': prompt.description === aiFormState.prompt.trim(),
                  'nc-disabled': !aiIntegrationAvailable || (aiLoading && callFunction === 'onPredictSchema'),
                }"
                :disabled="!aiIntegrationAvailable || (aiLoading && callFunction === 'onPredictSchema')"
                @mouseover="aiFormState.onHoverTagPrompt = aiIntegrationAvailable ? prompt.description : ''"
                @mouseleave="aiFormState.onHoverTagPrompt = ''"
                @click="handleUpdatePrompt(prompt.description)"
              >
                <div class="flex flex-row items-center gap-1 py-1 text-sm">
                  <div>{{ prompt.tag }}</div>
                </div>
                <div
                  v-if="prompt.description === aiFormState.prompt.trim()"
                  class="bg-nc-fill-purple-dark text-white rounded-full absolute -right-[3px] -top-[4px] h-3 w-3 grid place-items-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <path
                      d="M6.66659 2L2.99992 5.66667L1.33325 4"
                      stroke="white"
                      stroke-width="1.33333"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </div>
              </a-tag>
            </template>

            <NcButton size="xs" type="text" icon-position="right" class="nc-show-more-tags-btn" @click="onToggleShowMore">
              {{ isExpandedPredefiendBasePromts ? $t('general.showLess') : $t('general.showMore') }}

              <template #icon>
                <GeneralIcon :icon="isExpandedPredefiendBasePromts ? 'minusCircle' : 'plusCircle'" class="opacity-80" />
              </template>
            </NcButton>
          </div>
          <div>
            <a-textarea
              ref="aiPromptInputRef"
              :value="aiFormState.onHoverTagPrompt || aiFormState.prompt"
              placeholder="Type something..."
              class="!w-full !min-h-[120px] !rounded-lg mt-2 overflow-y-auto nc-scrollbar-thin nc-input-shadow nc-ai-input"
              size="middle"
              :disabled="!aiIntegrationAvailable || (aiLoading && callFunction === 'onPredictSchema')"
              @update:value="aiFormState.prompt = $event"
            />
          </div>

          <a-collapse v-model:active-key="expansionPanel" ghost class="flex-1 flex flex-col">
            <template #expandIcon> </template>
            <a-collapse-panel :key="ExpansionPanelKeys.additionalDetails" collapsible="disabled">
              <template #header>
                <div class="flex">
                  <NcButton
                    size="small"
                    type="text"
                    icon-position="right"
                    class="-ml-[7px]"
                    @click="handleUpdateExpansionPanel(ExpansionPanelKeys.additionalDetails)"
                  >
                    {{ $t('title.additionalDetails') }}
                    <template #icon>
                      <GeneralIcon
                        icon="arrowDown"
                        class="transform transition-all opacity-80"
                        :class="{
                          'rotate-180': expansionPanel.includes(ExpansionPanelKeys.additionalDetails),
                        }"
                      />
                    </template>
                  </NcButton>
                </div>
              </template>

              <div class="flex flex-col gap-6 pt-6">
                <div v-for="field of additionalDetails" :key="field.title" class="flex items-center gap-2">
                  <div class="min-w-[120px]">{{ field.title }}</div>
                  <a-input
                    v-model:value="aiFormState[field.key]"
                    class="nc-input-sm nc-input-shadow nc-ai-input"
                    hide-details
                    :placeholder="field.placeholder"
                    :disabled="!aiIntegrationAvailable || (aiLoading && callFunction === 'onPredictSchema')"
                  />
                </div>
              </div>
            </a-collapse-panel>
          </a-collapse>
        </div>
        <div
          class="sticky bottom-0 w-full bg-white px-6 pt-3 pb-6 border-t-1 flex flex-col gap-3"
          :class="{
            'border-nc-border-gray-medium': showBtnTopBorder,
            'border-transparent': !showBtnTopBorder,
          }"
        >
          <div v-if="aiError" class="w-full flex items-start gap-3 bg-nc-bg-red-light rounded-lg p-4">
            <GeneralIcon icon="ncInfoSolid" class="flex-none !text-nc-content-red-dark w-6 h-6" />

            <div class="w-[calc(100%_-_36px)] flex flex-col gap-1">
              <div class="font-bold text-base text-nc-content-gray">Something went wrong</div>
              <NcTooltip class="truncate text-sm text-nc-content-gray-subtle" show-on-truncate-only>
                <template #title>
                  {{ aiError }}
                </template>
                {{ aiError }}
              </NcTooltip>
            </div>
          </div>
          <div v-if="aiIntegrationAvailable" class="flex items-center gap-3">
            <NcButton
              size="small"
              :type="aiStep !== AI_STEP.MODIFY || isOldPromptChanged ? 'primary' : 'secondary'"
              theme="ai"
              class="w-1/2"
              :disabled="!aiFormState.prompt?.trim() || (aiLoading && callFunction === 'onPredictSchema')"
              :loading="aiLoading && callFunction === 'onPredictSchema'"
              @click="onPredictSchema"
            >
              <template #icon>
                <GeneralIcon icon="ncAutoAwesome" class="h-4 w-4" />
              </template>
              {{ $t('labels.suggestTablesViews') }}
            </NcButton>
            <NcButton
              v-e="['a:base:ai:create']"
              type="primary"
              size="small"
              theme="ai"
              class="w-1/2"
              :disabled="
                aiStep !== AI_STEP.MODIFY ||
                finalSchema?.tables?.length === 0 ||
                (aiLoading && callFunction === 'onCreateSchema') ||
                isOldPromptChanged
              "
              :loading="aiLoading && callFunction === 'onCreateSchema'"
              @click="onCreateSchema"
            >
              {{ $t('activity.createProject') }}
            </NcButton>
          </div>
          <AiIntegrationNotFound v-else class="justify-between" @on-navigate="dialogShow = false">
            <template #icon>
              <GeneralIcon icon="alertTriangleSolid" class="flex-none !text-nc-content-orange-medium w-6 h-6" />
            </template>
            <template #title>
              <div class="text-base font-bold text-nc-content-gray">{{ $t('title.aiIntegrationMissing') }}</div>
            </template>
            <template #description>
              <div class="text-sm text-nc-content-gray-subtle">{{ $t('title.noAiIntegrationsHaveBeenAdded') }}</div>
            </template>
          </AiIntegrationNotFound>
        </div>
      </div>
      <div class="w-[calc(100%_-_480px)] h-full p-6 nc-scrollbar-thin flex flex-col gap-6">
        <!-- create base preview panel -->

        <template v-if="aiStep === AI_STEP.LOADING || aiStep === AI_STEP.PROMPT">
          <div v-if="aiStep === AI_STEP.LOADING" class="text-sm font-bold text-nc-content-purple-dark">
            {{ $t('title.generatingBaseTailoredToYourRequirement') }}
          </div>
          <div v-else class="text-sm font-bold text-nc-content-purple-dark">{{ $t('labels.preview') }}</div>

          <template v-if="aiStep === AI_STEP.LOADING">
            <div
              v-for="(loadingText, idx) of activeLoadingText"
              :key="idx"
              class="text-sm text-nc-content-purple-light flex items-center"
            >
              {{ loadingText }}
              <div v-if="loadingText.length === loadingMessages[idx]?.length" class="nc-animate-dots"></div>
            </div>

            <div class="rounded-xl border-1 border-purple-100">
              <div
                v-for="(_row, idx) of ncArrayFrom(7)"
                :key="idx"
                class="px-3 py-2 flex items-center gap-2 border-b-1 border-purple-100 !last-of-type:border-b-0"
              >
                <div class="flex-1 flex items-center gap-2">
                  <a-skeleton-input
                    :active="aiStep === AI_STEP.LOADING"
                    class="!w-4 !h-4 !rounded overflow-hidden !bg-nc-bg-purple-light"
                  />
                  <a-skeleton-input
                    :active="aiStep === AI_STEP.LOADING"
                    class="!h-4 !rounded overflow-hidden !bg-nc-bg-purple-light"
                    :class="{
                      '!w-[133px]': idx % 2 === 0,
                      '!w-[90px]': idx % 2 !== 0,
                    }"
                  />
                </div>
                <div class="grid place-items-center h-6 w-6">
                  <GeneralIcon icon="arrowDown" class="text-nc-content-purple-light" />
                </div>
              </div>
            </div>
          </template>
          <div v-else class="flex-1 grid place-items-center">
            <GeneralIcon icon="ncAutoAwesome" class="h-[188px] w-[188px] !text-purple-100" />
          </div>
        </template>
        <template v-if="aiStep === AI_STEP.MODIFY">
          <div class="text-sm font-bold text-nc-content-purple-dark">{{ $t('title.hereYourCrmBase') }}</div>

          <template v-if="predictedSchema?.tables">
            <AiWizardCard
              v-if="aiMode"
              v-model:active-tab="activePreviewTab"
              :tabs="previewTabs"
              class="!rounded-xl flex-1 flex flex-col min-w-[320px]"
              content-class-name="flex-1 flex flex-col"
            >
              <template #tabContent>
                <a-collapse
                  v-if="activePreviewTab === SchemaPreviewTabs.TABLES_AND_VIEWS"
                  v-model:active-key="previewExpansionPanel"
                  class="nc-schema-preview-table flex flex-col"
                >
                  <template #expandIcon> </template>

                  <a-collapse-panel v-for="table in predictedSchema.tables" :key="table.title" collapsible="disabled">
                    <template #header>
                      <div
                        class="w-full flex items-center px-4 py-2"
                        @click="handleUpdatePreviewExpansionPanel(table.title, !viewsGrouped[table.title]?.length)"
                      >
                        <div class="flex-1 flex items-center gap-3 text-nc-content-purple-dark">
                          <NcCheckbox :checked="!table.excluded" theme="ai" @click.stop="onExcludeTable(table)" />

                          <GeneralIcon icon="table" class="flex-none !h-4 opacity-85" />

                          <NcTooltip show-on-truncate-only class="truncate text-sm font-weight-500">
                            <template #title>
                              {{ table.title }}
                            </template>
                            {{ table.title }}
                          </NcTooltip>
                        </div>
                        <NcButton
                          size="xs"
                          type="text"
                          theme="ai"
                          icon-only
                          class="!px-0 !h-6 !w-6 !min-w-6"
                          :class="{
                            hidden: !viewsGrouped[table.title]?.length,
                          }"
                        >
                          <template #icon>
                            <GeneralIcon
                              icon="arrowDown"
                              class="transform transition-all opacity-80"
                              :class="{
                                'rotate-180': previewExpansionPanel.includes(table.title),
                              }"
                            />
                          </template>
                        </NcButton>
                      </div>
                    </template>

                    <div class="w-full flex flex-col">
                      <!-- Views -->
                      <template v-for="view in viewsGrouped[table.title]" :key="view.title">
                        <div class="w-full pl-11 pr-4 py-2 flex items-center gap-3">
                          <NcCheckbox :checked="!view.excluded" theme="ai" @click.stop="onExcludeView(view)" />

                          <GeneralViewIcon :meta="{ type: stringToViewTypeMap[view.type] }" />

                          <NcTooltip show-on-truncate-only class="truncate text-sm font-weight-500">
                            <template #title>
                              {{ view.title }}
                            </template>
                            {{ view.title }}
                          </NcTooltip>

                          <div class="flex-1"></div>
                        </div>
                      </template>
                    </div>
                  </a-collapse-panel>
                </a-collapse>
                <div v-else class="flex-1 flex">
                  <AiErdView :ai-base-schema="finalSchema" class="flex-1" />
                </div>
              </template>
            </AiWizardCard>
          </template>
        </template>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
:deep(.ant-collapse-header) {
  @apply !p-0 flex items-center !cursor-default children:first:flex;
}

:deep(.nc-schema-preview-table .ant-collapse-header) {
  @apply !cursor-pointer;
}

:deep(.ant-collapse-icon-position-right > .ant-collapse-item > .ant-collapse-header .ant-collapse-arrow) {
  @apply !right-0;
}

:deep(.ant-collapse-content-box) {
  @apply !p-0;
}

:deep(.ant-collapse.nc-schema-preview-table) {
  @apply !border-0 bg-transparent overflow-hidden;

  .ant-collapse-item {
    @apply border-b-purple-100 last:(border-b-0 !rounded-b-lg overflow-hidden);

    .ant-collapse-content {
      @apply border-0;
    }
  }
}

:deep(.nc-schema-preview-table .nc-checkbox > .ant-checkbox) {
  @apply !mr-0;
}

:deep(.ant-tag.nc-ai-base-schema-tag) {
  &.nc-selected {
    @apply !bg-nc-bg-purple-dark;
  }
}

.nc-show-more-tags-btn {
  @apply !bg-gray-100 !hover:bg-gray-200;
}
</style>
