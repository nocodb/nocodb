<script setup lang="ts">
import type { TableType } from 'nocodb-sdk'
import { AiWizardTabsType } from '#imports'

const props = defineProps<{
  modelValue: boolean
  sourceId: string
  baseId: string
}>()

const emit = defineEmits(['update:modelValue', 'create'])

interface AiSuggestedTableType {
  title: string
  selected: boolean
  tab?: AiWizardTabsType
}

const maxSelectionCount = 100

const dialogShow = useVModel(props, 'modelValue', emit)

const { $e } = useNuxtApp()

const isAdvanceOptVisible = ref(false)

const inputEl = ref<HTMLInputElement>()

const aiPromptInputRef = ref<HTMLElement>()

const { addTab } = useTabs()

const workspaceStore = useWorkspace()

const { isMysql, isMssql, isPg, isSnowflake } = useBase()

const { loadProjectTables, addTable } = useTablesStore()

const { refreshCommandPalette } = useCommandPalette()

const { isFeatureEnabled } = useBetaFeatureToggle()

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

const onAiTableCreate = async (table: TableType) => {
  await onTableCreate(table)
  await openTable(table)
}

const { aiIntegrationAvailable, aiLoading, aiError, generateTables, predictNextTables: _predictNextTables } = useNocoAi()

const aiMode = ref(false)

enum AiStep {
  init = 'init',
  pick = 'pick',
}

const aiModeStep = ref<AiStep | null>(null)

const calledFunction = ref<string>()

const prompt = ref<string>('')

const oldPrompt = ref<string>('')

const isPromtAlreadyGenerated = ref<boolean>(false)

const activeAiTabLocal = ref<AiWizardTabsType>(AiWizardTabsType.AUTO_SUGGESTIONS)

const isAiSaving = computed(() => aiLoading.value && calledFunction.value === 'generateTables')

const activeAiTab = computed({
  get: () => {
    return activeAiTabLocal.value
  },
  set: (value: AiWizardTabsType) => {
    activeAiTabLocal.value = value

    aiError.value = ''

    if (value === AiWizardTabsType.PROMPT) {
      nextTick(() => {
        aiPromptInputRef.value?.focus()
      })
    }
    if (aiMode.value) {
      $e(`c:table:ai:tab-change:${value}`)
    }
  },
})

const predictedTables = ref<AiSuggestedTableType[]>([])

const activeTabPredictedTables = computed(() => predictedTables.value.filter((t) => t.tab === activeAiTab.value))

const predictHistory = ref<AiSuggestedTableType[]>([])

const activeTabPredictHistory = computed(() => predictHistory.value.filter((t) => t.tab === activeAiTab.value))

const activeTabSelectedTables = computed(() => {
  return predictedTables.value.filter((table) => !!table.selected && table.tab === activeAiTab.value)
})

const predictNextTables = async (): Promise<AiSuggestedTableType[]> => {
  return (
    await _predictNextTables(
      activeTabPredictHistory.value.map(({ title }) => title),
      props.baseId,
      activeAiTab.value === AiWizardTabsType.PROMPT ? prompt.value : undefined,
    )
  )
    .filter((t) => !ncIsArrayIncludes(activeTabPredictedTables.value, t.title, 'title'))
    .map((t) => {
      return {
        ...t,
        tab: activeAiTab.value,
        selected: false,
      }
    })
}

const predictMore = async () => {
  calledFunction.value = 'predictMore'

  const predictions = await predictNextTables()

  if (predictions.length) {
    predictedTables.value.push(...predictions)
    predictHistory.value.push(...predictions)
  } else if (!aiError.value) {
    message.info(`No more auto suggestions were found for ${base.value?.title || 'the current base'}`)
  }
}

const predictRefresh = async () => {
  calledFunction.value = 'predictRefresh'

  const predictions = await predictNextTables()

  if (predictions.length) {
    predictedTables.value = [...predictedTables.value.filter((t) => t.tab !== activeAiTab.value), ...predictions]
    predictHistory.value.push(...predictions)
  } else if (!aiError.value) {
    message.info(`No auto suggestions were found for ${base.value?.title || 'the current base'}`)
  }
  aiModeStep.value = AiStep.pick
}

