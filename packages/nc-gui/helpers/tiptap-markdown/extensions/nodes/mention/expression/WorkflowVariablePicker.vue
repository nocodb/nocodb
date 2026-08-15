<script setup lang="ts">
import type { VariableDefinition } from 'nocodb-sdk'
import { WorkflowNodeCategory } from 'nocodb-sdk'

interface NodeGroup {
  nodeId: string
  nodeTitle: string
  category: WorkflowNodeCategory
  variables: VariableDefinition[]
}

interface Props {
  groupedItems?: NodeGroup[]
  command: (attrs: { id: string; label: string; expression: string }) => void
  query?: string
}

const props = withDefaults(defineProps<Props>(), {
  query: '',
  groupedItems: () => [],
})

// tiptap's suggestion plugin passes props this picker does not read (editor, range, items,
// clientRect...). Keep them off the rendered element.
defineOptions({ inheritAttrs: false })

const GROUP_ORDER = ['fields', 'iteration', 'meta', 'other'] as const

type GroupKey = (typeof GROUP_ORDER)[number]

const groupLabels: Record<GroupKey, string> = {
  fields: 'Insert value from field',
  iteration: 'Iteration variables',
  meta: 'System fields',
  other: 'Other',
}

// An array output describes its element shape in extra.itemSchema rather than in children, so
// the picker drills into the first item: `rows` -> `rows[0].email`.
const ARRAY_ITEM_INDEX = 0

const MAX_SEARCH_DEPTH = 4

const selectedNodeIndex = ref(0)

const selectedVariableIndex = ref(0)

const searchQuery = ref(props.query)

const navigationStack = ref<{ title: string; variables: VariableDefinition[] }[]>([])

const selectedNode = computed(() => props.groupedItems[selectedNodeIndex.value] ?? null)

const currentVariables = computed(() => {
  const level = navigationStack.value[navigationStack.value.length - 1]
  if (level) return level.variables

  return selectedNode.value?.variables ?? []
})

const currentTitle = computed(() => navigationStack.value[navigationStack.value.length - 1]?.title ?? 'Choose data')

const filteredVariables = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return currentVariables.value

  return collectMatches(currentVariables.value, query, 0)
})

const variableGroups = computed(() => {
  const buckets: Record<GroupKey, VariableDefinition[]> = { fields: [], iteration: [], meta: [], other: [] }

  for (const variable of filteredVariables.value) {
    buckets[groupKeyOf(variable)].push(variable)
  }

  // `offset` is the index of a group's first row within the flat keyboard-navigable list.
  let offset = 0

  return GROUP_ORDER.filter((key) => buckets[key].length).map((key) => {
    const group = { key, label: groupLabels[key], variables: buckets[key], offset }
    offset += group.variables.length
    return group
  })
})

const visibleVariables = computed(() => variableGroups.value.flatMap((group) => group.variables))

const hasVariables = computed(() => visibleVariables.value.length > 0)

function groupKeyOf(variable: VariableDefinition): GroupKey {
  const key = String(variable.groupKey ?? '')
  return (GROUP_ORDER as readonly string[]).includes(key) ? (key as GroupKey) : 'other'
}

function joinKey(baseKey: string, relativeKey: string) {
  return relativeKey.startsWith('[') ? `${baseKey}${relativeKey}` : `${baseKey}.${relativeKey}`
}

// Within an itemSchema a child key is relative to its parent, except when it already repeats the
// parent key (parent `tags`, child `tags.length`). Same rule as VariableDisplay's
// populateChildrenValues.
function stripParentKey(childKey: string, parentKey: string) {
  if (!parentKey) return childKey
  if (childKey.startsWith(`${parentKey}.`)) return childKey.slice(parentKey.length + 1)
  if (childKey.startsWith(`${parentKey}[`)) return childKey.slice(parentKey.length)

  return childKey
}

// itemSchema keys are relative to the array item; rewrite the subtree onto insertable keys.
function toAbsoluteKeys(schemaDef: VariableDefinition, parentKey: string): VariableDefinition {
  const key = joinKey(parentKey, schemaDef.key)

  return {
    ...schemaDef,
    key,
    children: schemaDef.children?.map((child) =>
      toAbsoluteKeys({ ...child, key: stripParentKey(child.key, schemaDef.key) }, key),
    ),
  }
}

function isExpandable(variable: VariableDefinition) {
  return !!variable.children?.length || !!variable.extra?.itemSchema?.length
}

