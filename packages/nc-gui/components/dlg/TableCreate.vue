<script setup lang="ts">
import type { TableType } from 'nocodb-sdk'

enum TableWizardTabs {
  AUTO_SUGGESTIONS = 'AUTO_SUGGESTIONS',
  PROMPT = 'PROMPT',
}

const props = defineProps<{
  modelValue: boolean
  sourceId: string
  baseId: string
}>()

const emit = defineEmits(['update:modelValue', 'create'])

const dialogShow = useVModel(props, 'modelValue', emit)

const isAdvanceOptVisible = ref(false)

const inputEl = ref<HTMLInputElement>()

const { addTab } = useTabs()

const workspaceStore = useWorkspace()

const { activeWorkspaceId } = storeToRefs(workspaceStore)

const { isMysql, isMssql, isPg, isSnowflake } = useBase()

const { loadProjectTables, addTable } = useTablesStore()

const { refreshCommandPalette } = useCommandPalette()

const onTableCreate = async (table: TableType) => {
  // await loadProject(props.baseId)

  await addTab({
    id: table.id as string,
    title: table.title,
    type: TabType.TABLE,
    baseId: props.baseId,
    // sourceId: props.sourceId,
  })

  addTable(props.baseId, table)
  await loadProjectTables(props.baseId, true)

  emit('create', table)
  dialogShow.value = false
}

const { table, createTable, generateUniqueTitle, tables, base, openTable } = useTableNew({
  onTableCreate,
  sourceId: props.sourceId,
  baseId: props.baseId,
})

const initTitle = ref<string>()

const onAiTableCreate = async (table: TableType) => {
  await onTableCreate(table)
  await openTable(table)
}

const { aiIntegrationAvailable, aiLoading, aiError, generateTables, predictNextTables } = useNocoAi()

const aiMode = ref(false)

enum AiStep {
  init = 'init',
  pick = 'pick',
}

const aiModeStep = ref<AiStep | null>(null)

const predictedTables = ref<string[]>([])

const removedFromPredictedTables = ref<Set<string>>(new Set())

const predictHistory = ref<string[]>([])

const selectedTables = ref<string[]>([])

const calledFunction = ref<string>()

const prompt = ref<string>('')

const isPromtAlreadyGenerated = ref<boolean>(false)

const availableIntegration = ref<{
  fkIntegrationId?: string
  model?: string
  randomness?: string
}>({})

const toggleAiMode = async () => {
  if (aiMode.value) return

  aiMode.value = true
  aiModeStep.value = AiStep.init
  predictedTables.value = []
  predictHistory.value = []
  prompt.value = ''
  isPromtAlreadyGenerated.value = false

  if (table.title === initTitle.value) {
    table.title = ''
  }

  const predictions = await predictNextTables(predictHistory.value, props.baseId)

  if (predictions.length) {
    predictedTables.value = predictions
    predictHistory.value.push(...predictions)
    aiModeStep.value = AiStep.pick
  }
}

const disableAiMode = () => {
  aiMode.value = false
  aiModeStep.value = null
  predictedTables.value = []
  predictHistory.value = []
  prompt.value = ''
  isPromtAlreadyGenerated.value = false
  activeAiTab.value = TableWizardTabs.AUTO_SUGGESTIONS

  table.title = initTitle.value || ''
}

const predictMore = async () => {
  calledFunction.value = 'predictMore'

  const predictions: string[] = await predictNextTables(predictHistory.value, props.baseId)

  if (predictions.length) {
    predictedTables.value.push(
      ...predictions.filter((t) => !predictedTables.value.includes(t) && !removedFromPredictedTables.value.has(t)),
    )
    predictHistory.value.push(...predictions)
  }
}

const predictRefresh = async () => {
  calledFunction.value = 'predictRefresh'

  const predictions: string[] = await predictNextTables(predictHistory.value, props.baseId)

  if (predictions.length) {
    predictedTables.value = predictions.filter((t) => !removedFromPredictedTables.value.has(t))
    predictHistory.value.push(...predictions.filter((t) => !removedFromPredictedTables.value.has(t)))
    aiModeStep.value = AiStep.pick
  }
}

const predictFromPrompt = async () => {
  calledFunction.value = 'predictFromPrompt'

  const predictions = await predictNextTables(predictHistory.value, props.baseId, prompt.value)

  if (predictions.length) {
    predictedTables.value = predictions
    predictHistory.value.push(...predictions)
    aiModeStep.value = AiStep.pick
  }

  isPromtAlreadyGenerated.value = true
}

