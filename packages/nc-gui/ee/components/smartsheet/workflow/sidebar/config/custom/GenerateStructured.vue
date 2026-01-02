<script setup lang="ts">
import { IntegrationsType } from 'nocodb-sdk'
import type { SchemaField } from '~/lib/types'

interface GenerateStructuredConfig {
  prompt: string
  integrationId: string
  model?: string
  schema: SchemaField[]
}

const { selectedNodeId, updateNode, selectedNode, fetchNodeIntegrationOptions, isWorkflowEditAllowed } = useWorkflowOrThrow()

const { loadIntegrations: loadIntegrationStore, integrations } = useProvideIntegrationViewStore()

const workflowContext = inject(WorkflowVariableInj, null)

const groupedVariables = computed(() => {
  if (!selectedNodeId.value || !workflowContext?.getAvailableVariables) return []
  return workflowContext.getAvailableVariables(selectedNodeId.value)
})

const flatVariables = computed(() => {
  if (!selectedNodeId.value || !workflowContext?.getAvailableVariablesFlat) return []
  return workflowContext.getAvailableVariablesFlat(selectedNodeId.value)
})

const isSchemaDropdownOpen = ref(false)

const config = computed<GenerateStructuredConfig>(() => {
  return (selectedNode.value?.data?.config || {
    prompt: '',
    integrationId: '',
    model: undefined,
    schema: [],
  }) as GenerateStructuredConfig
})

const schemaCount = computed(() => {
  return config.value.schema?.length || 0
})

// Filter AI integrations
const aiIntegrations = computed(() => {
  return integrations.value.filter((integration) => integration.type === IntegrationsType.Ai)
})

const modelOptions = ref<any[]>([])

const updateConfig = (updates: Partial<GenerateStructuredConfig>) => {
  if (!selectedNodeId.value) return
  updateNode(selectedNodeId.value, {
    data: {
      ...selectedNode.value?.data,
      config: {
        ...config.value,
        ...updates,
      },
    },
  })
}

const loadModels = async () => {
  if (!selectedNode.value || !config.value.integrationId) return
  try {
    const options = await fetchNodeIntegrationOptions(
      {
        type: IntegrationsType.WorkflowNode,
        sub_type: selectedNode.value.type,
        config: config.value,
      },
      'models',
    )
    modelOptions.value = options || []
  } catch (e) {
    console.error('Failed to load models:', e)
  }
}

const onIntegrationChange = async (integrationId: string) => {
  updateConfig({ integrationId, model: undefined })
  await loadModels()
}

const updateSchema = (schema: SchemaField[]) => {
  updateConfig({ schema })
}

const addField = () => {
  const newField: SchemaField = {
    name: '',
    type: 'string',
  }

  const newSchema = [...(config.value.schema || []), newField]
  updateSchema(newSchema)
}

const removeField = (index: number) => {
  const newSchema = [...config.value.schema]
  newSchema.splice(index, 1)
  updateSchema(newSchema)
}

const updateField = (index: number, updates: Partial<SchemaField>) => {
  const newSchema = [...config.value.schema]
  newSchema[index] = { ...newSchema[index], ...updates }
  updateSchema(newSchema)
}

const addProperty = (index: number) => {
  const newSchema = [...config.value.schema]
  if (!newSchema[index].properties) {
    newSchema[index].properties = []
  }
  newSchema[index].properties!.push({
    name: '',
    type: 'string',
  })
  updateSchema(newSchema)
}

const removeProperty = (fieldIndex: number, propIndex: number) => {
  const newSchema = [...config.value.schema]
  newSchema[fieldIndex].properties!.splice(propIndex, 1)
  updateSchema(newSchema)
}

const updateProperty = (fieldIndex: number, propIndex: number, updates: Partial<SchemaField>) => {
  const newSchema = [...config.value.schema]
  newSchema[fieldIndex].properties![propIndex] = {
    ...newSchema[fieldIndex].properties![propIndex],
    ...updates,
  }
  updateSchema(newSchema)
}