function expandVariable(variable: VariableDefinition): VariableDefinition[] {
  const children = variable.children ?? []
  const itemSchema = variable.extra?.itemSchema

  if (!itemSchema?.length) return children

  const itemKey = `${variable.key}[${ARRAY_ITEM_INDEX}]`
  const [firstEntry] = itemSchema

  // A lone entry with an empty key means an array of primitives: the item *is* the value.
  if (itemSchema.length === 1 && firstEntry && firstEntry.key === '') {
    return [{ ...firstEntry, key: itemKey, name: `${variable.name} ${ARRAY_ITEM_INDEX + 1}` }, ...children]
  }

  return [...itemSchema.map((schemaDef) => toAbsoluteKeys(schemaDef, itemKey)), ...children]
}

function matchesQuery(variable: VariableDefinition, query: string) {
  return (
    variable.name.toLowerCase().includes(query) ||
    variable.key.toLowerCase().includes(query) ||
    !!variable.extra?.description?.toLowerCase().includes(query)
  )
}

function collectMatches(variables: VariableDefinition[], query: string, depth: number): VariableDefinition[] {
  const matches: VariableDefinition[] = []

  for (const variable of variables) {
    if (matchesQuery(variable, query)) {
      // Nested hits are listed flat, so show the path that will actually be inserted.
      matches.push(depth === 0 ? variable : { ...variable, extra: { ...variable.extra, description: variable.key } })
    }

    if (depth < MAX_SEARCH_DEPTH) {
      matches.push(...collectMatches(expandVariable(variable), query, depth + 1))
    }
  }

  return matches
}

