<script setup lang="ts">
import type { RuleObject } from 'ant-design-vue/es/form'
import type { Form, Input } from 'ant-design-vue'
import { computed } from '@vue/reactivity'

import NcCreateBasePlaceholder from '~icons/nc-icons/create-base-placeholder'
import NcCreateBaseWithAiPlaceholder from '~icons/nc-icons/create-base-with-ai-placeholder'

import { stringToViewTypeMap } from 'nocodb-sdk'

enum SchemaPreviewTabs {
  TABLES_AND_VIEWS = 'TABLES_AND_VIEWS',
  RELATIONSHIP_DIAGRAM = 'RELATIONSHIP_DIAGRAM',
}

const previewTabs = [
  {
    title: 'Tables & Views',
    key: SchemaPreviewTabs.TABLES_AND_VIEWS,
  },
  {
    title: 'Relationship Diagram',
    key: SchemaPreviewTabs.RELATIONSHIP_DIAGRAM,
  },
]

const loadingMessages = ['Generating Tables', 'Generating Fields', 'Generating Links', 'Generating Views']

const props = defineProps<{
  modelValue: boolean
  type?: NcProjectType
}>()

const emit = defineEmits(['update:modelValue'])

const dialogShow = useVModel(props, 'modelValue', emit)

const workspaceStore = useWorkspace()
const { activeWorkspace } = storeToRefs(workspaceStore)

const basesStore = useBases()
const { createProject: _createProject } = basesStore

const baseType = computed(() => props.type ?? NcProjectType.DB)

const { refreshCommandPalette } = useCommandPalette()

const { navigateToProject } = useGlobal()

const nameValidationRules = [
  {
    required: true,
    message: 'Database name is required',
  },
  baseTitleValidator(),
] as RuleObject[]

const form = ref<typeof Form>()

const formState = ref({
  title: '',
  meta: {
    iconColor: baseIconColors[Math.floor(Math.random() * 1000) % baseIconColors.length],
  },
})

const creating = ref(false)

const createProject = async () => {
  if (formState.value.title) {
    formState.value.title = formState.value.title.trim()
  }

  creating.value = true
  try {
    const base = await _createProject({
      type: baseType.value,
      title: formState.value.title,
      workspaceId: activeWorkspace.value!.id!,
      meta: formState.value.meta,
    })

    navigateToProject({
      baseId: base.id!,
      workspaceId: activeWorkspace.value!.id!,
      type: baseType.value,
    })

    refreshCommandPalette()

    dialogShow.value = false
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    setTimeout(() => {
      creating.value = false
    }, 500)
  }
}

const { aiLoading, aiError, aiIntegrationAvailable, predictSchema, createSchema } = useNocoAi()

const aiMode = ref<Boolean | null>(null)

const callFunction = ref<string | null>(null)

const modalSize = computed(() => (aiMode.value !== true ? 'small' : 'lg'))

const leftPaneContentRef = ref<HTMLElement | null>(null)
const { y: leftPaneContentOffsetY } = useScroll(leftPaneContentRef)

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