const updateArrayItems = (index: number, updates: Partial<SchemaField>) => {
  const newSchema = [...config.value.schema]
  newSchema[index].items = { ...newSchema[index].items, ...updates } as SchemaField
  updateSchema(newSchema)
}

const addEnumOption = (index: number) => {
  const newSchema = [...config.value.schema]
  if (!newSchema[index].enum) {
    newSchema[index].enum = []
  }
  newSchema[index].enum!.push('')
  updateSchema(newSchema)
}

const removeEnumOption = (fieldIndex: number, optionIndex: number) => {
  const newSchema = [...config.value.schema]
  newSchema[fieldIndex].enum!.splice(optionIndex, 1)
  updateSchema(newSchema)
}

const updateEnumOption = (fieldIndex: number, optionIndex: number, value: string) => {
  const newSchema = [...config.value.schema]
  newSchema[fieldIndex].enum![optionIndex] = value
  updateSchema(newSchema)
}

onMounted(async () => {
  await loadIntegrationStore()
  if (config.value.integrationId) {
    await loadModels()
  }
})

const typeOptions = [
  { label: 'String', value: 'string' },
  { label: 'Number', value: 'number' },
  { label: 'Boolean', value: 'boolean' },
  { label: 'Array', value: 'array' },
  { label: 'Object', value: 'object' },
  { label: 'Enum', value: 'enum' },
]

const arrayItemTypeOptions = [
  { label: 'String', value: 'string' },
  { label: 'Number', value: 'number' },
  { label: 'Boolean', value: 'boolean' },
  { label: 'Object', value: 'object' },
]
</script>