const onTagClick = (tag: string) => {
  selectedTables.value.push(tag)
  predictedTables.value = predictedTables.value.filter((t) => t !== tag)
}

const onTagClose = (tag: string) => {
  selectedTables.value = selectedTables.value.filter((t) => t !== tag)
  if (predictHistory.value.includes(tag)) {
    predictedTables.value.push(tag)
  }
}

const onTagRemoveFromPrediction = (tag: string) => {
  removedFromPredictedTables.value.add(tag)
  predictedTables.value = predictedTables.value.filter((t) => t !== tag)
}

const onSelectAll = () => {
  selectedTables.value.push(...predictedTables.value.filter((t) => !removedFromPredictedTables.value.has(t)))
  predictedTables.value = []
}

const onDeselectAll = () => {
  predictedTables.value.push(...selectedTables.value.filter((t) => predictHistory.value.includes(t)))
  selectedTables.value = selectedTables.value.filter((t) => !predictHistory.value.includes(t))
}

const onAiEnter = async () => {
  if (table.title.length) {
    selectedTables.value.push(table.title)
    table.title = ''
  }
  calledFunction.value = 'generateTables'

  if (selectedTables.value.length) {
    await generateTables(selectedTables.value, undefined, onAiTableCreate, props.baseId)
  }
}

const useForm = Form.useForm

const enableDescription = ref(false)

const removeDescription = () => {
  table.description = ''
  enableDescription.value = false
}

const validators = computed(() => {
  return {
    title: [
      validateTableName,
      {
        validator: (_: any, value: any) => {
          // validate duplicate alias
          return new Promise((resolve, reject) => {
            if ((tables.value || []).some((t) => t.title === (value || '') && t.source_id === props.sourceId)) {
              return reject(new Error('Duplicate table alias'))
            }
            return resolve(true)
          })
        },
      },
      {
        validator: (rule: any, value: any) => {
          return new Promise<void>((resolve, reject) => {
            let tableNameLengthLimit = 255
            if (isMysql(props.sourceId)) {
              tableNameLengthLimit = 64
            } else if (isPg(props.sourceId)) {
              tableNameLengthLimit = 63
            } else if (isMssql(props.sourceId)) {
              tableNameLengthLimit = 128
            }
            const basePrefix = base?.value?.prefix || ''
            if ((basePrefix + value).length > tableNameLengthLimit) {
              return reject(new Error(`Table name exceeds ${tableNameLengthLimit} characters`))
            }
            resolve()
          })
        },
      },
    ],
    table_name: [validateTableName],
  }
})
const { validate, validateInfos } = useForm(table, validators)

const systemColumnsCheckboxInfo = SYSTEM_COLUMNS.map((c, index) => ({
  value: c,
  disabled: index === 0,
}))

const creating = ref(false)

const _createTable = async () => {
  if (aiMode.value) {
    return onAiEnter()
  }

  if (creating.value) return
  try {
    creating.value = true
    await validate()
    await createTable()
    dialogShow.value = false
  } catch (e: any) {
    console.error(e)
    e.errorFields.map((f: Record<string, any>) => message.error(f.errors.join(',')))
    if (e.errorFields.length) return
  } finally {
    setTimeout(() => {
      creating.value = false
    }, 500)
    refreshCommandPalette()
  }
}

const toggleDescription = () => {
  if (enableDescription.value) {
    enableDescription.value = false
  } else {
    enableDescription.value = true
    setTimeout(() => {
      inputEl.value?.focus()
    }, 100)
  }
}

const localIsDisabledAiWizard = ref(false)

const isDisabled = computed({
  get: () => localIsDisabledAiWizard.value,
  set: (value: boolean) => {
    localIsDisabledAiWizard.value = value

    if (value) {
      aiMode.value = false
      aiModeStep.value = null
      predictedTables.value = []
      predictHistory.value = []

      table.title = initTitle.value || ''
    } else {
      aiIntegrationAvailable.value = true
    }
  },
})

onMounted(() => {
  generateUniqueTitle()
  nextTick(() => {
    inputEl.value?.focus()
    inputEl.value?.select()
    initTitle.value = table.title
  })
})