const handleUpdatePreviewExpansionPanel = (key: string) => {
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

const aiPrompt = ref<string>('')

const aiFormState = ref({
  selectedTag: '',
  organization: '',
  industry: '',
  audience: '',
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

    predictedSchema.value = await predictSchema(aiPrompt.value)

    previewExpansionPanel.value = ((predictedSchema.value || {}).tables || []).map((t) => t?.title).filter(Boolean)
    aiStep.value = AI_STEP.MODIFY
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

const onCreateSchema = async () => {
  callFunction.value = 'onCreateSchema'
  try {
    const base = await createSchema(finalSchema.value)
    navigateToProject({
      baseId: base.id!,
      workspaceId: activeWorkspace.value!.id!,
      type: baseType.value,
    })

    dialogShow.value = false
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
    aiStep.value = AI_STEP.PROMPT
  }
}

const input = ref<typeof Input>()

watch(dialogShow, async (n, o) => {
  if (n === o && !n) return

  aiMode.value = null
  aiStep.value = AI_STEP.PROMPT
  aiPrompt.value = ''

  if (!aiIntegrationAvailable.value) {
    aiMode.value = false
  }

  // Clear errors
  setTimeout(async () => {
    form.value?.resetFields()

    formState.value = {
      title: 'Base',
      meta: {
        iconColor: baseIconColors[Math.floor(Math.random() * 1000) % baseIconColors.length],
      },
    }

    await nextTick()

    input.value?.$el?.focus()
    input.value?.$el?.select()
  }, 5)
})

const typeLabel = computed(() => {
  switch (baseType.value) {
    case NcProjectType.DOCS:
      return 'Book'
    case NcProjectType.DB:
      return 'Base'
    default:
      return ''
  }
})
</script>

<template>
  <NcModal
    :key="`${aiMode}`"
    v-model:visible="dialogShow"
    :size="modalSize"
    :show-separator="true"
    :width="aiMode === null ? 'auto' : undefined"
    :wrap-class-name="
      aiMode ? 'nc-modal-ai-base-create' : `nc-modal-wrapper ${aiMode === null ? 'nc-ai-select-base-create-mode-modal' : ''}`
    "
  >
    <template v-if="aiMode === true || aiMode === false" #header>
      <!-- Create A New Table -->
      <div
        v-if="aiMode !== true"
        class="flex flex-row items-center text-base text-gray-800"
        :class="{
          'pt-2 px-4': aiMode === true,
        }"
      >
        <GeneralProjectIcon :color="formState.meta.iconColor" :type="baseType" class="mr-2.5 !text-lg !h-4" />
        Create {{ typeLabel }}
      </div>
      <template v-if="aiMode === true">
        <div class="flex-1 flex items-center gap-3 text-nc-content-purple-dark">
          <GeneralIcon icon="ncAutoAwesome" class="flex-none h-6 w-6 !text-current" />
          <div class="text-xl leading-8 font-bold">Noco AI Base Builder</div>
        </div>
        <div>
          <NcButton
            v-if="aiStep === AI_STEP.MODIFY"
            type="primary"
            size="small"
            theme="ai"
            :loading="aiLoading && callFunction === 'onCreateSchema'"
            @click="onCreateSchema"
          >
            <div class="flex items-center gap-2">
              <GeneralIcon icon="magic" class="!h-4 text-yellow-500" />
              <span class="text-white text-sm">Create Base</span>
            </div>
          </NcButton>
        </div>
      </template>
    </template>
    <template v-if="aiMode === null">
      <div class="nc-create-base-wrapper">
        <div class="nc-create-base" @click="aiMode = false">
          <div class="nc-placeholder-icon-wrapper">
            <component :is="NcCreateBasePlaceholder" class="nc-placeholder-icon stroke-transparent" />
          </div>
          <div class="nc-create-base-content">
            <div class="nc-create-base-content-title">
              <GeneralIcon icon="plus" class="h-4 w-4 !text-nc-content-gray-subtle" />
              Create Blank Base
            </div>
            <div class="nc-create-base-content-subtitle">Build your Base according to your specific requirements.</div>
          </div>
        </div>
        <div class="nc-create-base-ai" @click="aiMode = true">
          <div class="nc-placeholder-icon-wrapper">
            <component :is="NcCreateBaseWithAiPlaceholder" class="nc-placeholder-icon stroke-transparent" />
          </div>
          <div class="nc-create-base-content">
            <div class="nc-create-base-content-title">
              <GeneralIcon icon="ncAutoAwesome" class="h-4 w-4 !text-nc-fill-purple-dark" />
              Build Base with AI
            </div>
            <div class="nc-create-base-content-subtitle">Quickly build your ideal Base with all tables, views and fields.</div>
          </div>
        </div>
      </div>
    </template>
    <template v-if="aiMode === false">
      <div class="mt-1">
        <a-form
          ref="form"
          :model="formState"
          name="basic"
          layout="vertical"
          class="w-full !mx-auto"
          no-style
          autocomplete="off"
          @finish="createProject"
        >
          <a-form-item name="title" :rules="nameValidationRules" class="!mb-0">
            <a-input
              ref="input"
              v-model:value="formState.title"
              name="title"
              class="nc-metadb-base-name nc-input-sm nc-input-shadow"
              placeholder="Title"
            />
          </a-form-item>
        </a-form>

        <div class="flex flex-row justify-end mt-5 gap-x-2">
          <NcButton type="secondary" size="small" @click="dialogShow = false">Cancel</NcButton>
          <NcButton
            v-e="['a:base:create']"
            data-testid="docs-create-proj-dlg-create-btn"
            :loading="creating"
            type="primary"
            size="small"
            :label="`Create ${typeLabel}`"
            :loading-label="`Creating ${typeLabel}`"
            @click="createProject"
          >
            {{ `Create ${typeLabel}` }}
            <template #loading>
              {{ `Creating ${typeLabel}` }}
            </template>
          </NcButton>
        </div>
      </div>
    </template>
    <template v-if="aiMode === true">
      <div class="h-[calc(100%_-_49px)] flex flex-col">
        <!-- Create base error alert box  -->
        <div></div>
        <div class="flex-1 flex h-[calc(100%_-_32px)]">
          <div
            ref="leftPaneContentRef"
            class="w-[432px] h-full relative flex flex-col nc-scrollbar-thin border-r-1 border-purple-100"
          >
            <!-- create base config panel -->
            <div class="flex-1 p-6 flex flex-col gap-6">
              <div class="text-base font-bold text-nc-content-purple-dark">Tell us more about your usecase</div>
              <div class="flex flex-wrap gap-3">
                <!-- Predefined tags -->
                <template v-for="(description, tag) in predefinedAiBasePrompts" :key="tag">
                  <a-tag
                    class="nc-ai-base-schema-tag nc-ai-suggested-tag"
                    :class="{
                      'nc-selected': description === aiPrompt.trim(),
                      'nc-disabled': !aiIntegrationAvailable,
                    }"
                    :disabled="!aiIntegrationAvailable"
                    @click="aiPrompt = description"
                  >
                    <div class="flex flex-row items-center gap-1 py-[3px] text-sm font-weight-500">
                      <div>{{ tag }}</div>
                    </div>
                  </a-tag>
                </template>
              </div>
              <div>
                <a-textarea
                  v-model:value="aiPrompt"
                  placeholder="Type something..."
                  class="!w-full !min-h-[120px] !rounded-lg mt-2 overflow-y-auto nc-scrollbar-thin nc-input-shadow nc-ai-input"
                  size="middle"
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
                        Additional Details
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
                      />
                    </div>
                  </div>
                </a-collapse-panel>
              </a-collapse>
            </div>
            <div
              class="sticky bottom-0 w-full bg-white px-6 py-3 border-t-1"
              :class="{
                'border-nc-border-gray-medium': leftPaneContentOffsetY > 0,
                'border-transparent': leftPaneContentOffsetY <= 0,
              }"
            >
              <NcButton
                size="small"
                type="primary"
                theme="ai"
                class="w-full"
                :disabled="false"
                :loading="aiLoading && callFunction === 'onPredictSchema'"
                @click="onPredictSchema"
              >
                <template #icon>
                  <GeneralIcon icon="ncAutoAwesome" class="h-4 w-4 text-nc-fill-yellow-medium" />
                </template>
                Generate Base
              </NcButton>
            </div>
          </div>
          <div class="w-[calc(100%_-_432px)] h-full p-6 nc-scrollbar-thin flex flex-col gap-6">
            <!-- create base preview panel -->

            <template v-if="aiStep === AI_STEP.LOADING || aiStep === AI_STEP.PROMPT">
              <div v-if="aiStep === AI_STEP.LOADING" class="text-base font-bold text-nc-content-purple-dark">
                Generating a Base tailored to your requirnment...
              </div>
              <div v-else class="text-base font-bold text-nc-content-purple-dark">Preview</div>

              <template v-if="aiStep === AI_STEP.LOADING">
                <div
                  v-for="(loadingText, idx) of activeLoadingText"
                  :key="idx"
                  class="text-sm text-nc-content-purple-light flex items-center"
                >
                  {{ loadingText }}
                  <div v-if="loadingText.length === loadingMessages[idx]?.length" class="nc-animate-dots"></div>
                </div>
              </template>

              <div class="rounded-xl border-1 border-purple-100">
                <div
                  v-for="(row, idx) of ncArrayFrom(7)"
                  :key="idx"
                  class="px-3 py-2 flex items-center gap-2 border-b-1 border-purple-100 last:!border-b-0"
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
            <template v-if="aiStep === AI_STEP.MODIFY">
              <div class="text-base font-bold text-nc-content-purple-dark">Here’s your CRM Base</div>

              <template v-if="predictedSchema?.tables">
                <AiWizardCard v-if="aiMode" v-model:active-tab="activePreviewTab" :tabs="previewTabs" class="!rounded-xl">
                  <template #tabContent>
                    <a-collapse
                      v-if="activePreviewTab === SchemaPreviewTabs.TABLES_AND_VIEWS"
                      v-model:active-key="previewExpansionPanel"
                      class="nc-schema-preview-table flex flex-col"
                    >
                      <template #expandIcon> </template>

                      <a-collapse-panel v-for="table in predictedSchema.tables" :key="table.title" collapsible="disabled">
                        <template #header>
                          <div class="w-full flex items-center px-4 py-2" @click="handleUpdatePreviewExpansionPanel(table.title)">
                            <div class="flex-1 flex items-center gap-3 text-nc-content-purple-dark">
                              <NcCheckbox :checked="!table.excluded" theme="ai" @click.stop="onExcludeTable(table)" />

                              <NcDropdown :trigger="['hover']" class="focus:outline-none">
                                <GeneralIcon icon="table" class="flex-none !h-4 cursor-pointer opacity-90" />

                                <template #overlay>
                                  <div class="flex flex-col gap-2 p-2 max-w-[250px]">
                                    <template v-for="column in table.columns" :key="`${table.title}${column.title}`">
                                      <div
                                        v-if="column.type !== 'ID'"
                                        class="flex items-center gap-2 hover:bg-gray-100 rounded-md px-1 py-1.5"
                                      >
                                        <SmartsheetHeaderCellIcon :column-meta="{ uidt: column.type }" class="!h-4" />
                                        <NcTooltip show-on-truncate-only class="truncate text-sm">
                                          <template #title>
                                            {{ column.title }}
                                          </template>
                                          {{ column.title }}
                                        </NcTooltip>
                                      </div>
                                    </template>
                                    <template
                                      v-for="relationship in predictedSchema.relationships"
                                      :key="`${table.title}${relationship.from}${relationship.to}`"
                                    >
                                      <div
                                        v-if="relationship.from === table.title || relationship.to === table.title"
                                        class="flex items-center gap-2 hover:bg-gray-50 rounded-md px-1 py-1.5"
                                      >
                                        <SmartsheetHeaderVirtualCellIcon
                                          :column-meta="{
                                            uidt: 'Links',
                                            colOptions: {
                                              type:
                                                relationship.to === table.title && relationship.type === 'hm'
                                                  ? 'bt'
                                                  : relationship.type,
                                            },
                                          }"
                                        />

                                        <NcTooltip show-on-truncate-only class="truncate text-sm">
                                          <template #title>
                                            {{ relationship.from === table.title ? relationship.to : relationship.from }}
                                          </template>
                                          {{ relationship.from === table.title ? relationship.to : relationship.from }}
                                        </NcTooltip>
                                      </div>
                                    </template>
                                  </div>
                                </template>
                              </NcDropdown>

                              <NcTooltip show-on-truncate-only class="truncate text-sm font-weight-500">
                                <template #title>
                                  {{ table.title }}
                                </template>
                                {{ table.title }}
                              </NcTooltip>
                            </div>
                            <NcButton size="xs" type="text" theme="ai" icon-only class="!px-0 !h-6 !w-6 !min-w-6">
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
                    <div v-else class="px-4 py-2">No data</div>
                  </template>
                </AiWizardCard>
              </template>
            </template>
          </div>
        </div>
        <!-- Footer  -->
        <div>
          <div class="nc-ai-footer-branding text-xs">
            Powered by
            <span class="font-semibold !text-inherit"> Noco AI </span>
          </div>
        </div>
      </div>
    </template>
  </NcModal>
