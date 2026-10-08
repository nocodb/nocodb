<script setup lang="ts">
import type { WorkflowExpressionTransform, WorkflowTransformCategory, WorkflowTransformStep, WorkflowValueKind } from 'nocodb-sdk'
import { getWorkflowExpressionTransform, getWorkflowKindAfter, getWorkflowTransformsFor, getWorkflowValueKind } from 'nocodb-sdk'

interface Props {
  /** What the chip points at, e.g. "Name". */
  label: string
  steps: WorkflowTransformStep[]
  /** Kind of the value before any step; each step's result decides what is offered next. */
  kind: WorkflowValueKind
  /** Result of the expression on the earlier steps' test data, when it can be worked out. */
  preview?: { value?: unknown; error?: string } | null
  /** Offer switching the chip to its raw expression. */
  canEditExpression?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:steps': [steps: WorkflowTransformStep[]]
  'editExpression': []
}>()

const { t } = useI18n()

const CATEGORY_ORDER: WorkflowTransformCategory[] = ['text', 'number', 'list', 'date', 'any']

const search = ref('')

const activeIndex = ref(0)

const searchRef = ref<HTMLInputElement>()

// The test value is the truth (an item of a list could be anything); types are the fallback.
const currentKind = computed(() => {
  const value = props.preview?.value
  if (value !== undefined && value !== null) return getWorkflowValueKind(value)
  return getWorkflowKindAfter(props.kind, props.steps)
})

const transformLabel = (id: string) => t(`labels.workflow.transforms.${id}`)

const kindLabel = (kind: WorkflowValueKind) => t(`labels.workflow.transforms.kinds.${kind}`)

// Only what can take the value as it is after the last step, then narrowed by the search.
const groups = computed(() => {
  const query = search.value.trim().toLowerCase()
  const offered = getWorkflowTransformsFor(currentKind.value).filter(
    (transform) => !query || transformLabel(transform.id).toLowerCase().includes(query),
  )
  return CATEGORY_ORDER.map((category) => ({
    category,
    transforms: offered.filter((transform) => transform.category === category),
  })).filter((group) => group.transforms.length)
})

const flatOffered = computed(() => groups.value.flatMap((group) => group.transforms))

function resultHint(transform: WorkflowExpressionTransform) {
  const returns = transform.returns === 'input' ? currentKind.value : transform.returns
  return returns === currentKind.value || returns === 'any' ? '' : kindLabel(returns)
}

const previewText = computed(() => {
  const value = props.preview?.value
  if (value === undefined) return ''
  if (ncIsString(value)) return `"${value}"`
  // Lists and records can be large; their shape is what tells you the next transform to add.
  if (ncIsArray(value)) return t('labels.workflow.transforms.listOf', { n: value.length }, value.length)
  if (ncIsObject(value))
    return t('labels.workflow.transforms.objectOf', { n: Object.keys(value).length }, Object.keys(value).length)
  return String(value)
})

function addStep(id: string) {
  const transform = getWorkflowExpressionTransform(id)
  const args = Object.fromEntries((transform?.args ?? []).map((arg) => [arg.key, arg.default]))
  emit('update:steps', [...props.steps, transform?.args?.length ? { id, args } : { id }])
  search.value = ''
}

function removeStep(index: number) {
  // Later steps were picked for what this one returned, so they go with it.
  emit('update:steps', props.steps.slice(0, index))
}

function updateArg(index: number, key: string, value: string | number) {
  emit(
    'update:steps',
    props.steps.map((step, i) => (i === index ? { ...step, args: { ...step.args, [key]: value } } : step)),
  )
}

function onSearchKeydown(event: KeyboardEvent) {
  const count = flatOffered.value.length
  if (!count) return
  if (event.key === 'ArrowDown') activeIndex.value = (activeIndex.value + 1) % count
  else if (event.key === 'ArrowUp') activeIndex.value = (activeIndex.value - 1 + count) % count
  else if (event.key === 'Enter') {
    const transform = flatOffered.value[activeIndex.value]
    if (transform) addStep(transform.id)
  } else return
  event.preventDefault()
}

// The list changes on search and after each added step (the value's kind can change),
// so the highlight starts over whenever it does.
watch(
  () => flatOffered.value.map((transform) => transform.id).join(),
  () => (activeIndex.value = 0),
)

onMounted(() => searchRef.value?.focus())
</script>

