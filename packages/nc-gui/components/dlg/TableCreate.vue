<script setup lang="ts">
import type { TableType } from 'nocodb-sdk'
import { AiWizardTabsType } from '#imports'

const props = defineProps<{
  modelValue: boolean
  sourceId: string
  baseId: string
}>()

interface AiSuggestedTableType {
  title: string
  selected: boolean
}

const emit = defineEmits(['update:modelValue', 'create'])

const maxSelectionCount = 5

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

const {
  aiIntegrationAvailable,
  aiLoading,
  aiError,
  generateTables,
  predictNextTables: _predictNextTables,
  loadAiIntegrations,
} = useNocoAi()

const aiMode = ref(false)

enum AiStep {
  init = 'init',
  pick = 'pick',
}

const aiModeStep = ref<AiStep | null>(null)

const predictedTables1 = ref<string[]>([])
const predictedTables = ref<AiSuggestedTableType[]>([])

const removedFromPredictedTables = ref<Set<string>>(new Set())

const predictHistory = ref<AiSuggestedTableType[]>([])

const selectedTables = computed(() => {
  return predictedTables.value.filter(({ selected }) => !!selected)
})

const calledFunction = ref<string>()

const prompt = ref<string>('')

const isPromtAlreadyGenerated = ref<string>('')

const availableIntegration = ref<{
  fkIntegrationId?: string
  model?: string
  randomness?: string
}>({})

const activeAiTabLocal = ref<AiWizardTabsType>(AiWizardTabsType.AUTO_SUGGESTIONS)

const activeAiTab = computed({
  get: () => {
    return activeAiTabLocal.value
  },
  set: (value: AiWizardTabsType) => {
    activeAiTabLocal.value = value

    prompt.value = ''
    isPromtAlreadyGenerated.value = ''

    aiError.value = ''
  },
})

const predictNextTables = async (prompt?: string): Promise<AiSuggestedTableType[]> => {
  return (
    await _predictNextTables(
      predictHistory.value.map(({ title }) => title),
      props.baseId,
      prompt,
    )
  ).filter((t) => !ncIsArrayIncludes(predictedTables.value, t.title, 'title'))
}

const serializeAiTables = (tables: string[]) => {
  return tables.map((title: string): AiSuggestedTableType => {
    return {
      title,
      selected: false,
    }
  })
}
const deSerializeAiTables = (tables: AiSuggestedTableType[]) => {
  return tables.map(({ title }): string => title)
}

const toggleAiMode = async () => {
  if (aiMode.value) return

  aiError.value = ''

  aiMode.value = true
  aiModeStep.value = AiStep.init
  predictedTables.value = []
  predictHistory.value = []
  prompt.value = ''
  isPromtAlreadyGenerated.value = ''

  if (table.title === initTitle.value) {
    table.title = ''
  }

  const predictions = await predictNextTables()

  predictedTables.value = predictions
  predictHistory.value.push(...predictions)
  aiModeStep.value = AiStep.pick
}

const disableAiMode = () => {
  aiMode.value = false
  aiModeStep.value = null
  predictedTables.value = []
  predictHistory.value = []
  prompt.value = ''
  isPromtAlreadyGenerated.value = ''
  activeAiTab.value = AiWizardTabsType.AUTO_SUGGESTIONS

  table.title = initTitle.value || ''
}

const predictMore = async () => {
  calledFunction.value = 'predictMore'

  const predictions = await predictNextTables()

  if (predictions.length) {
    predictedTables.value.push(...predictions)
    predictHistory.value.push(...predictions)
  }
}

const predictRefresh = async () => {
  calledFunction.value = 'predictRefresh'

  const predictions = await predictNextTables()

  if (predictions.length) {
    predictedTables.value = predictions
    predictHistory.value.push(...predictions)
    aiModeStep.value = AiStep.pick
  }
}

const predictFromPrompt = async () => {
  calledFunction.value = 'predictFromPrompt'

  const predictions = await predictNextTables()

  if (predictions.length) {
    predictedTables.value = predictions
    predictHistory.value.push(...predictions)
    aiModeStep.value = AiStep.pick
  }

  isPromtAlreadyGenerated.value = prompt.value
}

const onToggleTag = (table: AiSuggestedTableType) => {
  if (
    !table.selected &&
    (selectedTables.value.length >= maxSelectionCount || ncIsArrayIncludes(selectedTables.value, table.title, 'title'))
  )
    return

  predictedTables.value = predictedTables.value.map((t) => {
    if (t.title === table.title) {
      t.selected = !table.selected
    }
    return t
  })
}

const onTagClick = (table: AiSuggestedTableType) => {
  if (selectedTables.value.length >= maxSelectionCount || ncIsArrayIncludes(selectedTables.value, table.title, 'title')) return

  predictedTables.value = predictedTables.value.map((t) => {
    if (t.title === table.title) {
      t.selected = true
    }
    return t
  })
}

const onTagClose = (table: AiSuggestedTableType) => {
  predictedTables.value = predictedTables.value.map((t) => {
    if (t.title === table.title) {
      t.selected = false
    }
    return t
  })
}