</template>

<style lang="scss">
.nc-modal-ai-base-create .ant-modal-content {
  .nc-modal {
    @apply !p-0;

    .nc-modal-header {
      @apply mb-0 px-4 py-2 items-center gap-3;
    }

    .ant-checkbox {
      @apply !shadow-none;
    }
  }
}

.nc-modal-wrapper.nc-ai-select-base-create-mode-modal {
  .ant-modal-content {
    @apply !rounded-[28px];
  }
}
</style>

<style lang="scss" scoped>
.nc-create-base-wrapper {
  @apply flex gap-4;

  & > div {
    @apply rounded-xl flex flex-col border-1 w-[288px] overflow-hidden cursor-pointer transition-all;

    .nc-placeholder-icon-wrapper {
      @apply border-b-1 h-[180px] flex items-center justify-center;

      .nc-placeholder-icon {
        @apply flex-none;
      }
    }

    &.nc-create-base {
      @apply border-brand-200;

      &:hover {
        box-shadow: 0px 12px 16px -4px rgba(51, 102, 255, 0.12), 0px 4px 6px -2px rgba(51, 102, 255, 0.08);
      }

      .nc-placeholder-icon-wrapper {
        @apply border-brand-200 bg-nc-bg-brand;
      }
    }

    &.nc-create-base-ai {
      @apply border-purple-200;

      &:hover {
        box-shadow: 0px 12px 16px -4px rgba(125, 38, 205, 0.12), 0px 4px 6px -2px rgba(125, 38, 205, 0.08);
      }

      .nc-placeholder-icon-wrapper {
        @apply border-purple-200 bg-nc-bg-purple-light;
      }
    }

    .nc-create-base-content {
      @apply px-4 py-3 flex flex-col gap-2;

      .nc-create-base-content-title {
        @apply flex items-center gap-2 text-base text-nc-content-gray font-bold;
      }

      .nc-create-base-content-subtitle {
        @apply text-small leading-[18px] text-nc-content-gray-muted;
      }
    }
  }
}

.nc-ai-footer-branding {
  @apply px-6 py-1 flex items-center gap-2 text-nc-content-purple-dark border-t-1 border-purple-100 min-h-8;
}

:deep(.ant-collapse-header) {
  @apply !p-0 flex items-center !cursor-default children:first:flex;
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
    @apply !bg-nc-fill-purple-dark !text-white;
  }
}
</style>