function getVariableIcon(variable: VariableDefinition) {
  if (variable.extra?.icon) return variable.extra.icon

  if (variable.isArray || variable.type === 'array') return 'cellJson'

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

function getNodeIcon(node: NodeGroup) {
  return node.variables[0]?.extra?.nodeIcon ?? 'ncAutomation'
}

function resetLevel() {
  selectedVariableIndex.value = 0
  navigationStack.value = []
  searchQuery.value = ''
}

function selectNode(index: number) {
  selectedNodeIndex.value = index
  resetLevel()
}

function navigateInto(variable: VariableDefinition) {
  const children = expandVariable(variable)
  if (!children.length) return

  navigationStack.value.push({ title: variable.name, variables: children })
  selectedVariableIndex.value = 0
  searchQuery.value = ''
}

function goBack() {
  if (!navigationStack.value.length) return

  navigationStack.value.pop()
  selectedVariableIndex.value = 0
}

function selectVariable(variable: VariableDefinition) {
  props.command({
    id: variable.key,
    label: variable.name,
    expression: `{{ ${variable.key} }}`,
  })
}

function activateVariable(variable: VariableDefinition) {
  if (isExpandable(variable)) navigateInto(variable)
  else selectVariable(variable)
}

function scrollToSelected() {
  nextTick(() => {
    document.querySelector('.nc-workflow-variable-picker .nc-variable-item.is-selected')?.scrollIntoView({ block: 'nearest' })
  })
}

function onKeyDown({ event }: { event: KeyboardEvent }) {
  switch (event.key) {
    case 'ArrowUp':
      selectedVariableIndex.value = Math.max(0, selectedVariableIndex.value - 1)
      scrollToSelected()
      return true

    case 'ArrowDown':
      selectedVariableIndex.value = Math.min(visibleVariables.value.length - 1, selectedVariableIndex.value + 1)
      scrollToSelected()
      return true

    case 'ArrowLeft':
      if (navigationStack.value.length) goBack()
      else selectedNodeIndex.value = Math.max(0, selectedNodeIndex.value - 1)
      return true

    case 'ArrowRight': {
      const variable = visibleVariables.value[selectedVariableIndex.value]
      if (variable) navigateInto(variable)
      return true
    }

    case 'Enter': {
      event.stopPropagation()
      const variable = visibleVariables.value[selectedVariableIndex.value]
      if (variable) activateVariable(variable)
      return true
    }

    case 'Escape':
      if (!navigationStack.value.length) return false
      goBack()
      return true

    default:
      return false
  }
}

watch(selectedNodeIndex, resetLevel)

watch(searchQuery, () => {
  selectedVariableIndex.value = 0
})

defineExpose({
  onKeyDown,
})
</script>

<template>
  <div
    class="nc-workflow-variable-picker flex bg-nc-bg-default border-1 border-nc-border-gray-medium rounded-lg shadow-lg overflow-hidden"
    style="width: 560px; max-height: 400px"
    @mousedown.stop
  >
    <div class="nc-variable-picker-nodes w-[220px] border-r border-nc-border-gray-medium flex flex-col">
      <div class="px-3 py-2 text-sm font-semibold text-nc-content-gray-emphasis border-b border-nc-border-gray-light">
        Use data from...
      </div>
      <div class="flex-1 overflow-y-auto nc-scrollbar-thin">
        <div
          v-for="(node, index) in groupedItems"
          :key="node.nodeId"
          class="nc-node-item flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors"
          :class="{
            'bg-nc-bg-brand-light border-l-2 border-l-nc-border-brand': index === selectedNodeIndex,
            'hover:bg-nc-bg-gray-light': index !== selectedNodeIndex,
          }"
          @click="selectNode(index)"
        >
          <div
            class="w-8 h-8 rounded-md flex items-center justify-center"
            :class="{
              'bg-nc-bg-brand text-nc-content-brand-disabled': [
                WorkflowNodeCategory.TRIGGER,
                WorkflowNodeCategory.ACTION,
              ].includes(node.category),
              'bg-nc-bg-maroon-dark text-nc-content-maroon-dark': node.category === WorkflowNodeCategory.FLOW,
            }"
          >
            <GeneralIcon :icon="getNodeIcon(node)" class="w-4 h-4" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium text-nc-content-gray-emphasis truncate">{{ node.nodeTitle }}</div>
            <div class="text-xs text-nc-content-gray-muted">{{ node.variables.length }} fields</div>
          </div>
          <GeneralIcon v-if="index === selectedNodeIndex" icon="check" class="w-4 h-4 text-nc-content-brand flex-none" />
        </div>

        <div v-if="groupedItems.length === 0" class="px-4 py-8 text-center text-nc-content-gray-disabled text-sm">
          No data sources available.<br />
          Run previous steps first.
        </div>
      </div>
    </div>

    <div class="nc-variable-picker-variables flex-1 flex flex-col min-w-0">
      <div class="px-3 py-2 border-b border-nc-border-gray-light flex items-center gap-2">
        <NcButton v-if="navigationStack.length > 0" size="xs" type="text" class="!px-1" @click="goBack">
          <GeneralIcon icon="arrowLeft" class="w-4 h-4" />
        </NcButton>
        <span class="text-sm font-semibold text-nc-content-gray-emphasis">{{ currentTitle }}</span>
      </div>

      <div class="px-3 py-2 border-b border-nc-border-gray-light">
        <a-input v-model:value="searchQuery" placeholder="Search..." class="!rounded-md nc-input-shadow" allow-clear @click.stop>
          <template #prefix>
            <GeneralIcon icon="search" class="text-nc-content-gray-disabled w-4 h-4" />
          </template>
        </a-input>
      </div>

      <div class="flex-1 overflow-y-auto nc-scrollbar-thin">
        <template v-if="hasVariables">
          <template v-for="group in variableGroups" :key="group.key">
            <div class="px-3 pt-3 pb-1 text-xs font-semibold text-nc-content-gray-muted uppercase tracking-wide">
              {{ group.label }}
            </div>
            <div
              v-for="(variable, index) in group.variables"
              :key="`${group.offset + index}:${variable.key}`"
              class="nc-variable-item flex items-center gap-2 px-3 py-2 mx-2 rounded-md transition-colors"
              :class="{
                'is-selected bg-nc-bg-gray-light': group.offset + index === selectedVariableIndex,
                'hover:bg-nc-bg-gray-extralight': group.offset + index !== selectedVariableIndex,
              }"
            >
              <div class="flex items-center gap-2 flex-1 min-w-0 cursor-pointer" @click="activateVariable(variable)">
                <div class="w-7 h-7 rounded flex items-center justify-center bg-nc-bg-gray-medium">
                  <GeneralIcon :icon="getVariableIcon(variable)" class="w-4 h-4 text-nc-content-gray-subtle" />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium text-nc-content-gray-emphasis truncate">{{ variable.name }}</div>
                  <div v-if="variable.extra?.description" class="text-xs text-nc-content-gray-disabled truncate">
                    {{ variable.extra.description }}
                  </div>
                </div>
              </div>
              <GeneralIcon
                v-if="isExpandable(variable)"
                icon="ncChevronRight"
                class="w-4 h-4 flex-none text-nc-content-gray-muted"
              />
              <NcButton size="xs" type="secondary" class="flex-none" @click.stop="selectVariable(variable)">
                {{ $t('labels.select') }}
              </NcButton>
            </div>
          </template>
        </template>

        <div v-else class="px-4 py-8 text-center text-nc-content-gray-disabled text-sm">
          {{ searchQuery ? 'No variables found' : 'Select a data source' }}
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-workflow-variable-picker {
  @apply select-none;
}

.nc-node-item {
  &:first-child {
    @apply mt-1;
  }
  &:last-child {
    @apply mb-1;
  }
}

.nc-variable-item {
  &:last-child {
    @apply mb-2;
  }
}
</style>