<template>
  <div class="generate-structured-config flex flex-col gap-4">
    <div class="flex flex-col gap-2">
      <label class="text-sm font-medium text-nc-content-gray-emphasis">Prompt</label>
      <NcFormBuilderInputWorkflowInput
        :model-value="config.prompt"
        :variables="flatVariables"
        :read-only="!isWorkflowEditAllowed"
        :plugins="['multiline']"
        :grouped-variables="groupedVariables"
        placeholder="Enter your prompt for AI generation"
        @update:model-value="updateConfig({ prompt: $event })"
      />
    </div>

    <div class="flex flex-col gap-2">
      <label class="text-sm font-medium text-nc-content-gray-emphasis">AI Integration</label>
      <a-select
        :value="config.integrationId"
        :disabled="!isWorkflowEditAllowed"
        placeholder="Select AI integration"
        class="w-full"
        @update:value="onIntegrationChange"
      >
        <template #suffixIcon>
          <GeneralIcon icon="ncChevronDown" class="text-nc-content-gray-muted" />
        </template>
        <a-select-option v-for="integration in aiIntegrations" :key="integration.id" :value="integration.id">
          <div class="w-full flex gap-2 items-center">
            <GeneralIntegrationIcon v-if="integration?.sub_type" :type="integration.sub_type" />
            <NcTooltip class="flex-1 truncate">
              <template #title>
                {{ integration.title }}
              </template>
              {{ integration.title }}
            </NcTooltip>
            <GeneralIcon v-if="config.integrationId === integration.id" icon="ncCheck" class="text-primary w-4 h-4" />
          </div>
        </a-select-option>
      </a-select>
    </div>

    <div v-if="config.integrationId" class="flex flex-col gap-2">
      <label class="text-sm font-medium text-nc-content-gray-emphasis">Model</label>
      <NcSelect
        :disabled="!isWorkflowEditAllowed"
        :value="config.model"
        :options="modelOptions"
        placeholder="Select model"
        @update:value="updateConfig({ model: $event })"
      >
        <a-select-option
          v-for="option in modelOptions"
          :key="option.value"
          :value="option.value"
          :disabled="option.ncItemDisabled"
        >
          <div class="flex items-center justify-between gap-2">
            <NcTooltip v-if="option.ncItemTooltip" class="flex-1">
              <template #title>{{ option.ncItemTooltip }}</template>
              <span :class="{ 'text-nc-content-gray-disabled': option.ncItemDisabled }">{{ option.label }}</span>
            </NcTooltip>
            <span v-else :class="{ 'text-nc-content-gray-disabled': option.ncItemDisabled }">{{ option.label }}</span>
            <GeneralIcon v-if="config.model === option.value" icon="ncCheck" class="text-primary w-4 h-4" />
          </div>
        </a-select-option>
      </NcSelect>
    </div>

    <div class="flex flex-col gap-2">
      <label class="text-sm font-medium text-nc-content-gray-emphasis">Output Schema</label>

      <NcListDropdown
        v-model:visible="isSchemaDropdownOpen"
        :disabled="!isWorkflowEditAllowed"
        placement="bottomLeft"
        overlay-class-name="nc-schema-dropdown"
      >
        <div
          class="nc-schema-count flex-1"
          :class="{
            'text-nc-content-brand': schemaCount > 0,
            'text-nc-content-gray-muted': schemaCount === 0,
          }"
        >
          {{ schemaCount > 0 ? `${schemaCount} field${schemaCount !== 1 ? 's' : ''}` : 'No fields defined' }}
        </div>

        <GeneralIcon
          icon="ncChevronDown"
          class="flex-none w-4 h-4"
          :class="{
            'text-nc-content-brand': schemaCount > 0,
            'text-nc-content-gray-muted': schemaCount === 0,
          }"
        />

        <template #overlay>
          <div class="nc-schema-dropdown-container p-3">
            <div v-if="config.schema.length === 0" class="text-sm text-nc-content-gray-muted text-center py-4">
              Click "Add Field" to define output fields
            </div>

            <div v-else class="space-y-2 mb-3">
              <div v-for="(field, fieldIndex) in config.schema" :key="fieldIndex" class="nc-schema-field">
                <div class="flex items-center">
                  <a-input
                    :value="field.name"
                    placeholder="Field name"
                    size="small"
                    class="flex-1 !rounded-l-lg rounded-r-none"
                    @update:value="updateField(fieldIndex, { name: $event })"
                  />
                  <NcSelect
                    :value="field.type"
                    :options="typeOptions"
                    class="w-28 nc-type-select"
                    @update:value="updateField(fieldIndex, { type: $event as any })"
                  />
                  <NcButton size="xs" type="text" @click="removeField(fieldIndex)">
                    <GeneralIcon icon="close" class="w-4 h-4 text-nc-content-gray-subtle" />
                  </NcButton>
                </div>

                <!-- Array type configuration -->
                <div v-if="field.type === 'array'" class="mt-2 ml-4 pl-3 border-l-2 border-nc-border-gray-light space-y-2">
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-nc-content-gray-muted">Item type:</span>
                    <NcSelect
                      :value="field.items?.type || 'string'"
                      :options="arrayItemTypeOptions"
                      class="flex-1"
                      @update:value="updateArrayItems(fieldIndex, { type: $event as any })"
                    />
                  </div>

                  <!-- Object properties for array items -->
                  <div v-if="field.items?.type === 'object'" class="space-y-1.5">
                    <div
                      v-for="(prop, propIndex) in field.items.properties || []"
                      :key="propIndex"
                      class="flex gap-2 items-center"
                    >
                      <a-input
                        :value="prop.name"
                        placeholder="Property"
                        size="small"
                        class="flex-1"
                        @update:value="
                          updateArrayItems(fieldIndex, {
                            properties: field.items!.properties!.map((p, i) => (i === propIndex ? { ...p, name: $event } : p)),
                          })
                        "
                      />
                      <NcSelect
                        :value="prop.type"
                        :options="[
                          { label: 'String', value: 'string' },
                          { label: 'Number', value: 'number' },
                          { label: 'Boolean', value: 'boolean' },
                        ]"
                        class="w-24"
                        @update:value="
                          updateArrayItems(fieldIndex, {
                            properties: field.items!.properties!.map((p, i) =>
                              i === propIndex ? { ...p, type: $event as any } : p,
                            ),
                          })
                        "
                      />
                      <NcButton
                        size="xs"
                        type="text"
                        @click="
                          updateArrayItems(fieldIndex, {
                            properties: field.items!.properties!.filter((_, i) => i !== propIndex),
                          })
                        "
                      >
                        <GeneralIcon icon="close" class="w-4 h-4 text-nc-content-gray-subtle" />
                      </NcButton>
                    </div>
                    <NcButton
                      type="text"
                      size="xs"
                      @click="
                        updateArrayItems(fieldIndex, {
                          properties: [...(field.items?.properties || []), { name: '', type: 'string' }],
                        })
                      "
                    >
                      <template #icon>
                        <GeneralIcon icon="plus" class="w-4 h-4" />
                      </template>
                      Add Property
                    </NcButton>
                  </div>
                </div>

                <!-- Object type configuration -->
                <div v-if="field.type === 'object'" class="mt-2 ml-4 pl-3 border-l-2 border-nc-border-gray-light space-y-1.5">
                  <div v-for="(prop, propIndex) in field.properties || []" :key="propIndex" class="flex gap-2 items-center">
                    <a-input
                      :value="prop.name"
                      placeholder="Property"
                      size="small"
                      class="flex-1"
                      @update:value="updateProperty(fieldIndex, propIndex, { name: $event })"
                    />
                    <NcSelect
                      :value="prop.type"
                      :options="[
                        { label: 'String', value: 'string' },
                        { label: 'Number', value: 'number' },
                        { label: 'Boolean', value: 'boolean' },
                      ]"
                      class="w-24"
                      @update:value="updateProperty(fieldIndex, propIndex, { type: $event as any })"
                    />
                    <NcButton size="xs" type="text" @click="removeProperty(fieldIndex, propIndex)">
                      <GeneralIcon icon="close" class="w-4 h-4 text-nc-content-gray-subtle" />
                    </NcButton>
                  </div>
                  <NcButton type="text" size="xs" @click="addProperty(fieldIndex)">
                    <template #icon>
                      <GeneralIcon icon="plus" class="w-4 h-4" />
                    </template>
                    Add Property
                  </NcButton>
                </div>

                <!-- Enum type configuration -->
                <div v-if="field.type === 'enum'" class="mt-2 ml-4 pl-3 border-l-2 border-nc-border-gray-light space-y-1.5">
                  <div v-for="(option, optionIndex) in field.enum || []" :key="optionIndex" class="flex gap-2 items-center">
                    <a-input
                      :value="option"
                      placeholder="Option"
                      size="small"
                      class="flex-1"
                      @update:value="updateEnumOption(fieldIndex, optionIndex, $event)"
                    />
                    <NcButton size="xs" type="text" @click="removeEnumOption(fieldIndex, optionIndex)">
                      <GeneralIcon icon="close" class="w-4 h-4 text-nc-content-gray-subtle" />
                    </NcButton>
                  </div>
                  <NcButton type="text" size="xs" @click="addEnumOption(fieldIndex)">
                    <template #icon>
                      <GeneralIcon icon="plus" class="w-4 h-4" />
                    </template>
                    Add Option
                  </NcButton>
                </div>
              </div>
            </div>

            <NcButton type="text" size="small" @click="addField()">
              <template #icon>
                <GeneralIcon icon="plus" class="w-4 h-4" />
              </template>
              Add Field
            </NcButton>
          </div>
        </template>
      </NcListDropdown>
    </div>
  </div>
</template>

<style lang="scss">
.nc-schema-dropdown {
  @apply !min-w-[500px] !max-w-[600px];

  .ant-dropdown-menu {
    @apply !p-0;
  }
}
</style>

<style scoped lang="scss">
.nc-schema-dropdown-container {
  @apply max-h-[500px] overflow-y-auto;
}

.nc-schema-field {
  :deep(.ant-input-sm) {
    @apply !h-8;
  }
}

:deep(.nc-select:not(.ant-select-disabled):hover) {
  &,
  .ant-select-selector {
    @apply bg-nc-bg-gray-extralight;
  }
}

:deep(.nc-type-select) {
  .ant-select-selector {
    @apply !rounded-l-none !border-nc-border-gray-medium !border-l-0 !shadow-none;
  }
}
</style>
