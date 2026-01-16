<script setup lang="ts">
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD'
type BodyType = 'none' | 'json' | 'urlencoded' | 'multipartForm' | 'plainText' | 'xml'

interface KeyValuePair {
  key: string
  value: string
}

interface HttpRequestConfig {
  method: HttpMethod
  url: string
  headers: KeyValuePair[]
  queryParams: KeyValuePair[]
  bodyType: BodyType
  body?: string
  timeout: number
  followRedirects: boolean
  validateStatus: boolean
}

const { selectedNodeId, updateNode, selectedNode, isWorkflowEditAllowed } = useWorkflowOrThrow()

const workflowContext = inject(WorkflowVariableInj, null)

const groupedVariables = computed(() => {
  if (!selectedNodeId.value || !workflowContext?.getAvailableVariables) return []
  return workflowContext.getAvailableVariables(selectedNodeId.value)
})

const flatVariables = computed(() => {
  if (!selectedNodeId.value || !workflowContext?.getAvailableVariablesFlat) return []
  return workflowContext.getAvailableVariablesFlat(selectedNodeId.value)
})

const defaultConfig: HttpRequestConfig = {
  method: 'GET',
  url: '',
  headers: [],
  queryParams: [],
  bodyType: 'none',
  body: '',
  timeout: 30000,
  followRedirects: true,
  validateStatus: true,
}

const config = computed<HttpRequestConfig>(() => {
  return (selectedNode.value?.data?.config || defaultConfig) as HttpRequestConfig
})

onMounted(() => {
  if (!selectedNode.value?.data?.config || Object.keys(selectedNode.value.data.config).length === 0) {
    updateConfig(defaultConfig)
  }
})

const updateConfig = (updates: Partial<HttpRequestConfig>) => {
  if (!selectedNodeId.value) return
  updateNode(selectedNodeId.value, {
    data: {
      ...selectedNode.value?.data,
      config: {
        ...config.value,
        ...updates,
      },
      testResult: {
        ...(selectedNode.value?.data?.testResult || {}),
        isStale: true,
      },
    },
  })
}

const httpMethods: { label: string; value: HttpMethod }[] = [
  { label: 'GET', value: 'GET' },
  { label: 'POST', value: 'POST' },
  { label: 'PUT', value: 'PUT' },
  { label: 'PATCH', value: 'PATCH' },
  { label: 'DELETE', value: 'DELETE' },
  { label: 'HEAD', value: 'HEAD' },
]

const bodyTypes: { label: string; value: BodyType }[] = [
  { label: 'None', value: 'none' },
  { label: 'JSON', value: 'json' },
  { label: 'Form URL Encoded', value: 'urlencoded' },
  { label: 'Multipart Form Data', value: 'multipartForm' },
  { label: 'Raw Text', value: 'plainText' },
  { label: 'XML', value: 'xml' },
]

const methodSupportsBody = computed(() => {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(config.value.method)
})

// Headers management
const headers = computed(() => config.value.headers || [])

const addHeader = () => {
  updateConfig({
    headers: [...headers.value, { key: '', value: '' }],
  })
}

const updateHeader = (index: number, field: 'key' | 'value', newValue: string) => {
  const newHeaders = [...headers.value]
  newHeaders[index] = { ...newHeaders[index], [field]: newValue }
  updateConfig({ headers: newHeaders })
}

const removeHeader = (index: number) => {
  const newHeaders = headers.value.filter((_, i) => i !== index)
  updateConfig({ headers: newHeaders })
}

// Query params management
const queryParams = computed(() => config.value.queryParams || [])

const addQueryParam = () => {
  updateConfig({
    queryParams: [...queryParams.value, { key: '', value: '' }],
  })
}

const updateQueryParam = (index: number, field: 'key' | 'value', newValue: string) => {
  const newParams = [...queryParams.value]
  newParams[index] = { ...newParams[index], [field]: newValue }
  updateConfig({ queryParams: newParams })
}

const removeQueryParam = (index: number) => {
  const newParams = queryParams.value.filter((_, i) => i !== index)
  updateConfig({ queryParams: newParams })
}

const showHeaders = ref(headers.value.length > 0)
const showQueryParams = ref(queryParams.value.length > 0)
const showBody = ref(config.value.bodyType !== 'none')
const showAdvanced = ref(false)
</script>

