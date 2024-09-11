<script setup lang="ts">
import type { TableType } from 'nocodb-sdk'

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

const { aiIntegrationAvailable, aiLoading, generateTables, predictNextTables } = useNocoAi()

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

const toggleAiMode = async () => {
  if (aiMode.value) return

  aiMode.value = true
  aiModeStep.value = AiStep.init
  predictedTables.value = []
  predictHistory.value = []

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

const predictMore = async () => {
  calledFunction.value = 'predictMore'

  const predictions: string[] = await predictNextTables(predictHistory.value, props.baseId)

  if (predictions.length) {
    predictedTables.value.push(...predictions.filter((t) => !predictedTables.value.includes(t)))
    predictHistory.value.push(...predictions)
  }

  calledFunction.value = undefined
}

const predictRefresh = async () => {
  calledFunction.value = 'predictRefresh'

  const predictions = await predictNextTables(predictHistory.value, props.baseId)

  if (predictions.length) {
    predictedTables.value = predictions
    predictHistory.value.push(...predictions)
    aiModeStep.value = AiStep.pick
  }

  calledFunction.value = undefined
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
  selectedTables.value.push(...predictedTables.value)
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

onMounted(() => {
  generateUniqueTitle()
  nextTick(() => {
    inputEl.value?.focus()
    inputEl.value?.select()
    initTitle.value = table.title
  })
})

const fullAuto = async () => {
  if (!aiModeStep.value) {
    await toggleAiMode()
  } else if (aiModeStep.value === AiStep.pick && selectedTables.value.length === 0) {
    await onSelectAll()
  } else if (aiModeStep.value === AiStep.pick && selectedTables.value.length > 0) {
    await onAiEnter()
  }
}

const isDisabled = ref(false)

// useEventListener('dblclick', fullAuto)
</script>

<template>
  <NcModal
    v-model:visible="dialogShow"
    :show-separator="false"
    :header="$t('activity.createTable')"
    size="sm"
    height="auto"
    @keydown.esc="dialogShow = false"
  >
    <template #header>
      <div class="flex justify-between w-full items-center">
        <div class="flex flex-row items-center gap-x-2 text-base font-semibold text-gray-800">
          <GeneralIcon icon="table" class="!text-gray-600 w-5 h-5" />
          {{ $t('activity.createTable') }}
        </div>
        <a href="https://docs.nocodb.com/tables/create-table" target="_blank" class="text-[13px]">
          {{ $t('title.docs') }}
        </a>
      </div>
    </template>
    <div class="flex flex-col mt-1">
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
              class="nc-input-md nc-input-shadow"
              hide-details
              data-testid="create-table-title-input"
              :placeholder="$t('msg.info.enterTableName')"
            />
            <a-input
              v-else
              ref="inputEl"
              v-model:value="table.title"
              class="nc-input-md nc-input-shadow"
              hide-details
              data-testid="create-table-title-input"
              :placeholder="selectedTables.length ? '' : 'Enter table names or choose from suggestions'"
            />
            <!-- overlay selected tags with close icon on input -->
            <div
              v-if="aiMode"
              class="absolute top-0 max-w-[calc(100%_-_16px)] left-0 h-10 flex items-center gap-2 mx-2 nc-scrollbar-thin overflow-x-auto"
            >
              <a-tag
                v-for="t in selectedTables"
                :key="t"
                class="cursor-pointer !rounded-md !bg-nc-bg-brand !text-nc-content-brand !border-none font-semibold !mx-0"
              >
                <div class="flex flex-row items-center gap-1 py-1 text-sm">
                  <span>{{ t }}</span>
                  <GeneralIcon icon="close" class="cursor-pointer" @click="onTagClose(t)" />
                </div>
              </a-tag>
            </div>
          </a-form-item>

          <!-- Ai table wizard  -->
          <AiWizardCard v-model:is-disabled="isDisabled">
            <template #title> AI Table Wizard </template>
            <template #subtitle>
              <div v-if="aiModeStep === AiStep.init">
                <div>Noco AI is analyzing to suggest the best table configuration.</div>
                <div>Please wait as we prepare your customized fields.</div>
              </div>
              <div v-else-if="aiModeStep === AiStep.pick">
                <template v-if="selectedTables.length && !predictedTables.length">
                  You have accepted {{ selectedTables.length }} auto suggested tables. Click create button to proceed.
                </template>
                <template v-if="aiLoading && !calledFunction"> Creating auto suggested tables now, please wait. </template>
                <template v-else> Click on each AI-generated table to accept the automatic suggestions. </template>
              </div>
              <div v-else>Create AI-generated table(s) including fields optimized for {{ base?.title }}</div>
            </template>

            <template #tags>
              <template v-for="t of predictedTables" :key="t">
                <a-tag
                  v-if="!removedFromPredictedTables.has(t)"
                  class="cursor-pointer !rounded-md !bg-nc-bg-purple-dark !text-nc-content-purple-dark !border-none !mx-0"
                  @click="onTagClick(t)"
                >
                  <div class="flex flex-row items-center gap-1 py-0.5">
                    <span>{{ t }}</span>
                    <GeneralIcon icon="close" class="text-xs cursor-pointer mt-0.5" @click.stop="onTagRemoveFromPrediction(t)" />
                  </div>
                </a-tag>
              </template>
            </template>

            <template #footer>
              <div class="flex-1 flex items-center justify-end gap-2">
                <template v-if="aiModeStep === AiStep.pick">
                  <NcTooltip title="Re-suggest" placement="top">
                    <NcButton
                      size="xs"
                      class="!px-1 !text-current hover:!bg-purple-200"
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
                  <NcTooltip v-if="predictHistory.length < 8" title="Suggest more" placement="top">
                    <NcButton
                      size="xs"
                      class="!px-1 !text-current hover:!bg-purple-200"
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
                <NcButton
                  v-if="aiModeStep === AiStep.init"
                  size="xs"
                  class="!bg-nc-bg-purple-light hover:!bg-nc-bg-purple-dark !text-nc-content-purple-dark !border-purple-200"
                  type="secondary"
                  loading
                >
                  <template #loadingIcon>
                    <GeneralLoader class="!text-current" />
                  </template>
                  <div class="flex items-center gap-2">Generating Tables</div>
                </NcButton>
                <template v-else-if="aiModeStep === AiStep.pick">
                  <NcButton
                    v-if="predictedTables.length || !selectedTables.length"
                    size="xs"
                    class="!bg-nc-bg-purple-light !border-purple-200"
                    type="secondary"
                    :disabled="!predictedTables.length"
                    :class="{
                      'hover:!bg-nc-bg-purple-dark !text-nc-content-purple-dark': predictedTables.length,
                      '!text-nc-content-purple-light': !predictedTables.length,
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
                    class="!bg-nc-bg-purple-light hover:!bg-nc-bg-purple-dark !text-nc-content-purple-dark !border-purple-200"
                    type="secondary"
                    @click="onDeselectAll"
                  >
                    <div class="flex items-center gap-2">
                      <GeneralIcon icon="ncMinus" class="flex-none" />

                      Remove All Tables
                    </div>
                  </NcButton>
                </template>
                <NcButton
                  v-else
                  size="xs"
                  class="!bg-nc-bg-purple-light hover:!bg-nc-bg-purple-dark !text-nc-content-purple-dark !border-purple-200"
                  type="secondary"
                  @click="toggleAiMode"
                >
                  <div class="flex items-center gap-2">
                    <GeneralIcon icon="ncZap" class="flex-none" />

                    Auto Suggest Tables
                  </div>
                </NcButton>
              </div>
            </template>
          </AiWizardCard>

          <a-form-item
            v-if="enableDescription"
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
        <div v-if="isAdvanceOptVisible" class="nc-table-advanced-options" :class="{ active: isAdvanceOptVisible }">
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
              :loading="aiLoading"
              @click="_createTable"
            >
              <div class="flex items-center gap-2 h-5">
                {{ $t('activity.createTable') }}

                <div v-if="selectedTables.length" class="rounded-md border-1 border-brand-200 px-1 h-full flex items-center">
                  {{ selectedTables.length }}
                </div>
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
</style>
