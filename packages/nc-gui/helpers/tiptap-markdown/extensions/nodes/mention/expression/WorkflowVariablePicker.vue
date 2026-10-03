<script setup lang="ts">
import type { VariableDefinition, WorkflowNodeCategory } from 'nocodb-sdk'
import { getWorkflowVariableKind } from 'nocodb-sdk'

interface NodeGroup {
  nodeId: string
  nodeTitle: string
  category: WorkflowNodeCategory
  variables: VariableDefinition[]
}

interface Props {
  items: VariableDefinition[]
  groupedItems?: NodeGroup[]
  command: (attrs: { id: string; label: string; expression: string }) => void
  query?: string
}

const props = withDefaults(defineProps<Props>(), {
  query: '',
  groupedItems: () => [],
})

// State
const selectedNodeIndex = ref(0)

const selectedVariableIndex = ref(0)

const searchQuery = ref(props.query || '')

const navigationStack = ref<{ title: string; variables: VariableDefinition[] }[]>([])

// ←/→ stay with the search text's caret.
const SEARCH_NAV_KEYS = ['ArrowUp', 'ArrowDown', 'Enter', 'Escape']

const nodeGroups = computed(() => {
  if (props.groupedItems && props.groupedItems.length > 0) {
    return props.groupedItems
  }

  const groups: Record<string, NodeGroup> = {}

  props.items.forEach((variable: any) => {
    const nodeTitle = variable.extra?.sourceNodeTitle || 'Variables'
    const nodeId = variable.extra?.sourceNodeId || 'default'

    if (!groups[nodeId]) {
      groups[nodeId] = {
        nodeId,
        nodeTitle,
        variables: [],
      }
    }
    groups[nodeId].variables.push(variable)
  })

  return Object.values(groups)
})

const selectedNode = computed(() => {
  if (nodeGroups.value.length === 0) return null
  return nodeGroups.value[selectedNodeIndex.value] || null
})

const currentVariables = computed(() => {
  if (navigationStack.value.length > 0) {
    const node = navigationStack.value[navigationStack.value.length - 1]
    if (node) {
      return node.variables
    }
  }
  return Array.isArray(selectedNode.value?.variables) ? selectedNode.value.variables : []
})

const currentTitle = computed(() => {
  if (navigationStack.value.length > 0) {
    const node = navigationStack.value[navigationStack.value.length - 1]
    if (node) {
      return node.title
    }
  }
  return 'Choose data'
})

const matchesQuery = (v: VariableDefinition, query: string) =>
  v.name.toLowerCase().includes(query) ||
  v.key.toLowerCase().includes(query) ||
  !!v.extra?.description?.toLowerCase().includes(query)

// A search walks the whole subtree: "email" should find Record › Fields › Email without
// drilling in first. Nested matches show their path as the description and inherit the
// top-level group so they land under the same heading they would when browsed.
const searchVariables = (vars: VariableDefinition[], query: string, path: string[] = [], groupKey?: string) => {
  const out: VariableDefinition[] = []
  for (const v of vars) {
    const group = groupKey ?? v.groupKey
    if (matchesQuery(v, query)) {
      out.push(path.length ? { ...v, groupKey: group, extra: { ...v.extra, description: path.join(' › ') } } : v)
    }
    if (v.children?.length) out.push(...searchVariables(v.children, query, [...path, v.name], group))
  }
  return out
}

// The search box sits above both columns, so it searches every step, not just the one open.
const filteredVariables = computed(() => {
  if (!searchQuery.value) {
    return currentVariables.value
  }

  const query = searchQuery.value.toLowerCase()
  return nodeGroups.value.flatMap((group) =>
    searchVariables(group.variables, query).map((v) => ({
      ...v,
      extra: { ...v.extra, description: [group.nodeTitle, v.extra?.description].filter(Boolean).join(' › ') },
    })),
  )
})