<template>
  <div class="http-request-config flex flex-col gap-4">
    <div class="flex flex-col gap-2">
      <label class="text-sm font-medium text-nc-content-gray-emphasis">Method</label>
      <NcSelect
        :value="config.method"
        :disabled="!isWorkflowEditAllowed"
        class="nc-http-method-select w-full"
        dropdown-class-name="nc-dropdown-http-method"
        @update:value="(val) => updateConfig({ method: val })"
      >
        <a-select-option v-for="method in httpMethods" :key="method.value" :value="method.value">
          <span class="font-medium">{{ method.label }}</span>
        </a-select-option>
      </NcSelect>
    </div>

    <div class="flex flex-col gap-2">
      <label class="text-sm font-medium text-nc-content-gray-emphasis">URL</label>
      <NcFormBuilderInputWorkflowInput
        :model-value="config.url"
        :variables="flatVariables"
        :read-only="!isWorkflowEditAllowed"
        :grouped-variables="groupedVariables"
        placeholder="https://api.example.com/endpoint"
        @update:model-value="(val) => updateConfig({ url: val })"
      />
    </div>

    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between cursor-pointer py-1" @click="showQueryParams = !showQueryParams">
        <label class="text-sm font-medium text-nc-content-gray-emphasis cursor-pointer">Query Parameters</label>
        <GeneralIcon :icon="showQueryParams ? 'ncChevronDown' : 'ncChevronRight'" class="text-nc-content-gray-muted w-4 h-4" />
      </div>
      <div v-if="showQueryParams" class="flex flex-col gap-2">
        <div v-for="(param, index) in queryParams" :key="`param-${index}`" class="flex gap-2 items-start">
          <a-input
            :value="param.key"
            :disabled="!isWorkflowEditAllowed"
            placeholder="Parameter name"
            class="nc-input-sm border-nc-border-gray-medium flex-1"
            @update:value="(val) => updateQueryParam(index, 'key', val)"
          />
          <NcFormBuilderInputWorkflowInput
            :model-value="param.value"
            :variables="flatVariables"
            :read-only="!isWorkflowEditAllowed"
            :grouped-variables="groupedVariables"
            placeholder="Value"
            class="flex-1 max-w-32"
            @update:model-value="(val) => updateQueryParam(index, 'value', val)"
          />
          <NcButton
            :disabled="!isWorkflowEditAllowed"
            size="small"
            type="text"
            class="!px-1 !hover:bg-nc-bg-red-light"
            @click="removeQueryParam(index)"
          >
            <GeneralIcon icon="ncTrash" class="text-nc-content-red-medium w-4 h-4" />
          </NcButton>
        </div>
        <div>
          <NcButton :disabled="!isWorkflowEditAllowed" size="small" type="text" @click="addQueryParam">
            <div class="flex gap-2 text-nc-content-brand items-center">
              <GeneralIcon icon="ncPlus" />
              Add parameter
            </div>
          </NcButton>
        </div>
      </div>
    </div>

    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between cursor-pointer py-1" @click="showHeaders = !showHeaders">
        <label class="text-sm font-medium text-nc-content-gray-emphasis cursor-pointer">Headers</label>
        <GeneralIcon :icon="showHeaders ? 'ncChevronDown' : 'ncChevronRight'" class="text-nc-content-gray-muted w-4 h-4" />
      </div>
      <div v-if="showHeaders" class="flex flex-col gap-2">
        <div v-for="(header, index) in headers" :key="`header-${index}`" class="flex gap-2 items-start">
          <a-input
            :value="header.key"
            :disabled="!isWorkflowEditAllowed"
            placeholder="Header name"
            class="nc-input-sm border-nc-border-gray-medium flex-1"
            @update:value="(val) => updateHeader(index, 'key', val)"
          />
          <NcFormBuilderInputWorkflowInput
            :model-value="header.value"
            :variables="flatVariables"
            :read-only="!isWorkflowEditAllowed"
            :grouped-variables="groupedVariables"
            placeholder="Value"
            class="flex-1 max-w-32"
            @update:model-value="(val) => updateHeader(index, 'value', val)"
          />
          <NcButton
            :disabled="!isWorkflowEditAllowed"
            size="small"
            type="text"
            class="!px-1 !hover:bg-nc-bg-red-light"
            @click="removeHeader(index)"
          >
            <GeneralIcon icon="ncTrash" class="text-nc-content-red-medium w-4 h-4" />
          </NcButton>
        </div>
        <div>
          <NcButton :disabled="!isWorkflowEditAllowed" size="small" type="text" @click="addHeader">
            <div class="flex gap-2 text-nc-content-brand items-center">
              <GeneralIcon icon="ncPlus" />
              Add header
            </div>
          </NcButton>
        </div>
      </div>
    </div>

    <div v-if="methodSupportsBody" class="flex flex-col gap-2">
      <div class="flex items-center justify-between cursor-pointer py-1" @click="showBody = !showBody">
        <label class="text-sm font-medium text-nc-content-gray-emphasis cursor-pointer">Request Body</label>
        <GeneralIcon :icon="showBody ? 'ncChevronDown' : 'ncChevronRight'" class="text-nc-content-gray-muted w-4 h-4" />
      </div>
      <div v-if="showBody" class="flex flex-col gap-3">
        <div class="flex flex-col gap-1">
          <label class="text-xs text-nc-content-gray-muted">Body Type</label>
          <NcSelect
            :value="config.bodyType"
            :disabled="!isWorkflowEditAllowed"
            class="nc-http-body-type-select w-full"
            @update:value="(val) => updateConfig({ bodyType: val })"
          >
            <a-select-option v-for="type in bodyTypes" :key="type.value" :value="type.value">
              {{ type.label }}
            </a-select-option>
          </NcSelect>
        </div>
        <div v-if="config.bodyType !== 'none'" class="flex flex-col gap-1">
          <label class="text-xs text-nc-content-gray-muted">Content</label>
          <NcFormBuilderInputWorkflowInput
            :model-value="config.body"
            :variables="flatVariables"
            :read-only="!isWorkflowEditAllowed"
            :grouped-variables="groupedVariables"
            :plugins="['multiline']"
            :placeholder="config.bodyType === 'json' ? '{\'key\' : \'value\'}' : 'Request body content'"
            @update:model-value="(val) => updateConfig({ body: val })"
          />
        </div>
      </div>
    </div>

    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between cursor-pointer py-1" @click="showAdvanced = !showAdvanced">
        <label class="text-sm font-medium text-nc-content-gray-emphasis cursor-pointer">Advanced Options</label>
        <GeneralIcon :icon="showAdvanced ? 'ncChevronDown' : 'ncChevronRight'" class="text-nc-content-gray-muted w-4 h-4" />
      </div>
      <div v-if="showAdvanced" class="flex flex-col gap-3">
        <div class="flex flex-col gap-1">
          <label class="text-xs text-nc-content-gray-muted">Timeout (ms)</label>
          <a-input-number
            :value="config.timeout"
            :disabled="!isWorkflowEditAllowed"
            :min="1000"
            :controls="false"
            :max="300000"
            class="w-full !rounded-lg"
            @update:value="(val) => updateConfig({ timeout: val })"
          />
        </div>
        <div class="flex items-center justify-between">
          <div class="flex flex-col">
            <label class="text-sm text-nc-content-gray-emphasis">Follow Redirects</label>
            <span class="text-xs text-nc-content-gray-muted">Automatically follow HTTP redirects</span>
          </div>
          <NcSwitch
            :checked="config.followRedirects"
            :disabled="!isWorkflowEditAllowed"
            size="small"
            @update:checked="(val) => updateConfig({ followRedirects: val })"
          />
        </div>
        <div class="flex items-center justify-between">
          <div class="flex flex-col">
            <label class="text-sm text-nc-content-gray-emphasis">Fail on Error Status</label>
            <span class="text-xs text-nc-content-gray-muted">Fail when response is 4xx or 5xx</span>
          </div>
          <NcSwitch
            :checked="config.validateStatus"
            :disabled="!isWorkflowEditAllowed"
            size="small"
            @update:checked="(val) => updateConfig({ validateStatus: val })"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.http-request-config {
  :deep(.nc-http-method-select) {
    .ant-select-selector {
      @apply !h-8;
    }
    .ant-select-selection-item {
      @apply !leading-8;
    }
  }
}

:deep(.nc-workflow-input) {
  .nc-workflow-input-editor {
    &:not(.multiline) {
      .ProseMirror {
        @apply !h-8 !min-h-8 !py-1;
      }

      .nc-workflow-input-insert-btn {
        @apply !-top-1;
      }
    }
  }
}
</style>
