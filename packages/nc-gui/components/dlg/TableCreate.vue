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
}

const predictRefresh = async () => {
  calledFunction.value = 'predictRefresh'

  const predictions = await predictNextTables(predictHistory.value, props.baseId)

  if (predictions.length) {
    predictedTables.value = predictions
    predictHistory.value.push(...predictions)
    aiModeStep.value = AiStep.pick
  }
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

useEventListener('dblclick', fullAuto)
</script>

<template>
  <NcModal
    v-model:visible="dialogShow"
    :show-separator="false"
    :header="$t('activity.createTable')"
    size="small"
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
          <a-form-item v-bind="aiMode ? {} : validateInfos.title">
            <a-input
              v-if="!aiMode"
              ref="inputEl"
              v-model:value="table.title"
              class="nc-input-sm nc-input-shadow"
              hide-details
              data-testid="create-table-title-input"
              :placeholder="$t('msg.info.enterTableName')"
            />
            <a-input
              v-else
              ref="inputEl"
              v-model:value="table.title"
              class="nc-input-sm nc-input-shadow"
              hide-details
              data-testid="create-table-title-input"
              :placeholder="selectedTables.length ? '' : 'Enter table names or choose from suggestions'"
            />
            <!-- overlay selected tags with close icon on input -->
            <div
              v-if="aiMode"
              class="absolute top-0 right-0 flex mt-1.5 mr-[35px] max-w-[200px] nc-scrollbar-thin overflow-x-auto"
            >
              <a-tag
                v-for="t in selectedTables"
                :key="t"
                class="cursor-pointer !rounded-lg !bg-purple-500 !border-1 !border-purple-500"
              >
                <div class="flex flex-row items-center gap-1 text-white">
                  <span>{{ t }}</span>
                  <GeneralIcon icon="close" class="text-xs cursor-pointer mt-0.5" @click="onTagClose(t)" />
                </div>
              </a-tag>
            </div>
            <!-- Black overlay button on end of input -->
            <div
              v-if="aiIntegrationAvailable"
              class="absolute right-0 top-0 w-[30px] rounded-r-lg h-full flex items-center justify-center"
              :class="{
                'cursor-pointer bg-purple-200 hover:shadow': !aiMode,
                'bg-purple-500': aiMode,
              }"
              @click="toggleAiMode"
            >
              <GeneralIcon icon="magic" class="text-xs text-yellow-300 m-[2px]" :class="{ 'text-yellow-500': aiMode }" />
            </div>
          </a-form-item>

          <template v-if="aiMode">
            <div
              v-if="aiModeStep === AiStep.init"
              class="flex flex-col gap-2 border-1 border-purple-500 rounded-lg bg-purple-50 p-4"
            >
              <div class="flex gap-4 justify-start">
                <GeneralIcon icon="magic" class="text-sm text-purple-500 mt-1" />
                <div class="flex flex-col flex-1 gap-2">
                  <span class="text-sm font-bold">Generating auto suggestions...</span>
                  <span class="text-xs text-gray-500">Working on possible tables for {{ base?.title }}</span>
                </div>
                <GeneralLoader class="h-[20px] mt-1" />
              </div>
            </div>
            <div
              v-else-if="aiModeStep === AiStep.pick"
              class="flex flex-col gap-2 border-1 border-purple-500 rounded-lg bg-purple-50 p-4"
            >
              <div class="flex gap-4 justify-start">
                <GeneralIcon icon="magic" class="text-sm text-purple-500 mt-1" />
                <div class="flex flex-col flex-1 gap-2">
                  <div class="flex gap-2 items-center">
                    <span class="text-sm font-bold">Auto Suggestions</span>
                    <NcTooltip title="Refresh" placement="top">
                      <GeneralLoader v-if="aiLoading && calledFunction === 'predictRefresh'" class="h-[14px]" />
                      <GeneralIcon
                        v-else
                        icon="refresh"
                        class="h-[14px] text-purple-500 cursor-pointer"
                        @click="predictRefresh"
                      />
                    </NcTooltip>
                    <NcTooltip v-if="predictHistory.length < 8" title="Predict More" placement="top">
                      <GeneralLoader v-if="aiLoading && calledFunction === 'predictMore'" class="h-[14px]" />
                      <GeneralIcon
                        v-else
                        icon="plus"
                        class="text-lg text-purple-500 cursor-pointer mt-[2px]"
                        @click="predictMore"
                      />
                    </NcTooltip>
                    <div class="flex-1"></div>
                    <NcTooltip v-if="predictedTables.length" title="Select All" placement="top">
                      <GeneralIcon icon="ncPlusSquare" class="text-lg text-purple-500 cursor-pointer" @click="onSelectAll" />
                    </NcTooltip>
                    <NcTooltip v-else title="Remove All" placement="top">
                      <GeneralIcon icon="ncMinusSquare" class="text-lg text-purple-500 cursor-pointer" @click="onDeselectAll" />
                    </NcTooltip>
                  </div>
                  <span class="text-xs text-gray-500">You can pick multiple from the following suggestions</span>
                </div>
              </div>
              <!-- selectable tags -->
              <div class="flex flex-wrap gap-2 mt-2 ml-4">
                <a-tag
                  v-for="t in predictedTables"
                  :key="t"
                  class="cursor-pointer !rounded-lg !bg-purple-100 !border-1 !border-purple-500"
                  @click="onTagClick(t)"
                >
                  {{ t }}
                </a-tag>
              </div>
            </div>
          </template>

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
              {{ $t('activity.createTable') }}
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