const onTagRemoveFromPrediction = (tag: string) => {
  if (selectedTables.value.length >= maxSelectionCount) return

  removedFromPredictedTables.value.add(tag)
  predictedTables.value = predictedTables.value.filter((t) => t !== tag)
}

const onSelectAll = () => {
  if (selectedTables.value.length >= maxSelectionCount) return

  let count = selectedTables.value.length

  predictedTables.value = predictedTables.value.map((table) => {
    // Check if the item can be selected
    if (!table.selected && count < maxSelectionCount) {
      table.selected = true
      count++
    }
    return table
  })
}

const onDeselectAll = () => {
  predictedTables.value = predictedTables.value.map((table) => {
    table.selected = false
    return table
  })
}

const onAiEnter = async () => {
  calledFunction.value = 'generateTables'

  if (selectedTables.value.length) {
    await generateTables(
      selectedTables.value.map(({ title }) => title),
      undefined,
      onAiTableCreate,
      props.baseId,
    )
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

onMounted(() => {
  generateUniqueTitle()
  loadAiIntegrations()
  nextTick(() => {
    inputEl.value?.focus()
    inputEl.value?.select()
    initTitle.value = table.title
  })
})

const fullAuto = async (e) => {
  const target = e.target as HTMLElement
  if (
    !aiIntegrationAvailable.value ||
    aiLoading.value ||
    aiError.value ||
    target.closest('button, input, .nc-button, textarea')
  ) {
    return
  }

  if (!aiModeStep.value) {
    await toggleAiMode()
  } else if (aiModeStep.value === AiStep.pick && selectedTables.value.length === 0) {
    await onSelectAll()
  } else if (aiModeStep.value === AiStep.pick && selectedTables.value.length > 0) {
    await onAiEnter()
  }
}

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

const handleNavigateToIntegrations = () => {
  dialogShow.value = false

  workspaceStore.navigateToIntegrations(undefined, undefined, {
    categories: 'ai',
  })
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
    :header="$t('activity.createTable')"
    size="xs"
    height="auto"
    :centered="false"
    nc-modal-class-name="!p-0"
    @keydown.esc="dialogShow = false"
  >
    <div class="py-5 flex flex-col gap-5" @dblclick.stop="fullAuto">
      <div class="px-5 flex justify-between w-full items-center" @dblclick.stop="fullAuto">
        <div class="flex flex-row items-center gap-x-2 text-base font-semibold text-gray-800">
          <GeneralIcon icon="table" class="!text-gray-600 w-5 h-5" />
          {{ $t('activity.createTable') }}
        </div>
        <!-- <a href="https://docs.nocodb.com/tables/create-table" target="_blank" class="text-[13px]">
          {{ $t('title.docs') }}
        </a> -->
        <NcButton
          type="text"
          size="small"
          theme="ai"
          :class="{
            '!pointer-events-none !cursor-not-allowed': aiLoading,
            '!bg-nc-bg-purple-dark hover:(!bg-purple-500 !text-white)': aiMode,
          }"
          @click.stop="aiMode ? disableAiMode() : toggleAiMode()"
        >
          <div class="flex items-center justify-center">
            <GeneralIcon icon="ncAutoAwesome" />
            <span
              class="overflow-hidden trasition-all duration-200"
              :class="{ 'w-[0px] invisible': aiMode, 'ml-1 w-[78px]': !aiMode }"
            >
              Use NocoAI
            </span>
          </div>
        </NcButton>
      </div>

      <a-form
        layout="vertical"
        :model="table"
        name="create-new-table-form"
        class="flex flex-col gap-5"
        :class="{
          '!px-5': !aiMode,
        }"
        @keydown.enter="_createTable"
        @keydown.esc="dialogShow = false"
      >
        <div class="flex flex-col gap-5">
          <a-form-item v-if="!aiMode" v-bind="aiMode ? {} : validateInfos.title" class="relative nc-table-input-wrapper relative">
            <a-input
              ref="inputEl"
              v-model:value="table.title"
              class="nc-table-input nc-input-sm nc-input-shadow"
              hide-details
              data-testid="create-table-title-input"
              :placeholder="$t('msg.info.enterTableName')"
            />
          </a-form-item>

          <!-- Ai table wizard  -->
          <AiWizardTabs v-if="aiMode" v-model:active-tab="activeAiTab">
            <template #AutoSuggestedContent>
              <div class="px-5 pt-5 pb-2">
                <div v-if="aiError" class="w-full flex items-center gap-3">
                  <GeneralIcon icon="ncInfoSolid" class="flex-none !text-nc-content-red-dark w-4 h-4" />

                  <NcTooltip class="truncate flex-1 text-sm text-nc-content-gray-subtle" show-on-truncate-only>
                    <template #title>
                      {{ aiError }}
                    </template>
                    {{ aiError }}
                  </NcTooltip>

                  <NcButton size="small" type="text" class="!text-nc-content-brand" @click.stop="handleRefreshOnError">
                    {{ $t('general.refresh') }}
                  </NcButton>
                </div>

                <div v-else-if="aiModeStep === 'init'">
                  <div class="text-nc-content-purple-light text-sm h-7 flex items-center gap-2">
                    <GeneralLoader size="regular" class="!text-nc-content-purple-dark" />

                    <div class="nc-animate-dots">Auto suggesting tables based on your base name and existing tables</div>
                  </div>
                </div>
                <div v-else-if="aiModeStep === 'pick'" class="flex gap-3 items-start">
                  <div class="flex gap-2 flex-wrap">
                    <template v-for="t of predictedTables" :key="t.title">
                      <NcTooltip :disabled="selectedTables.length < maxSelectionCount || t.selected">
                        <template #title>
                          <div class="w-[150px]">You can only select {{ maxSelectionCount }} tables to create at a time.</div>
                        </template>

                        <a-tag
                          class="nc-ai-suggested-tag"
                          :class="{
                            'nc-disabled': !t.selected && selectedTables.length >= maxSelectionCount,
                            'nc-selected': t.selected,
                          }"
                          :disabled="selectedTables.length >= maxSelectionCount"
                          @click="onToggleTag(t)"
                        >
                          <div class="flex flex-row items-center gap-1 py-[3px] text-small leading-[18px]">
                            <div>{{ t.title }}</div>
                          </div>
                        </a-tag>
                      </NcTooltip>
                    </template>
                  </div>
                  <div class="flex items-center gap-1">
                    <NcTooltip title="Re-suggest" placement="top">
                      <NcButton
                        size="xs"
                        class="!px-1"
                        type="text"
                        theme="ai"
                        :loading="aiLoading && calledFunction === 'predictRefresh'"
                        @click="predictRefresh"
                      >
                        <template #loadingIcon>
                          <!-- eslint-disable vue/no-lone-template -->
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
                        class="!px-1"
                        type="text"
                        theme="ai"
                        :loading="aiLoading && calledFunction === 'predictMore'"
                        icon-only
                        @click="predictMore"
                      >
                        <template #icon>
                          <GeneralIcon icon="ncPlusAi" class="!text-current" />
                        </template>
                      </NcButton>
                    </NcTooltip>
                  </div>
                </div>
              </div>
            </template>
            <template #PromptContent>
              <div class="px-5 pt-5 pb-2 flex flex-col gap-5">
                <div class="relative">
                  <a-textarea
                    v-model:value="prompt"
                    placeholder="Enter your prompt to get table suggestions.."
                    class="nc-ai-input nc-input-shadow !px-3 !pt-2 !pb-3 !text-sm !min-h-[120px] !rounded-lg"
                    @keydown.enter.stop
                  >
                  </a-textarea>

                  <NcButton
                    size="xs"
                    type="primary"
                    theme="ai"
                    class="!px-1 !absolute bottom-2 right-2"
                    :disabled="
                      !prompt.trim() || isPredictFromPromptLoading || (!prompt.trim() && isPromtAlreadyGenerated === prompt)
                    "
                    :loading="isPredictFromPromptLoading"
                    @click="predictFromPrompt"
                    icon-only
                  >
                    <template #loadingIcon>
                      <GeneralLoader class="!text-purple-700" size="medium" />
                    </template>
                    <template #icon>
                      <GeneralIcon icon="send" class="flex-none h-4 w-4" />
                    </template>
                  </NcButton>
                </div>

                <div class="flex flex-col gap-3">
                  <div class="text-nc-content-purple-dark font-semibold text-xs">Generated Table(s)</div>
                  <div class="flex gap-2 flex-wrap">
                    <template v-for="t of predictedTables" :key="t.title">
                      <NcTooltip :disabled="selectedTables.length < maxSelectionCount || t.selected">
                        <template #title>
                          <div class="w-[150px]">You can only select {{ maxSelectionCount }} tables to create at a time.</div>
                        </template>

                        <a-tag
                          class="nc-ai-suggested-tag"
                          :class="{
                            'nc-disabled': !t.selected && selectedTables.length >= maxSelectionCount,
                            'nc-selected': t.selected,
                          }"
                          :disabled="selectedTables.length >= maxSelectionCount"
                          @click="onToggleTag(t)"
                        >
                          <div class="flex flex-row items-center gap-1 py-[3px] text-small leading-[18px]">
                            <div>{{ t.title }}</div>
                          </div>
                        </a-tag>
                      </NcTooltip>
                    </template>
                  </div>
                </div>
              </div>
            </template>
          </AiWizardTabs>

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
        <div
          class="flex flex-row justify-between gap-x-2"
          :class="{
            'px-5 -mt-2': aiMode,
          }"
        >
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
              :theme="aiMode ? 'ai' : 'default'"
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
    &.nc-ai-loading {
      @apply !cursor-wait;
    }
  }
}

:deep(.ant-form-item.nc-table-input-wrapper) {
  &.nc-ai-mode {
    .nc-ai-mode-table-input-wrapper {
      @apply shadow-default hover:shadow-hover focus-within:(!shadow-selected border-brand-500);
    }
  }
}
</style>