const fullAuto = async (e) => {
  const target = e.target as HTMLElement
  if (!aiIntegrationAvailable.value || !aiError.value || target.closest('button, input, .nc-button, textarea')) return

  if (!aiModeStep.value) {
    await toggleAiMode()
  } else if (aiModeStep.value === AiStep.pick && selectedTables.value.length === 0) {
    await onSelectAll()
  } else if (aiModeStep.value === AiStep.pick && selectedTables.value.length > 0) {
    await onAiEnter()
  }
}

const activeAiTabLocal = ref<keyof typeof TableWizardTabs>(TableWizardTabs.AUTO_SUGGESTIONS)

const activeAiTab = computed({
  get: () => {
    return activeAiTabLocal.value
  },
  set: (value: keyof typeof TableWizardTabs) => {
    activeAiTabLocal.value = value

    predictedTables.value = []
    predictHistory.value = [...selectedTables.value]

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

const handleNavigateToIntegrations = () => {
  dialogShow.value = false

  workspaceStore.navigateToIntegrations()
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
      return
  }
}

watch(
  dialogShow,
  (value) => {
    if (value) {
      if (!aiIntegrationAvailable.value) {
        aiIntegrationAvailable.value = true
      }
    }
  },
  { immediate: true },
)
</script>

<template>
  <NcModal
    v-model:visible="dialogShow"
    :show-separator="false"
    :header="$t('activity.createTable')"
    size="sm"
    height="auto"
    :centered="false"
    nc-modal-class-name="!px-0 !pb-0"
    @keydown.esc="dialogShow = false"
  >
    <template #header>
      <div class="px-6 flex justify-between w-full items-center" @dblclick.stop="fullAuto">
        <div class="flex flex-row items-center gap-x-2 text-base font-semibold text-gray-800">
          <GeneralIcon icon="table" class="!text-gray-600 w-5 h-5" />
          {{ $t('activity.createTable') }}
        </div>
        <a href="https://docs.nocodb.com/tables/create-table" target="_blank" class="text-[13px]">
          {{ $t('title.docs') }}
        </a>
      </div>
    </template>
    <div class="px-6 pb-6 flex flex-col mt-1" @dblclick.stop="fullAuto">
      <a-form
        layout="vertical"
        :model="table"
        name="create-new-table-form"
        class="flex flex-col gap-5"
        @keydown.enter="_createTable"
        @keydown.esc="dialogShow = false"
      >
        <div class="flex flex-col gap-5">
          <a-form-item v-bind="aiMode ? {} : validateInfos.title" class="relative">
            <a-input
              v-if="!aiMode"
              ref="inputEl"
              v-model:value="table.title"
              class="nc-table-input nc-input-sm nc-input-shadow !max-w-[calc(100%_-_32px)] z-11"
              hide-details
              data-testid="create-table-title-input"
              :placeholder="$t('msg.info.enterTableName')"
            />
            <a-input
              v-else
              ref="inputEl"
              v-model:value="table.title"
              class="nc-table-input nc-input-sm nc-input-shadow max-w-[calc(100%_-_32px)] z-11"
              hide-details
              data-testid="create-table-title-input"
              :placeholder="selectedTables.length ? '' : 'Enter table names or choose from suggestions'"
            />
            <!-- overlay selected tags with close icon on input -->
            <div
              v-if="aiMode"
              class="absolute top-0 max-w-[calc(100%_-_48px)] left-0 z-12 h-8 flex items-center gap-2 mx-2 nc-scrollbar-thin overflow-x-auto"
            >
              <a-tag
                v-for="t in selectedTables"
                :key="t"
                class="cursor-pointer !rounded-md !bg-nc-bg-brand hover:!bg-brand-100 !text-nc-content-brand !border-none font-semibold !mx-0"
              >
                <div class="flex flex-row items-center gap-1 py-0.5 text-sm">
                  <span>{{ t }}</span>
                  <GeneralIcon icon="close" class="cursor-pointer" @click="onTagClose(t)" />
                </div>
              </a-tag>
            </div>

            <!-- Black overlay button on end of input -->
            <NcTooltip
              :title="aiMode ? 'Disable AI suggestions' : 'Suggest tables using AI'"
              class="nc-table-ai-toggle-btn absolute right-0 top-0 h-full"
            >
              <NcButton
                size="small"
                type="secondary"
                class="z-10 !border-l-0 !rounded-l-none !pl-3.8"
                :class="{
                  '!bg-nc-bg-purple-light hover:!bg-nc-bg-purple-dark !border-purple-100 !text-nc-fill-purple-dark': !aiMode,
                  '!bg-purple-700 !border-purple-700 !text-white': aiMode,
                }"
                @click.stop="aiMode ? disableAiMode() : toggleAiMode()"
              >
                <div class="w-full flex items-center justify-end">
                  <GeneralIcon icon="ncAutoAwesome" class="text-xs !text-current w-4 h-4" />
                </div>
              </NcButton>
            </NcTooltip>
          </a-form-item>

          <!-- Ai table wizard  -->
          <AiWizardCard
            v-if="aiMode"
            v-model:is-disabled="isDisabled"
            v-model:active-tab="activeAiTab"
            :tabs="aiTabs"
            @navigate-to-integrations="handleNavigateToIntegrations"
          >
            <template #tabExtraRight v-if="aiIntegrationAvailable">
              <template v-if="activeAiTab === TableWizardTabs.AUTO_SUGGESTIONS">
                <template v-if="aiModeStep === AiStep.pick">
                  <NcTooltip title="Re-suggest" placement="top">
                    <NcButton
                      size="xs"
                      class="!px-1 !text-current hover:!bg-nc-bg-purple-dark"
                      type="text"
                      :loading="aiLoading && calledFunction === 'predictRefresh'"
                      @click="predictRefresh"
                    >
                      <template #loadingIcon>
                        <template></template>
                      </template>
                      <GeneralIcon
                        icon="refresh"
                        class="!text-current"
                        :class="{
                          'animate-infinite animate-spin': aiLoading && calledFunction === 'predictRefresh',
                        }"
                      />
                    </NcButton>
                  </NcTooltip>
                  <NcTooltip
                    v-if="
                      predictHistory.length < selectedTables.length
                        ? predictHistory.length + selectedTables.length < 8
                        : predictHistory.length < 8
                    "
                    title="Suggest more"
                    placement="top"
                  >
                    <NcButton
                      size="xs"
                      class="!px-1 !text-current hover:!bg-nc-bg-purple-dark"
                      type="text"
                      :loading="aiLoading && calledFunction === 'predictMore'"
                      @click="predictMore"
                    >
                      <template #loadingIcon>
                        <template> </template>
                      </template>
                      <GeneralLoader v-if="aiLoading && calledFunction === 'predictMore'" class="!text-current" />
                      <GeneralIcon v-else icon="ncPlusAi" class="!text-current" />
                    </NcButton>
                  </NcTooltip>
                </template>
              </template>
              <template v-else>
                <NcButton
                  size="xs"
                  class="hover:!bg-nc-bg-purple-dark !text-nc-content-purple-dark"
                  :class="{
                    '!text-nc-content-purple-light': isPredictFromPromptLoading,
                  }"
                  type="text"
                  :loading="isPredictFromPromptLoading"
                  @click="predictFromPrompt"
                >
                  <template #loadingIcon>
                    <template></template>
                  </template>
                  <div
                    class="flex items-center gap-2"
                    :class="{
                      'min-w-[104px]': isPredictFromPromptLoading && !isPromtAlreadyGenerated,
                      'min-w-[124px]': isPredictFromPromptLoading && isPromtAlreadyGenerated,
                    }"
                  >
                    <GeneralIcon icon="ncZap" class="flex-none" />
                    <div
                      :class="{
                        'nc-animate-dots': isPredictFromPromptLoading,
                      }"
                    >
                      {{
                        isPredictFromPromptLoading
                          ? isPromtAlreadyGenerated
                            ? 'Re-generating'
                            : 'Generating'
                          : isPromtAlreadyGenerated
                          ? 'Re-generate'
                          : 'Generate'
                      }}
                    </div>
                  </div>
                </NcButton>
              </template>
            </template>
            <template #tabContent>
              <template v-if="aiError">
                <div class="py-3 pl-3 pr-2 flex items-center gap-3">
                  <GeneralIcon icon="ncInfoSolid" class="!text-nc-content-red-dark w-4 h-4" />

                  <div class="text-sm text-nc-content-gray-subtle flex-1">
                    <NcTooltip class="truncate" show-on-truncate-only>
                      <template #title>
                        {{ aiError }}
                      </template>
                      {{ aiError }}
                    </NcTooltip>
                  </div>

                  <NcButton size="small" type="text" class="!text-nc-content-brand" @click.stop="handleRefreshOnError">
                    {{ $t('general.refresh') }}
                  </NcButton>
                </div>
              </template>
              <template v-else>
                <template v-if="activeAiTab === TableWizardTabs.AUTO_SUGGESTIONS">
                  <div v-if="aiModeStep === 'init'" class="p-4">
                    <div class="text-nc-content-purple-light text-sm h-7 flex items-center">
                      Auto suggesting tables based on your base name and existing tables
                      <div class="nc-animate-dots"></div>
                    </div>
                  </div>
                </template>
                <template v-else>
                  <div>
                    <a-textarea
                      v-model:value="prompt"
                      :bordered="false"
                      placeholder="Enter your prompt to get table suggestions.."
                      class="!px-4 !py-2 !text-sm !min-h-[120px]"
                      @keydown.enter.stop
                    >
                    </a-textarea>
                  </div>
                </template>

                <div
                  v-if="
                    (activeAiTab === TableWizardTabs.AUTO_SUGGESTIONS && aiModeStep === 'pick') ||
                    (activeAiTab === TableWizardTabs.PROMPT &&
                      (predictedTables.length || selectedTables.length || isPromtAlreadyGenerated))
                  "
                  class="flex gap-2 flex-wrap p-4"
                  :class="{
                    'p-4': activeAiTab === TableWizardTabs.AUTO_SUGGESTIONS,
                    'border-t-1 border-purple-200': activeAiTab === TableWizardTabs.PROMPT,
                  }"
                >
                  <template v-for="t of predictedTables" :key="t">
                    <a-tag
                      v-if="!removedFromPredictedTables.has(t)"
                      class="cursor-pointer !rounded-md !bg-nc-bg-purple-light hover:!bg-nc-bg-purple-dark !text-nc-content-purple-dark !border-none !mx-0"
                      @click="onTagClick(t)"
                    >
                      <div class="flex flex-row items-center gap-1 py-0.5">
                        <span>{{ t }}</span>
                        <GeneralIcon
                          icon="close"
                          class="text-xs cursor-pointer mt-0.5"
                          @click.stop="onTagRemoveFromPrediction(t)"
                        />
                      </div>
                    </a-tag>
                  </template>

                  <NcButton
                    v-if="predictedTables.length || !selectedTables.length"
                    size="xs"
                    class="!h-6"
                    :type="predictedTables.length ? 'text' : 'secondary'"
                    :disabled="!predictedTables.length"
                    :class="{
                      '!bg-nc-bg-purple-dark hover:!bg-nc-bg-purple-light !text-nc-content-purple-dark': predictedTables.length,
                      '!text-nc-content-purple-light !border-purple-200 !bg-nc-bg-purple-light': !predictedTables.length,
                    }"
                    @click="onSelectAll"
                  >
                    <div class="flex items-center gap-2">
                      <GeneralIcon icon="ncPlusMultiple" class="flex-none" />

                      Accept All Tables
                    </div>
                  </NcButton>
                  <NcButton
                    v-else
                    size="xs"
                    class="!bg-nc-bg-purple-dark hover:!bg-nc-bg-purple-light !text-nc-content-purple-dark !border-transparent !h-6"
                    type="text"
                    @click="onDeselectAll"
                  >
                    <div class="flex items-center gap-2">
                      <GeneralIcon icon="ncMinusSquare" class="flex-none" />

                      Remove All Tables
                    </div>
                  </NcButton>
                </div>
              </template>
            </template>
          </AiWizardCard>

          <a-form-item
            v-if="enableDescription && !aiMode"
            v-bind="validateInfos.description"
            :class="{ '!mb-1': isSnowflake(props.sourceId), '!mb-0': !isSnowflake(props.sourceId) }"
          >
            <div class="flex gap-3 text-gray-800 h-7 mb-1 items-center justify-between">
              <span class="text-[13px]">
                {{ $t('labels.description') }}
              </span>
              <NcButton type="text" class="!h-6 !w-5" size="xsmall" @click="removeDescription">
                <GeneralIcon icon="delete" class="text-gray-700 w-3.5 h-3.5" />
              </NcButton>
            </div>

            <a-textarea
              ref="inputEl"
              v-model:value="table.description"
              class="nc-input-sm nc-input-text-area nc-input-shadow px-3 !text-gray-800 max-h-[150px] min-h-[100px]"
              hide-details
              data-testid="create-table-title-input"
              :placeholder="$t('msg.info.enterTableDescription')"
            />
          </a-form-item>

          <template v-if="isSnowflake(props.sourceId)">
            <a-checkbox v-model:checked="table.is_hybrid" class="!flex flex-row items-center"> Hybrid Table </a-checkbox>
          </template>
        </div>
        <div v-if="isAdvanceOptVisible && !aiMode" class="nc-table-advanced-options" :class="{ active: isAdvanceOptVisible }">
          <div>
            <div class="mb-1">
              <!-- Add Default Columns -->
              {{ $t('msg.info.defaultColumns') }}
            </div>

            <a-row>
              <a-checkbox-group
                v-model:value="table.columns"
                :options="systemColumnsCheckboxInfo"
                class="!flex flex-row justify-between w-full"
              >
                <template #label="{ value }">
                  <a-tooltip v-if="value === 'id'" placement="top" class="!flex">
                    <template #title>
                      <span>{{ $t('msg.idColumnRequired') }}</span>
                    </template>
                    {{ $t('datatype.ID') }}
                  </a-tooltip>
                  <div v-else class="flex">
                    {{ value }}
                  </div>
                </template>
              </a-checkbox-group>
            </a-row>
          </div>
        </div>
        <div class="flex flex-row justify-between gap-x-2">
          <NcButton v-if="!enableDescription && !aiMode" size="small" type="text" @click.stop="toggleDescription">
            <div class="flex !text-gray-700 items-center gap-2">
              <GeneralIcon icon="plus" class="h-4 w-4" />

              <span class="first-letter:capitalize">
                {{ $t('labels.addDescription').toLowerCase() }}
              </span>
            </div>
          </NcButton>
          <div v-else></div>
          <div class="flex gap-2 items-center">
            <NcButton type="secondary" size="small" @click="dialogShow = false">{{ $t('general.cancel') }}</NcButton>

            <NcButton
              v-if="!aiMode"
              v-e="['a:table:create']"
              type="primary"
              size="small"
              :disabled="validateInfos.title.validateStatus === 'error'"
              :loading="creating"
              @click="_createTable"
            >
              {{ $t('activity.createTable') }}
              <template #loading> {{ $t('title.creatingTable') }} </template>
            </NcButton>
            <NcButton
              v-else
              v-e="['a:table:create']"
              type="primary"
              size="small"
              :disabled="selectedTables.length === 0 && validateInfos.title.validateStatus === 'error'"
              :loading="aiLoading && calledFunction === 'generateTables'"
              @click="_createTable"
            >
              <div class="flex items-center gap-2 h-5">
                {{
                  selectedTables.length
                    ? selectedTables.length > 1
                      ? $t('activity.createTables_plural', {
                          count: selectedTables.length,
                        })
                      : $t('activity.createTables', {
                          count: selectedTables.length,
                        })
                    : $t('activity.createTable')
                }}
              </div>
              <template #loading> {{ $t('title.creatingTable') }} </template>
            </NcButton>
          </div>
        </div>
      </a-form>
    </div>
    <div class="nc-nocoai-footer">
      <!-- Footer -->

      <div class="nc-ai-wizard-card-footer-branding text-xs">
        Powered by
        <a class="!no-underline font-semibold !text-inherit"> Noco AI </a>
      </div>

      <AiSettings
        v-model:fk-integration-id="availableIntegration.fkIntegrationId"
        v-model:model="availableIntegration.model"
        v-model:randomness="availableIntegration.randomness"
        :workspace-id="activeWorkspaceId"
        placement="bottom"
      >
        <NcButton
          size="xs"
          class="nc-nocoai-settings !px-1 !text-current"
          type="text"
          :disabled="aiLoading || !aiIntegrationAvailable || !aiMode"
        >
          <GeneralIcon icon="settings" />
        </NcButton>
      </AiSettings>
    </div>
  </NcModal>
</template>

<style scoped lang="scss">
.ant-form-item {
  @apply mb-0;
}

.nc-input-text-area {
  padding-block: 8px !important;
}

.nc-table-advanced-options {
  max-height: 0;
  transition: 0.3s max-height;
  overflow: hidden;

  &.active {
    max-height: 100px;
  }
}

.nc-nocoai-footer {
  @apply px-6 py-1 flex items-center gap-2 text-nc-content-purple-dark border-t-1 border-purple-100;

  .nc-nocoai-settings {
    &:not(:disabled) {
      @apply hover:!bg-nc-bg-purple-light;
    }
  }
}

.nc-table-input {
  &:not(:focus) {
    @apply !rounded-r-none !border-r-0;

    & ~ .nc-table-ai-toggle-btn {
      button {
        @apply !pl-[7px] z-11 !border-l-1;
      }
    }
  }
}
</style>