const predictFromPrompt = async () => {
  calledFunction.value = 'predictFromPrompt'

  const predictions = await predictNextTables()

  if (predictions.length) {
    predictedTables.value = [...predictedTables.value.filter((t) => t.tab !== activeAiTab.value), ...predictions]
    predictHistory.value.push(...predictions)

    oldPrompt.value = prompt.value
  } else if (!aiError.value) {
    message.info('No suggestions were found with the given prompt. Try again after modifying the prompt.')
  }
  aiModeStep.value = AiStep.pick
  isPromtAlreadyGenerated.value = true
}

const onToggleTag = (table: AiSuggestedTableType) => {
  if (
    isAiSaving.value ||
    (!table.selected &&
      (activeTabSelectedTables.value.length >= maxSelectionCount ||
        ncIsArrayIncludes(activeTabSelectedTables.value, table.title, 'title')))
  ) {
    return
  }

  predictedTables.value = predictedTables.value.map((t) => {
    if (t.title === table.title && t.tab === activeAiTab.value) {
      t.selected = !table.selected
    }
    return t
  })
}

const onSelectAll = () => {
  if (activeTabSelectedTables.value.length >= maxSelectionCount) return

  let count = activeTabSelectedTables.value.length

  predictedTables.value = predictedTables.value.map((table) => {
    // Check if the item can be selected
    if (table.tab === activeAiTab.value && !table.selected && count < maxSelectionCount) {
      table.selected = true
      count++
    }
    return table
  })
}

const toggleAiMode = async () => {
  if (aiMode.value) return

  $e('c:table:ai:toggle:true')

  aiError.value = ''

  aiMode.value = true
  aiModeStep.value = AiStep.init
  predictedTables.value = []
  predictHistory.value = []
  prompt.value = ''
  oldPrompt.value = ''
  isPromtAlreadyGenerated.value = false

  if (aiIntegrationAvailable.value) {
    await predictRefresh()
  }
}

const disableAiMode = () => {
  $e('c:table:ai:toggle:false')

  aiMode.value = false
  aiModeStep.value = null
  predictedTables.value = []
  predictHistory.value = []
  prompt.value = ''
  oldPrompt.value = ''
  isPromtAlreadyGenerated.value = false
  activeAiTab.value = AiWizardTabsType.AUTO_SUGGESTIONS

  nextTick(() => {
    inputEl.value?.focus()
    inputEl.value?.select()
  })
}

const onAiEnter = async () => {
  calledFunction.value = 'generateTables'

  $e('a:table:ai:create')

  if (activeTabSelectedTables.value.length) {
    await generateTables(
      activeTabSelectedTables.value.map(({ title }) => title),
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

  nextTick(() => {
    inputEl.value?.focus()
    inputEl.value?.select()
  })
})

const fullAuto = async (e) => {
  const target = e.target as HTMLElement
  if (
    !aiIntegrationAvailable.value ||
    aiLoading.value ||
    aiError.value ||
    target.closest('button, input, .nc-button, textarea, .ant-tag')
  ) {
    return
  }

  if (!aiModeStep.value) {
    await toggleAiMode()
  } else if (aiModeStep.value === AiStep.pick && activeTabSelectedTables.value.length === 0) {
    await onSelectAll()
  } else if (aiModeStep.value === AiStep.pick && activeTabSelectedTables.value.length > 0) {
    await onAiEnter()
  }
}

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
    case 'generateTables':
      return onAiEnter()
    default:
  }
}
</script>