<template>
  <div class="nc-workflow-transform-menu flex flex-col w-[320px] max-h-[440px] rounded-xl bg-nc-bg-default overflow-hidden">
    <!-- The value and what has been done to it so far. -->
    <div class="px-3 pt-3 pb-2 flex flex-col gap-2">
      <div class="flex items-center gap-1.5 min-w-0 flex-wrap" data-testid="nc-workflow-transform-chain">
        <span class="nc-workflow-transform-pill nc-workflow-transform-pill-value">{{ label }}</span>
        <template v-for="(step, index) in steps" :key="`${step.id}-${index}`">
          <GeneralIcon icon="ncChevronRight" class="!w-3 !h-3 flex-none text-nc-content-gray-muted" />
          <span class="nc-workflow-transform-pill">{{ transformLabel(step.id) }}</span>
        </template>
        <span class="ml-auto text-captionSm text-nc-content-gray-muted flex-none" data-testid="nc-workflow-transform-kind">
          {{ kindLabel(currentKind) }}
        </span>
      </div>

      <div
        class="flex items-center gap-1.5 h-8 px-2 rounded-lg border-1 border-nc-border-gray-medium focus-within:border-nc-border-brand"
      >
        <GeneralIcon icon="search" class="!w-3.5 !h-3.5 flex-none text-nc-content-gray-muted" />
        <input
          ref="searchRef"
          v-model="search"
          class="flex-1 min-w-0 bg-transparent outline-none text-caption text-nc-content-gray placeholder:text-nc-content-gray-muted"
          :placeholder="t('labels.workflow.transforms.search')"
          data-testid="nc-workflow-transform-search"
          @keydown="onSearchKeydown"
        />
      </div>
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto nc-scrollbar-thin">
      <!-- Applied, in the order they run; only steps with settings need a row. -->
      <div v-if="steps.length" class="px-2 pb-2 flex flex-col gap-1" data-testid="nc-workflow-transform-steps">
        <div
          v-for="(step, index) in steps"
          :key="`${step.id}-${index}`"
          class="flex items-center gap-2 pl-2.5 pr-1 min-h-8 rounded-lg bg-nc-bg-gray-extralight"
        >
          <span class="text-captionSm text-nc-content-gray flex-none">{{ transformLabel(step.id) }}</span>
          <div class="flex-1 min-w-0 flex items-center gap-1">
            <template v-for="arg in getWorkflowExpressionTransform(step.id)?.args ?? []" :key="arg.key">
              <NcSelect
                v-if="arg.type === 'select'"
                :value="step.args?.[arg.key] ?? arg.default"
                size="small"
                class="nc-select-shadow !w-24"
                :options="
                  (arg.options ?? []).map((option) => ({ value: option, label: t(`labels.workflow.transforms.units.${option}`) }))
                "
                @change="(value: string) => updateArg(index, arg.key, value)"
              />
              <a-input
                v-else
                :value="step.args?.[arg.key] ?? arg.default"
                :type="arg.type === 'number' ? 'number' : 'text'"
                size="small"
                class="nc-input-sm !rounded-md min-w-0"
                :class="arg.type === 'number' ? '!w-16' : 'flex-1'"
                :placeholder="t(`labels.workflow.transforms.args.${arg.key}`)"
                @input="(event: Event) => updateArg(index, arg.key, arg.type === 'number' ? Number((event.target as HTMLInputElement).value) : (event.target as HTMLInputElement).value)"
              />
            </template>
          </div>
          <NcTooltip :title="t('labels.workflow.transforms.removeFrom')">
            <NcButton type="text" size="xxsmall" class="flex-none" @click="removeStep(index)">
              <GeneralIcon icon="close" class="!w-3.5 !h-3.5" />
            </NcButton>
          </NcTooltip>
        </div>
      </div>

      <div v-for="group in groups" :key="group.category" class="pb-1">
        <div class="px-3 pt-1.5 pb-1 text-captionSm text-nc-content-gray-muted">
          {{ t(`labels.workflow.transforms.categories.${group.category}`) }}
        </div>
        <button
          v-for="transform in group.transforms"
          :key="transform.id"
          type="button"
          class="w-full flex items-center gap-2 px-3 h-8 text-left text-caption text-nc-content-gray transition-colors"
          :class="flatOffered[activeIndex]?.id === transform.id ? 'bg-nc-bg-gray-light' : 'hover:bg-nc-bg-gray-light'"
          :data-testid="`nc-workflow-transform-${transform.id}`"
          @click="addStep(transform.id)"
          @mouseenter="activeIndex = flatOffered.indexOf(transform)"
        >
          <span class="flex-1 truncate">{{ transformLabel(transform.id) }}</span>
          <span v-if="resultHint(transform)" class="text-captionSm text-nc-content-gray-muted flex-none">
            → {{ resultHint(transform) }}
          </span>
        </button>
      </div>

      <div v-if="!flatOffered.length" class="px-3 py-4 text-captionSm text-nc-content-gray-muted text-center">
        {{ t('labels.workflow.transforms.noneFit') }}
      </div>
    </div>

    <!-- Capped so a long value never pushes the transform list out of the menu. -->
    <div class="flex-none flex items-center gap-2 px-3 py-2 border-t-1 border-nc-border-gray-light min-w-0">
      <div class="flex-1 min-w-0 text-captionSm line-clamp-2 break-all" data-testid="nc-workflow-transform-preview">
        <span class="text-nc-content-gray-muted">=</span>
        <span v-if="preview?.error" class="ml-1 text-nc-content-red-dark">{{ preview.error }}</span>
        <span v-else-if="previewText" class="ml-1 text-nc-content-gray-emphasis font-mono">{{ previewText }}</span>
        <span v-else class="ml-1 text-nc-content-gray-subtle">{{ t('labels.workflow.transforms.noPreview') }}</span>
      </div>
      <NcButton
        v-if="canEditExpression"
        type="text"
        size="xxsmall"
        class="flex-none !text-nc-content-gray-subtle"
        data-testid="nc-workflow-transform-edit-expression"
        @click="emit('editExpression')"
      >
        <div class="flex items-center gap-1 text-captionSm">
          <GeneralIcon icon="lucideBraces" class="!w-3.5 !h-3.5" />
          {{ t('labels.workflow.transforms.editExpression') }}
        </div>
      </NcButton>
    </div>
  </div>
</template>

<style scoped lang="scss">
.nc-workflow-transform-menu {
  box-shadow: 0 0 0 1px rgba(var(--rgb-base), 0.08), 0 8px 24px rgba(var(--rgb-base), 0.12);
}

.nc-workflow-transform-pill {
  @apply h-5 px-1.5 rounded-md flex items-center text-captionSm bg-nc-bg-gray-light text-nc-content-gray whitespace-nowrap;
}

.nc-workflow-transform-pill-value {
  @apply bg-nc-bg-brand text-nc-content-brand;
}
</style>