// Group variables by groupKey (fields, meta, iteration, etc.)
const groupedVariables = computed(() => {
  const groups: Record<string, VariableDefinition[]> = {
    fields: [],
    meta: [],
    iteration: [],
    other: [],
  }

  filteredVariables.value.forEach((v) => {
    const groupKey = v.groupKey || 'other'
    if (!groups[groupKey]) {
      groups[groupKey] = []
    }
    groups[groupKey].push(v)
  })

  return groups
})

const hasVariables = computed(() => filteredVariables.value.length > 0)

const { t } = useI18n()

const GROUP_ORDER = ['iteration', 'fields', 'meta', 'other']

const variableSections = computed(() =>
  GROUP_ORDER.filter((key) => groupedVariables.value[key]?.length).map((key) => ({
    key,
    label: t(`labels.workflow.picker.groups.${key}`),
    variables: groupedVariables.value[key]!,
  })),
)

// Keyboard moves through rows in the order they are shown.
const orderedVariables = computed(() => variableSections.value.flatMap((section) => section.variables))

const kindLabel = (variable: VariableDefinition) =>
  t(`labels.workflow.transforms.kinds.${getWorkflowVariableKind(variable.type, variable.isArray)}`)

const nodeTileClass = (node: NodeGroup) => getWorkflowNodeIconClass({ id: '', category: node.category })

const scrollToSelected = () => {
  nextTick(() => {
    const selectedEl = document.querySelector('.nc-workflow-variable-picker .nc-variable-item.is-selected')
    selectedEl?.scrollIntoView({ block: 'nearest' })
  })
}

const currentParentVariable = ref<VariableDefinition | null>(null)

const navigateInto = (variable: VariableDefinition) => {
  if (variable.children && variable.children.length > 0) {
    navigationStack.value.push({
      title: variable.name,
      variables: variable.children,
    })
    currentParentVariable.value = variable
    selectedVariableIndex.value = 0
    searchQuery.value = ''
  }
}

const goBack = () => {
  if (navigationStack.value.length > 0) {
    navigationStack.value.pop()
    selectedVariableIndex.value = 0
    if (navigationStack.value.length > 0) {
      const parentLevel = navigationStack.value[navigationStack.value.length - 2]
      if (parentLevel) {
        currentParentVariable.value =
          parentLevel.variables.find((v) => v.name === navigationStack.value[navigationStack.value.length - 1].title) || null
      }
    } else {
      currentParentVariable.value = null
    }
  }
}

const upHandler = () => {
  selectedVariableIndex.value = Math.max(0, selectedVariableIndex.value - 1)
  scrollToSelected()
}

const downHandler = () => {
  selectedVariableIndex.value = Math.min(orderedVariables.value.length - 1, selectedVariableIndex.value + 1)
  scrollToSelected()
}

const leftHandler = () => {
  if (navigationStack.value.length > 0) {
    goBack()
  } else {
    selectedNodeIndex.value = Math.max(0, selectedNodeIndex.value - 1)
  }
}

const selectVariable = (variable: VariableDefinition) => {
  const expression = `{{ ${variable.key} }}`

  props.command({
    id: variable.key,
    label: variable.name,
    expression,
  })
}

const rightHandler = () => {
  const variable = orderedVariables.value[selectedVariableIndex.value]
  if (variable?.children && variable.children.length > 0) {
    navigateInto(variable)
  }
}

const enterHandler = () => {
  const variable = orderedVariables.value[selectedVariableIndex.value]
  if (variable) {
    if (variable.children && variable.children.length > 0) {
      navigateInto(variable)
    } else {
      selectVariable(variable)
    }
  }
}

const onKeyDown = ({ event }: { event: KeyboardEvent }) => {
  if (event.key === 'ArrowUp') {
    upHandler()
    return true
  }

  if (event.key === 'ArrowDown') {
    downHandler()
    return true
  }

  if (event.key === 'ArrowLeft') {
    leftHandler()
    return true
  }

  if (event.key === 'ArrowRight') {
    rightHandler()
    return true
  }

  if (event.key === 'Enter') {
    event.stopPropagation()
    enterHandler()
    return true
  }

  if (event.key === 'Escape' && navigationStack.value.length > 0) {
    goBack()
    return true
  }

  return false
}