<template>
  <NcModal
    v-model:visible="dialogShow"
    :header="$t('activity.createTable')"
    size="xs"
    height="auto"
    :centered="false"
    nc-modal-class-name="!p-0"
    class="!top-[25vh]"
    :mask-closable="!isAiSaving"
    wrap-class-name="nc-modal-table-create-wrapper"
    @keydown.esc="dialogShow = false"
  >
    <div class="py-5 flex flex-col gap-5" @dblclick.stop="fullAuto">
      <div class="px-5 flex justify-between w-full items-center">
        <div class="flex flex-row items-center gap-x-2 text-base font-semibold text-gray-800">
          <GeneralIcon icon="table" class="!text-gray-600 w-5 h-5" />
          {{ aiMode ? $t('activity.createTable(s)') : $t('activity.createTable') }}
        </div>
        <!-- <a href="https://docs.nocodb.com/tables/create-table" target="_blank" class="text-[13px]">
          {{ $t('title.docs') }}
        </a> -->
        <div
          v-if="isFeatureEnabled(FEATURE_FLAG.AI_FEATURES)"
          :class="{
            'cursor-wait': aiLoading,
          }"
        >
          <NcButton
            type="text"
            size="small"
            class="-my-1 !text-nc-content-purple-dark hover:text-nc-content-purple-dark"
            :class="{
              '!pointer-events-none !cursor-not-allowed': aiLoading,
              '!bg-nc-bg-purple-dark hover:!bg-gray-100': aiMode,
            }"
            @click.stop="aiMode ? disableAiMode() : toggleAiMode()"
          >
            <div class="flex items-center justify-center">
              <GeneralIcon icon="ncAutoAwesome" />
              <span
                class="overflow-hidden trasition-all ease duration-200"
                :class="{ 'w-[0px] invisible': aiMode, 'ml-1 w-[78px]': !aiMode }"
              >
                Use NocoAI
              </span>
            </div>
          </NcButton>
        </div>
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
          <a-form-item v-if="!aiMode" v-bind="validateInfos.title" class="relative nc-table-input-wrapper relative">
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
          <template v-if="aiMode">
            <div v-if="!aiIntegrationAvailable" class="flex items-center gap-3 px-5 pt-2.5 pb-4.5">
              <GeneralIcon icon="alertTriangleSolid" class="!text-nc-content-orange-medium w-4 h-4" />
              <div class="text-sm text-nc-content-gray-subtle flex-1">{{ $t('title.noAiIntegrationAvailable') }}</div>
            </div>

            <AiWizardTabs v-else v-model:active-tab="activeAiTab">
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

                      <div class="nc-animate-dots">Auto suggesting tables for {{ base?.title }}</div>
                    </div>
                  </div>
                  <div v-else-if="aiModeStep === 'pick'" class="flex gap-3 items-start">
                    <div class="flex-1 flex gap-2 flex-wrap">
                      <template v-if="activeTabPredictedTables.length">
                        <template v-for="t of activeTabPredictedTables" :key="t.title">
                          <NcTooltip :disabled="activeTabSelectedTables.length < maxSelectionCount || t.selected">
                            <template #title>
                              <div class="w-[150px]">You can only select {{ maxSelectionCount }} tables to create at a time.</div>
                            </template>

                            <a-tag
                              class="nc-ai-suggested-tag"
                              :class="{
                                'nc-disabled': isAiSaving || (!t.selected && activeTabSelectedTables.length >= maxSelectionCount),
                                'nc-selected': t.selected,
                              }"
                              :disabled="activeTabSelectedTables.length >= maxSelectionCount"
                              @click="onToggleTag(t)"
                            >
                              <div class="flex flex-row items-center gap-1.5 py-[3px] text-small leading-[18px]">
                                <NcCheckbox
                                  :checked="t.selected"
                                  theme="ai"
                                  :disabled="isAiSaving || (t.selected && activeTabSelectedTables.length >= maxSelectionCount)"
                                />

                                <div>{{ t.title }}</div>
                              </div>
                            </a-tag>
                          </NcTooltip>
                        </template>
                      </template>
                      <div v-else class="text-nc-content-gray-subtle2">{{ $t('labels.noData') }}</div>
                    </div>
                    <div class="flex items-center gap-1">
                      <NcTooltip
                        v-if="
                          activeTabPredictHistory.length < activeTabSelectedTables.length
                            ? activeTabPredictHistory.length + activeTabSelectedTables.length < 10
                            : activeTabPredictHistory.length < 10
                        "
                        title="Suggest more"
                        placement="top"
                      >
                        <NcButton
                          v-e="['a:table:ai:predict-more']"
                          size="xs"
                          class="!px-1"
                          type="text"
                          theme="ai"
                          :disabled="isAiSaving"
                          :loading="aiLoading && calledFunction === 'predictMore'"
                          icon-only
                          @click="predictMore"
                        >
                          <template #icon>
                            <GeneralIcon icon="ncPlusAi" class="!text-current" />
                          </template>
                        </NcButton>
                      </NcTooltip>
                      <NcTooltip title="Clear all and Re-suggest" placement="top">
                        <NcButton
                          v-e="['a:table:ai:predict-refresh']"
                          size="xs"
                          class="!px-1"
                          type="text"
                          theme="ai"
                          :disabled="isAiSaving"
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
                    </div>
                  </div>
                </div>
              </template>
              <template #PromptContent>
                <div class="px-5 pt-5 pb-2 flex flex-col gap-5">
                  <div class="relative">
                    <a-textarea
                      ref="aiPromptInputRef"
                      v-model:value="prompt"
                      :disabled="isAiSaving"
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
                        !prompt.trim() ||
                        isPredictFromPromptLoading ||
                        (!!prompt.trim() && prompt.trim() === oldPrompt.trim()) ||
                        isAiSaving
                      "
                      :loading="isPredictFromPromptLoading"
                      icon-only
                      @click="
                        () => {
                          $e('a:table:ai:predict-from-prompt', { prompt })
                          predictFromPrompt()
                        }
                      "
                    >
                      <template #loadingIcon>
                        <GeneralLoader class="!text-purple-700" size="medium" />
                      </template>
                      <template #icon>
                        <GeneralIcon icon="send" class="flex-none h-4 w-4" />
                      </template>
                    </NcButton>
                  </div>

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

                  <div v-else-if="isPromtAlreadyGenerated" class="flex flex-col gap-3">
                    <div class="text-nc-content-purple-dark font-semibold text-xs">Generated Table(s)</div>
                    <div class="flex gap-2 flex-wrap">
                      <template v-if="activeTabPredictedTables.length">
                        <template v-for="t of activeTabPredictedTables" :key="t.title">
                          <NcTooltip :disabled="activeTabSelectedTables.length < maxSelectionCount || t.selected">
                            <template #title>
                              <div class="w-[150px]">You can only select {{ maxSelectionCount }} tables to create at a time.</div>
                            </template>

                            <a-tag
                              class="nc-ai-suggested-tag"
                              :class="{
                                'nc-disabled': isAiSaving || (!t.selected && activeTabSelectedTables.length >= maxSelectionCount),
                                'nc-selected': t.selected,
                              }"
                              :disabled="activeTabSelectedTables.length >= maxSelectionCount"
                              @click="onToggleTag(t)"
                            >
                              <div class="flex flex-row items-center gap-1.5 py-[3px] text-small leading-[18px]">
                                <NcCheckbox
                                  :checked="t.selected"
                                  theme="ai"
                                  :disabled="isAiSaving || (!t.selected && activeTabSelectedTables.length >= maxSelectionCount)"
                                />

                                <div>{{ t.title }}</div>
                              </div>
                            </a-tag>
                          </NcTooltip>
                        </template>
                      </template>
                      <div v-else class="text-nc-content-gray-subtle2">{{ $t('labels.noData') }}</div>
                    </div>
                  </div>
                </div>
              </template>
            </AiWizardTabs>
          </template>
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
          class="flex flex-row items-center justify-between gap-x-2"
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
            <NcButton type="secondary" size="small" :disabled="creating || isAiSaving" @click="dialogShow = false">{{
              $t('general.cancel')
            }}</NcButton>

            <NcButton
              v-if="!aiMode"
              v-e="['a:table:create']"
              type="primary"
              size="small"
              :disabled="validateInfos.title.validateStatus === 'error' || creating"
              :loading="creating"
              @click="_createTable"
            >
              {{ $t('activity.createTable') }}
              <template #loading> {{ $t('title.creatingTable') }} </template>
            </NcButton>
            <NcButton
              v-else-if="aiIntegrationAvailable"
              type="primary"
              theme="ai"
              size="small"
              :disabled="activeTabSelectedTables.length === 0 || isAiSaving"
              :loading="isAiSaving"
              @click="_createTable"
            >
              <div class="flex items-center gap-2 h-5">
                {{
                  activeTabSelectedTables.length
                    ? activeTabSelectedTables.length > 1
                      ? $t('activity.createTables_plural', {
                          count: activeTabSelectedTables.length,
                        })
                      : $t('activity.createTables', {
                          count: activeTabSelectedTables.length,
                        })
                    : $t('activity.createTable')
                }}
              </div>
              <template #loading> {{ $t('title.creatingTable') }} </template>
            </NcButton>

            <NcButton v-else type="primary" size="small" @click="handleNavigateToIntegrations"> Add AI integration </NcButton>
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

<style lang="scss">
.nc-modal-wrapper.nc-modal-table-create-wrapper {
  .ant-modal-content {
    @apply !rounded-5;
  }
}
</style>
