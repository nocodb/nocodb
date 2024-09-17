<script setup lang="ts">
import type { RuleObject } from 'ant-design-vue/es/form'
import type { Form, Input } from 'ant-design-vue'
import { computed } from '@vue/reactivity'

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

const { aiIntegrationAvailable, predictSchema, createSchema } = useNocoAi()

const aiMode = ref<Boolean | null>(null)

const modalSize = computed(() => (aiMode.value !== true ? 'small' : 'large'))

enum AI_STEP {
  LOADING = 0,
  PROMPT = 1,
  MODIFY = 2,
}

const aiStep = ref(AI_STEP.PROMPT)

const aiPrompt = ref<string>()

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

const aiTableExpanded = ref<Record<string, boolean>>({})

const onPredictSchema = async () => {
  aiStep.value = AI_STEP.LOADING
  try {
    predictedSchema.value = await predictSchema(aiPrompt.value)
    aiStep.value = AI_STEP.MODIFY
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
    aiStep.value = AI_STEP.PROMPT
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
  aiStep.value = AI_STEP.LOADING
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
    :height="aiMode ? 864 : undefined"
    :show-separator="true"
    :wrap-class-name="aiMode ? 'nc-modal-ai-base-create' : 'nc-modal-wrapper'"
  >
    <template #header>
      <!-- Create A New Table -->
      <div
        class="flex flex-row items-center text-base text-gray-800"
        :class="{
          'pt-2 px-4': aiMode === true,
        }"
      >
        <GeneralProjectIcon :color="formState.meta.iconColor" :type="baseType" class="mr-2.5 !text-lg !h-4" />
        Create {{ typeLabel }}
      </div>
      <template v-if="aiMode === true">
        <div class="flex-1"></div>
        <div
          :class="{
            'pt-2 px-4': aiMode === true,
          }"
        >
          <NcButton v-if="aiStep === AI_STEP.PROMPT" type="ghost" size="small" class="!bg-purple-600" @click="onPredictSchema">
            <div class="flex items-center gap-2">
              <GeneralIcon icon="magic" class="!h-4 text-yellow-500" />
              <span class="text-white text-sm">Generate Base</span>
            </div>
          </NcButton>
          <NcButton
            v-else-if="aiStep === AI_STEP.MODIFY"
            type="ghost"
            size="small"
            class="!bg-purple-600"
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
      <div class="flex gap-4">
        <NcButton type="ghost" class="w-full !rounded-lg !bg-gray-100 !h-[80px]" @click="aiMode = false">
          <div class="flex flex-col items-center gap-3 w-full">
            <div class="w-full flex items-start">
              <GeneralIcon icon="plusSquare" class="!h-4" />
            </div>
            <span>Create Empty Base</span>
          </div>
        </NcButton>
        <NcButton type="ghost" class="w-full !rounded-lg !bg-purple-100 !h-[80px]" @click="aiMode = true">
          <div class="flex flex-col items-center gap-3 w-full text-purple-500">
            <div class="w-full flex items-start">
              <GeneralIcon icon="magic" class="!h-4" />
            </div>
            <span>Create Base with AI</span>
          </div>
        </NcButton>
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
      <div class="w-full min-h-[600px] p-4">
        <template v-if="aiStep === AI_STEP.PROMPT">
          <div class="flex flex-col items-center gap-4">
            <div class="text-lg font-bold">Tell us more about your usecase</div>
            <a-textarea
              v-model:value="aiPrompt"
              placeholder="Type something..."
              class="!w-full !rounded-lg mt-2 !max-w-[300px] overflow-y-auto"
              size="middle"
              :rows="3"
              :autosize="{
                minRows: 3,
                maxRows: 3,
              }"
            />
          </div>
        </template>
        <template v-if="aiStep === AI_STEP.LOADING">
          <div class="flex flex-col h-[500px] items-center justify-center">
            <GeneralLoader size="xlarge" />
          </div>
        </template>
        <template v-if="aiStep === AI_STEP.MODIFY">
          <div class="flex flex-col gap-4 w-full">
            <div v-if="predictedSchema?.tables" class="flex flex-col w-full items-center">
              <template v-for="(table, index) in predictedSchema.tables" :key="table.title">
                <div
                  class="flex items-center gap-2 bg-purple-200 p-2 w-[40%] text-purple-500 cursor-pointer"
                  :class="{
                    'rounded-t-lg': index === 0,
                    'rounded-b-lg': index === predictedSchema.tables.length - 1 && !aiTableExpanded?.[table.title],
                    'border-b-1 border-purple-300': index !== predictedSchema.tables.length - 1,
                  }"
                  @click="aiTableExpanded[table.title] = !aiTableExpanded[table.title]"
                >
                  <GeneralIcon :icon="aiTableExpanded?.[table.title] ? 'arrowDown' : 'arrowRight'" class="!h-4" />
                  <NcDropdown :trigger="['hover']">
                    <template #overlay>
                      <div class="flex flex-col gap-2 p-2">
                        <template v-for="column in table.columns" :key="`${table.title}${column.title}`">
                          <div v-if="column.type !== 'ID'" class="flex items-center gap-2">
                            <SmartsheetHeaderCellIcon :column-meta="{ uidt: column.type }" class="!h-4" />
                            <div class="text-sm">{{ column.title }}</div>
                          </div>
                        </template>
                        <template
                          v-for="relationship in predictedSchema.relationships"
                          :key="`${table.title}${relationship.from}${relationship.to}`"
                        >
                          <div
                            v-if="relationship.from === table.title || relationship.to === table.title"
                            class="flex items-center gap-2"
                          >
                            <SmartsheetHeaderVirtualCellIcon
                              :column-meta="{
                                uidt: 'Links',
                                colOptions: {
                                  type: relationship.to === table.title && relationship.type === 'hm' ? 'bt' : relationship.type,
                                },
                              }"
                            />
                            <div class="text-sm">
                              {{ relationship.from === table.title ? relationship.to : relationship.from }}
                            </div>
                          </div>
                        </template>
                      </div>
                    </template>
                    <GeneralIcon icon="table" class="!h-4" />
                  </NcDropdown>
                  <div class="text-md font-bold">{{ table.title }}</div>
                  <div class="flex-1"></div>
                  <NcCheckbox :checked="!table.excluded" @click.stop="onExcludeTable(table)" />
                </div>
                <!-- Views -->
                <div v-if="aiTableExpanded?.[table.title] === true" class="flex flex-col items-center w-full">
                  <template v-for="(view, vIndex) in viewsGrouped[table.title]" :key="view.title">
                    <div
                      class="flex items-center gap-2 bg-purple-100 p-2 w-[40%] text-purple-500 cursor-pointer"
                      :class="{
                        'rounded-b-lg':
                          index === predictedSchema.tables.length - 1 && vIndex === viewsGrouped[table.title].length - 1,
                        'border-b-1 border-purple-200': vIndex !== viewsGrouped[table.title].length - 1,
                      }"
                    >
                      <div class="text-md">{{ view.title }}</div>
                      <div class="flex-1"></div>
                      <NcCheckbox :checked="!view.excluded" @click.stop="onExcludeView(view)" />
                    </div>
                  </template>
                </div>
              </template>
            </div>
          </div>
        </template>
      </div>
    </template>
  </NcModal>
</template>

<style lang="scss">
.nc-modal-ai-base-create .ant-modal-content {
  @apply bg-[#fefaff];
  .nc-modal {
    @apply !p-0;

    .ant-checkbox {
      @apply !shadow-none;
    }
  }
}
</style>