const selectNode = (index: number) => {
  selectedNodeIndex.value = index
  selectedVariableIndex.value = 0
  navigationStack.value = []
}

const getVariableIcon = (variable: VariableDefinition) => {
  if (variable.extra?.icon) {
    return variable.extra.icon
  }

  if (variable.isArray || variable.type === 'array') {
    return 'cellJson'
  }

  // Type-based icons (fallback)
  switch (variable.type) {
    case 'string':
      return 'cellText'
    case 'number':
    case 'integer':
      return 'cellNumber'
    case 'boolean':
      return 'cellCheckbox'
    case 'datetime':
      return 'cellDatetime'
    case 'object':
      return 'cellJson'
    default:
      return 'cellSystemText'
  }
}

const getNodeIcon = (node: NodeGroup) => {
  const firstVar = node.variables[0]
  if (firstVar?.extra?.nodeIcon) {
    return firstVar.extra.nodeIcon
  }
  return 'ncAutomation'
}

watch(selectedNodeIndex, () => {
  selectedVariableIndex.value = 0
  navigationStack.value = []
  searchQuery.value = ''
})

watch(searchQuery, () => (selectedVariableIndex.value = 0))

// Text typed after `{{` in the field searches as you go.
watch(
  () => props.query,
  (query) => (searchQuery.value = query ?? ''),
)

defineExpose({
  onKeyDown,
})
</script>

<template>
  <div
    class="nc-workflow-variable-picker flex flex-col w-[540px] h-[360px] bg-nc-bg-default rounded-xl overflow-hidden"
    @mousedown.stop
  >
    <!-- One search over every step. -->
    <div class="flex-none flex items-center gap-2 h-11 px-3 border-b-1 border-nc-border-gray-light">
      <GeneralIcon icon="search" class="!w-4 !h-4 flex-none text-nc-content-gray-muted" />
      <input
        v-model="searchQuery"
        class="flex-1 min-w-0 bg-transparent outline-none text-caption text-nc-content-gray placeholder:text-nc-content-gray-muted"
        :placeholder="t('labels.workflow.picker.search')"
        data-testid="nc-workflow-variable-picker-search"
        @click.stop
        @keydown="(event: KeyboardEvent) => onKeyDown({ event }) && event.preventDefault()"
      />
    </div>

    <div class="flex-1 min-h-0 flex">
      <!-- Steps -->
      <div
        v-if="!searchQuery"
        class="w-[184px] flex-none p-1.5 overflow-y-auto nc-scrollbar-thin border-r-1 border-nc-border-gray-light"
      >
        <div class="px-2 pt-1 pb-1.5 text-captionSm text-nc-content-gray-muted">{{ t('labels.workflow.picker.steps') }}</div>
        <button
          v-for="(node, index) in nodeGroups"
          :key="node.nodeId"
          type="button"
          class="w-full flex items-center gap-2 h-8 px-2 rounded-md text-left transition-colors"
          :class="index === selectedNodeIndex ? 'bg-nc-bg-gray-light' : 'hover:bg-nc-bg-gray-extralight'"
          :data-testid="`nc-workflow-variable-picker-step-${index}`"
          @click="selectNode(index)"
        >
          <span class="w-5 h-5 flex-none rounded flex items-center justify-center" :class="nodeTileClass(node)">
            <GeneralIcon :icon="getNodeIcon(node)" class="!w-3 !h-3 stroke-transparent" />
          </span>
          <NcTooltip
            class="flex-1 min-w-0 truncate text-caption"
            :class="index === selectedNodeIndex ? 'text-nc-content-gray-emphasis' : 'text-nc-content-gray'"
            show-on-truncate-only
            placement="right"
          >
            <template #title>{{ node.nodeTitle }}</template>
            {{ node.nodeTitle }}
          </NcTooltip>
          <span class="flex-none text-captionSm text-nc-content-gray-muted tabular-nums">{{ node.variables.length }}</span>
        </button>

        <div v-if="nodeGroups.length === 0" class="px-2 py-6 text-center text-captionSm text-nc-content-gray-muted">
          {{ t('labels.workflow.picker.noSteps') }}
        </div>
      </div>

      <!-- Values of the open step -->
      <div class="flex-1 min-w-0 flex flex-col">
        <button
          v-if="navigationStack.length && !searchQuery"
          type="button"
          class="flex-none flex items-center gap-1 h-8 mx-1.5 mt-1.5 px-2 rounded-md text-caption text-nc-content-gray-subtle hover:bg-nc-bg-gray-extralight"
          @click="goBack"
        >
          <GeneralIcon icon="ncChevronLeft" class="!w-3.5 !h-3.5" />
          <span class="truncate">{{ currentTitle }}</span>
        </button>

        <div class="flex-1 overflow-y-auto nc-scrollbar-thin p-1.5">
          <template v-if="hasVariables">
            <template v-for="section in variableSections" :key="section.key">
              <div class="px-2 pt-1 pb-1.5 text-captionSm text-nc-content-gray-muted">{{ section.label }}</div>
              <button
                v-for="variable in section.variables"
                :key="variable.key"
                type="button"
                class="nc-variable-item w-full flex items-center gap-2.5 min-h-8 px-2 py-1 rounded-md text-left transition-colors"
                :class="{ 'is-selected bg-nc-bg-gray-light': orderedVariables.indexOf(variable) === selectedVariableIndex }"
                data-testid="nc-workflow-variable-picker-item"
                @mouseenter="selectedVariableIndex = orderedVariables.indexOf(variable)"
                @click="variable.children?.length ? navigateInto(variable) : selectVariable(variable)"
              >
                <GeneralIcon :icon="getVariableIcon(variable)" class="!w-3.5 !h-3.5 flex-none text-nc-content-gray-subtle" />
                <div class="flex-1 min-w-0">
                  <div class="text-caption text-nc-content-gray-emphasis truncate">{{ variable.name }}</div>
                  <!-- Search results say where they came from. -->
                  <div
                    v-if="searchQuery && variable.extra?.description"
                    class="text-captionSm text-nc-content-gray-muted truncate"
                  >
                    {{ variable.extra.description }}
                  </div>
                </div>
                <span class="flex-none text-captionSm text-nc-content-gray-muted">{{ kindLabel(variable) }}</span>
                <!-- Opens to its fields; Enter on a value inserts it. -->
                <GeneralIcon
                  v-if="variable.children?.length"
                  icon="ncChevronRight"
                  class="!w-3.5 !h-3.5 flex-none text-nc-content-gray-muted"
                />
              </button>
            </template>
          </template>

          <div v-else class="h-full flex items-center justify-center text-captionSm text-nc-content-gray-muted">
            {{ searchQuery ? t('labels.workflow.picker.noMatches') : t('labels.workflow.picker.pickStep') }}
          </div>
        </div>
      </div>
    </div>

    <div
      class="flex-none flex items-center gap-3 h-8 px-3 border-t-1 border-nc-border-gray-light text-captionSm text-nc-content-gray-muted"
    >
      <span><kbd>↑</kbd><kbd>↓</kbd> {{ t('labels.workflow.picker.navigate') }}</span>
      <span><kbd>↵</kbd> {{ t('labels.workflow.picker.insert') }}</span>
      <span><kbd>→</kbd> {{ t('labels.workflow.picker.open') }}</span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-workflow-variable-picker {
  @apply select-none;
  box-shadow: 0 0 0 1px rgba(var(--rgb-base), 0.08), 0 12px 32px rgba(var(--rgb-base), 0.12);
}

kbd {
  @apply inline-flex items-center justify-center min-w-4 h-4 px-1 mr-0.5 rounded bg-nc-bg-gray-light text-nc-content-gray-subtle font-sans;
  font-size: 10px;
}
</style>
