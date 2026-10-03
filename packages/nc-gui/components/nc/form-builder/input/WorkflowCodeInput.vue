<script setup lang="ts">
import type { Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete'
import { autocompletion, completionKeymap, completionStatus, snippetCompletion, startCompletion } from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import type { Extension } from '@codemirror/state'
import { Annotation, EditorState, Prec, RangeSetBuilder, StateEffect } from '@codemirror/state'
import type { DecorationSet, ViewUpdate } from '@codemirror/view'
import { Decoration, EditorView, ViewPlugin, WidgetType, placeholder as cmPlaceholder, keymap, tooltips } from '@codemirror/view'
import type { VariableDefinition, WorkflowTransformStep, WorkflowValueKind } from 'nocodb-sdk'
import {
  WORKFLOW_EXPRESSION_BUILTINS,
  applyWorkflowExpressionTransforms,
  getWorkflowExpressionMethods,
  parseWorkflowExpressionTransforms,
} from 'nocodb-sdk'
import WorkflowTransformMenu from './WorkflowTransformMenu.vue'
import { WorkflowVariablePicker } from '~/helpers/tiptap-markdown/extensions'
import { WorkflowVariableInj } from '~/context'

interface NodeGroup {
  nodeId: string
  nodeTitle: string
  variables: VariableDefinition[]
}

interface Props {
  modelValue?: string
  placeholder?: string
  variables?: VariableDefinition[]
  groupedVariables?: NodeGroup[]
  readOnly?: boolean
  multiline?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: undefined,
  variables: () => [],
  groupedVariables: () => [],
  readOnly: false,
  multiline: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'enter': []
}>()

const { t } = useI18n()

const workflowVariables = inject(WorkflowVariableInj, undefined)

const hostRef = ref<HTMLElement>()

const pickerRef = ref<{ onKeyDown: (props: { event: KeyboardEvent }) => boolean }>()

const transformMenuRef = ref<HTMLElement>()

const pickerRootRef = ref<HTMLElement>()

const isFocused = ref(false)

/** The `{{` the picker was opened by, and the text typed after it. */
const picker = ref<{ from: number; query: string; top: number; left: number } | null>(null)

/** The chip whose transform menu is open. */
const transformTarget = ref<{
  from: number
  to: number
  base: string
  steps: WorkflowTransformStep[]
  label: string
  kind: WorkflowValueKind
  top: number
  left: number
} | null>(null)

const POPOVER_GAP = 6

const PICKER_SIZE = { width: 540, height: 360 }

const TRANSFORM_MENU_SIZE = { width: 320, height: 440 }

// Marks our own writes, so they neither echo back as user edits nor close the menu they came from.
const programmatic = Annotation.define<boolean>()

// Chip labels depend on the variables; changing them redraws the chips.
const refreshChips = StateEffect.define<null>()

let view: EditorView | null = null

const allVariables = computed(() => {
  const flat: VariableDefinition[] = []
  const walk = (list: VariableDefinition[]) =>
    list.forEach((variable) => {
      flat.push(variable)
      if (variable.children?.length) walk(variable.children)
    })
  walk(props.variables)
  return flat
})

const preview = (expression: string) => workflowVariables?.previewExpression?.(expression) ?? null

const kindOf = (expression: string) => getWorkflowExpressionKind(expression, props.variables, preview(expression))

const kindLabel = (kind: WorkflowValueKind) => t(`labels.workflow.transforms.kinds.${kind}`)

function popoverPos(anchor: { left: number; top: number; bottom: number }, size: { width: number; height: number }) {
  const left = Math.max(8, Math.min(anchor.left, window.innerWidth - size.width - 8))
  const fitsBelow = anchor.bottom + POPOVER_GAP + size.height <= window.innerHeight
  const top = fitsBelow ? anchor.bottom + POPOVER_GAP : Math.max(8, anchor.top - POPOVER_GAP - size.height)
  return { top, left }
}

// ── Chips ──

class ChipWidget extends WidgetType {
  constructor(readonly label: string, readonly expression: string) {
    super()
  }

  eq(other: ChipWidget) {
    return other.label === this.label && other.expression === this.expression
  }

  toDOM() {
    const chip = document.createElement('span')
    chip.className = 'nc-workflow-expression'
    chip.textContent = this.label
    chip.setAttribute('data-expression', this.expression)
    chip.setAttribute('data-testid', 'nc-workflow-expression-chip')
    return chip
  }

  ignoreEvent() {
    return false
  }
}

/** A token is shown as code while the caret is inside it; everywhere else it is a chip. */
function isEditingToken(state: EditorState, hasFocus: boolean, from: number, to: number) {
  const head = state.selection.main.head
  return hasFocus && head > from && head < to
}

function buildDecorations(state: EditorState, hasFocus: boolean) {
  const builder = new RangeSetBuilder<Decoration>()
  const text = state.doc.toString()
  for (const token of findWorkflowExpressionTokens(text)) {
    if (isEditingToken(state, hasFocus, token.from, token.to)) {
      builder.add(token.from, token.to, Decoration.mark({ class: 'nc-workflow-expression-raw' }))
    } else {
      const { label } = getWorkflowExpressionChipMeta(token.expression, props.variables, t)
      builder.add(token.from, token.to, Decoration.replace({ widget: new ChipWidget(label, token.expression) }))
    }
  }
  // A `{{` not closed yet is an expression being written; it reads as code up to the end.
  const open = text.lastIndexOf('{{')
  if (open !== -1 && !text.includes('}}', open) && open + 2 < text.length) {
    builder.add(open, text.length, Decoration.mark({ class: 'nc-workflow-expression-raw' }))
  }
  return builder.finish()
}

const chipPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(editorView: EditorView) {
      this.decorations = buildDecorations(editorView.state, editorView.hasFocus)
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.selectionSet ||
        update.focusChanged ||
        update.transactions.some((tr) => tr.effects.some((effect) => effect.is(refreshChips)))
      ) {
        this.decorations = buildDecorations(update.state, update.view.hasFocus)
      }
    }
  },
  {
    decorations: (plugin) => plugin.decorations,
    // Chips move and delete as one unit.
    provide: (plugin) =>
      EditorView.atomicRanges.of((editorView) => {
        const decorations = editorView.plugin(plugin)?.decorations ?? Decoration.none
        const atomic = new RangeSetBuilder<Decoration>()
        const iter = decorations.iter()
        while (iter.value) {
          if (iter.value.spec.widget) atomic.add(iter.from, iter.to, iter.value)
          iter.next()
        }
        return atomic.finish()
      }),
  },
)

// ── Autocomplete inside an expression ──

/** Start of the `{{` the caret is in, or null outside one. */
function openTokenStart(state: EditorState, pos: number) {
  const before = state.doc.sliceString(0, pos)
  const open = before.lastIndexOf('{{')
  if (open === -1 || before.lastIndexOf('}}') > open) return null
  return open
}

function stepCompletions(partial: string, from: number): CompletionResult {
  return {
    from,
    filter: false,
    options: props.groupedVariables
      .filter((group) => group.nodeTitle.toLowerCase().includes(partial.toLowerCase()))
      .map((group) => ({
        label: group.nodeTitle,
        apply: `$('${group.nodeTitle}')`,
        type: 'namespace',
        detail: t('labels.workflow.transforms.step'),
      })),
  }
}

function memberCompletions(base: string, partial: string, dotPos: number): CompletionResult {
  const fields: Completion[] = allVariables.value
    .filter((variable) => variable.key.startsWith(base) && variable.key !== base)
    .map((variable) => ({ variable, rest: variable.key.slice(base.length) }))
    // One level down only: `.name` or `['Some name']`.
    .filter(({ rest }) => /^\.[\w$]+$|^\[['"][^'"]+['"]\]$/.test(rest))
    .map(({ variable, rest }) => ({
      label: rest.startsWith('.') ? rest.slice(1) : rest.slice(2, -2),
      apply: rest.startsWith('.') ? rest.slice(1) : undefined,
      type: 'property',
      detail: kindLabel(kindOf(variable.key)),
      info: variable.extra?.description,
      boost: 1,
      // Bracket keys replace the dot too.
      ...(rest.startsWith('[')
        ? {
            apply: (v: EditorView, _c: Completion, _f: number, to: number) =>
              v.dispatch({ changes: { from: dotPos, to, insert: rest } }),
          }
        : {}),
    }))

  const kind = kindOf(base)
  const methods = getWorkflowExpressionMethods(kind).map((member) =>
    snippetCompletion(member.snippet, {
      label: member.name,
      type: 'method',
      detail: `${member.signature} → ${kindLabel(member.returns)}`,
      info: member.description,
    }),
  )

  return { from: dotPos + 1, options: [...fields, ...methods], validFor: /^[\w$]*$/ }
}

function builtinCompletions(from: number): CompletionResult {
  return {
    from,
    options: [
      // `${step}` is a CodeMirror snippet field, not a template string.
      // eslint-disable-next-line no-template-curly-in-string
      snippetCompletion("$('${step}')", {
        label: "$('…')",
        type: 'namespace',
        detail: t('labels.workflow.transforms.stepOutput'),
      }),
      ...WORKFLOW_EXPRESSION_BUILTINS.map((member) =>
        snippetCompletion(member.snippet, {
          label: member.name,
          type: 'function',
          detail: `${member.signature} → ${kindLabel(member.returns)}`,
          info: member.description,
        }),
      ),
    ],
    validFor: /^\$?[\w]*$/,
  }
}

function expressionCompletions(context: CompletionContext): CompletionResult | null {
  const open = openTokenStart(context.state, context.pos)
  if (open === null) return null
  const before = context.state.doc.sliceString(open + 2, context.pos)

  const step = /\$\(\s*['"]([^'"]*)$/.exec(before)
  if (step) return stepCompletions(step[1]!, context.pos - step[0].length)

  // A path ending in `.partial`: the value it reads from, then the member being typed.
  const member = /((?:\$\(\s*['"][^'"]*['"]\s*\)|\$?[\w]+)(?:\.[\w$]+|\[['"][^'"]*['"]\]|\[\d+\]|\([^()]*\))*)\.([\w$]*)$/.exec(
    before,
  )
  if (member) return memberCompletions(member[1]!, member[2]!, context.pos - member[2]!.length - 1)

  const word = context.matchBefore(/\$?\w*/)
  if (word && (word.from !== word.to || context.explicit)) return builtinCompletions(word.from)
  return null
}

// ── Picker on `{{` ──

function openPicker(editorView: EditorView, from: number) {
  const coords = editorView.coordsAtPos(from)
  if (!coords) return
  picker.value = { from, query: '', ...popoverPos(coords, PICKER_SIZE) }
}

function onPickerCommand(attrs: { expression: string }) {
  const current = picker.value
  if (!view || !current) return
  const to = view.state.selection.main.head
  view.dispatch({
    changes: { from: current.from, to, insert: attrs.expression },
    selection: { anchor: current.from + attrs.expression.length },
    annotations: programmatic.of(false),
  })
  picker.value = null
  view.focus()
}

// ── Transform menu on a chip ──

function openTransformMenu(editorView: EditorView, pos: number, chip: HTMLElement) {
  const token = findWorkflowExpressionTokens(editorView.state.doc.toString()).find((tk) => pos >= tk.from && pos <= tk.to)
  if (!token) return
  const { base, steps } = parseWorkflowExpressionTransforms(token.expression)
  transformTarget.value = {
    from: token.from,
    to: token.to,
    base,
    steps,
    label: getWorkflowVariableChipMeta(base, props.variables).label,
    kind: kindOf(base),
    ...popoverPos(chip.getBoundingClientRect(), TRANSFORM_MENU_SIZE),
  }
}

function updateTransformSteps(steps: WorkflowTransformStep[]) {
  const target = transformTarget.value
  if (!view || !target) return
  const insert = `{{ ${applyWorkflowExpressionTransforms(target.base, steps)} }}`
  view.dispatch({ changes: { from: target.from, to: target.to, insert }, annotations: programmatic.of(true) })
  transformTarget.value = { ...target, steps, to: target.from + insert.length }
}

/** Puts the caret just before the closing braces, which shows the token as code. */
function editTransformTargetAsExpression() {
  const target = transformTarget.value
  if (!view || !target) return
  transformTarget.value = null
  view.focus()
  view.dispatch({ selection: { anchor: target.to - 3 } })
  startCompletion(view)
}

function closeTransformMenu() {
  transformTarget.value = null
}

// ── Editor ──

const fieldPreview = computed(() => {
  if (!isFocused.value) return null
  const text = props.modelValue ?? ''
  const tokens = findWorkflowExpressionTokens(text)
  if (!tokens.length || !workflowVariables?.previewExpression) return null

  let result = ''
  let last = 0
  for (const token of tokens) {
    const value = preview(token.expression)
    if (!value) return null
    if (value.error) return { error: value.error }
    result += text.slice(last, token.from)
    // A field that is only one expression keeps that value's own type, as a run does.
    if (tokens.length === 1 && token.from === 0 && token.to === text.length) return { value: value.value }
    result += ncIsObject(value.value) || ncIsArray(value.value) ? JSON.stringify(value.value) : String(value.value ?? '')
    last = token.to
  }
  return { value: result + text.slice(last) }
})

const previewText = computed(() => {
  const value = fieldPreview.value?.value
  if (value === undefined) return ''
  if (ncIsArray(value)) return t('labels.workflow.transforms.listOf', { n: value.length }, value.length)
  if (ncIsObject(value))
    return t('labels.workflow.transforms.objectOf', { n: Object.keys(value).length }, Object.keys(value).length)
  return String(value)
})

function extensions(): Extension[] {
  return [
    history(),
    chipPlugin,
    EditorView.lineWrapping,
    EditorState.readOnly.of(props.readOnly),
    EditorView.editable.of(!props.readOnly),
    ...(props.placeholder ? [cmPlaceholder(props.placeholder)] : []),
    // Single-line fields take pasted text on one line.
    ...(props.multiline
      ? []
      : [
          EditorState.transactionFilter.of((tr) => {
            let hasBreak = false
            tr.changes.iterChanges((_fromA, _toA, _fromB, _toB, inserted) => {
              if (inserted.lines > 1) hasBreak = true
            })
            if (!hasBreak) return tr
            const changes: { from: number; to: number; insert: string }[] = []
            tr.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
              changes.push({ from: fromA, to: toA, insert: inserted.sliceString(0).replace(/\r?\n/g, ' ') })
            })
            return { changes }
          }),
        ]),
    autocompletion({
      override: [expressionCompletions],
      icons: false,
      activateOnTyping: true,
      // `nc-dropdown`: picking an option keeps the canvas step selected.
      tooltipClass: () => 'nc-workflow-cm-autocomplete nc-dropdown',
      optionClass: (completion) => `nc-workflow-cm-option-${completion.type ?? 'text'}`,
    }),
    // On the page, not in the sidebar, so the list isn't clipped at the panel's edge.
    tooltips({ parent: document.body, position: 'fixed' }),
    Prec.highest(
      keymap.of([
        ...['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Tab', 'Escape'].map((key) => ({
          key,
          run: () => {
            if (!picker.value) return false
            const event = new KeyboardEvent('keydown', { key })
            if (key === 'Escape') {
              picker.value = null
              return true
            }
            return pickerRef.value?.onKeyDown({ event }) ?? false
          },
        })),
        {
          key: 'Enter',
          run: (editorView) => {
            if (props.multiline || completionStatus(editorView.state) === 'active') return false
            emit('enter')
            return true
          },
        },
        {
          key: 'Escape',
          run: () => {
            if (!transformTarget.value) return false
            closeTransformMenu()
            return true
          },
        },
      ]),
    ),
    keymap.of([...completionKeymap, ...defaultKeymap, ...historyKeymap]),
    EditorView.domEventHandlers({
      mousedown(event, editorView) {
        const chip = (event.target as HTMLElement | null)?.closest?.('.nc-workflow-expression') as HTMLElement | null
        if (!chip || props.readOnly) return false
        event.preventDefault()
        openTransformMenu(editorView, editorView.posAtDOM(chip), chip)
        return true
      },
    }),
    EditorView.updateListener.of((update) => {
      if (update.focusChanged) isFocused.value = update.view.hasFocus
      if (!update.docChanged) {
        // Moving the caret off the `{{` that opened the picker closes it.
        if (picker.value && update.selectionSet && update.state.selection.main.head < picker.value.from + 2) picker.value = null
        return
      }

      const isOurs = update.transactions.some((tr) => tr.annotation(programmatic) !== undefined)
      if (!update.transactions.some((tr) => tr.annotation(programmatic) === true)) closeTransformMenu()

      const value = update.state.doc.toString()
      if (value !== props.modelValue) emit('update:modelValue', value)
      if (isOurs) return

      const head = update.state.selection.main.head
      if (picker.value) {
        const query = update.state.doc.sliceString(picker.value.from + 2, head)
        // Typing code instead of searching hands over to autocomplete.
        if (head < picker.value.from + 2 || /[}$().'"[]/.test(query)) picker.value = null
        else picker.value = { ...picker.value, query }
      } else if (update.state.doc.sliceString(head - 2, head) === '{{' && openTokenStart(update.state, head - 2) === null) {
        openPicker(update.view, head - 2)
      }
    }),
    EditorView.theme({
      '&': { fontSize: '13px' },
      '&.cm-focused': { outline: 'none' },
      '.cm-content': { padding: '0', caretColor: 'var(--nc-content-gray)', fontFamily: 'inherit' },
      '.cm-line': { padding: '0' },
      '.cm-placeholder': { color: 'var(--nc-content-gray-muted)' },
      '.cm-tooltip-autocomplete': { border: 'none' },
    }),
  ]
}

function createView() {
  if (!hostRef.value) return
  view?.destroy()
  view = new EditorView({
    parent: hostRef.value,
    state: EditorState.create({ doc: props.modelValue ?? '', extensions: extensions() }),
  })
}

function insertVariable() {
  if (!view) return
  view.focus()
  const head = view.state.selection.main.head
  view.dispatch({ changes: { from: head, insert: '{{' }, selection: { anchor: head + 2 }, annotations: programmatic.of(false) })
  openPicker(view, head)
}

defineExpose({
  focus: () => {
    view?.focus()
    view?.dispatch({ selection: { anchor: view.state.doc.length } })
  },
  insertVariable,
})

watch(
  () => props.modelValue,
  (value) => {
    if (!view || (value ?? '') === view.state.doc.toString()) return
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value ?? '' },
      annotations: programmatic.of(false),
    })
  },
)

watch(
  () => props.variables,
  () => view?.dispatch({ effects: refreshChips.of(null) }),
)

watch(
  () => [props.readOnly, props.multiline, props.placeholder],
  () => createView(),
)

onClickOutside(transformMenuRef, closeTransformMenu, { ignore: ['.nc-workflow-expression', '.ant-select-dropdown'] })

onClickOutside(pickerRootRef, () => (picker.value = null), { ignore: [hostRef] })

useEventListener(
  window,
  ['scroll', 'resize'],
  (event: Event) => {
    const target = event.target as Node
    if (transformTarget.value && !transformMenuRef.value?.contains(target)) closeTransformMenu()
    if (picker.value && !(target instanceof Element && target.closest('.nc-workflow-code-picker'))) picker.value = null
  },
  { capture: true, passive: true },
)

onMounted(createView)

onBeforeUnmount(() => view?.destroy())
</script>

<template>
  <div class="nc-workflow-code-input relative" :class="{ 'is-multiline': multiline, 'is-readonly': readOnly }">
    <div class="nc-workflow-code-input-field" :class="{ 'is-focused': isFocused }">
      <div ref="hostRef" class="flex-1 min-w-0" data-testid="nc-workflow-code-input" />

      <NcTooltip v-if="!readOnly" class="flex-none self-start" hide-on-click :title="$t('general.variable')">
        <NcButton
          size="xs"
          type="text"
          class="nc-workflow-input-insert-btn !px-1.5"
          @mousedown.prevent
          @click.stop="insertVariable"
        >
          <GeneralIcon icon="ncPlusSquareSolid" class="text-nc-content-brand flex-none w-4 h-4" />
        </NcButton>
      </NcTooltip>
    </div>

    <!-- What the field resolves to with the latest test data, while it is being edited. -->
    <div
      v-if="fieldPreview && (previewText || fieldPreview.error)"
      class="mt-1 px-1 text-captionSm truncate"
      data-testid="nc-workflow-code-input-preview"
    >
      <span class="text-nc-content-gray-muted">=</span>
      <span v-if="fieldPreview.error" class="ml-1 text-nc-content-red-dark">{{ fieldPreview.error }}</span>
      <span v-else class="ml-1 text-nc-content-gray-subtle font-mono">{{ previewText }}</span>
    </div>

    <!-- `nc-dropdown`: the canvas keeps the step selected for clicks inside these. -->
    <Teleport to="body">
      <div
        v-if="picker"
        ref="pickerRootRef"
        class="nc-workflow-code-picker nc-dropdown fixed z-[10001]"
        :style="{ top: `${picker.top}px`, left: `${picker.left}px` }"
        @mousedown="(event: MouseEvent) => !(event.target as HTMLElement).closest('input') && event.preventDefault()"
      >
        <WorkflowVariablePicker
          ref="pickerRef"
          :key="picker.from"
          :items="variables"
          :grouped-items="groupedVariables"
          :query="picker.query"
          :command="onPickerCommand"
        />
      </div>

      <div
        v-if="transformTarget"
        ref="transformMenuRef"
        class="nc-dropdown fixed z-[10001]"
        :style="{ top: `${transformTarget.top}px`, left: `${transformTarget.left}px` }"
        data-testid="nc-workflow-transform-menu"
        @keydown.esc.stop.prevent="closeTransformMenu"
      >
        <WorkflowTransformMenu
          :label="transformTarget.label"
          :steps="transformTarget.steps"
          :kind="transformTarget.kind"
          :preview="preview(applyWorkflowExpressionTransforms(transformTarget.base, transformTarget.steps))"
          can-edit-expression
          @update:steps="updateTransformSteps"
          @edit-expression="editTransformTargetAsExpression"
        />
      </div>
    </Teleport>
  </div>
</template>

<style scoped lang="scss">
.nc-workflow-code-input-field {
  @apply flex items-center gap-1 w-full min-h-8 pl-3 pr-1 py-1 rounded-lg border-1 border-nc-border-gray-medium bg-nc-bg-default transition-colors;

  &.is-focused {
    @apply border-nc-border-brand shadow-selected;
  }
}

.is-multiline .nc-workflow-code-input-field {
  @apply items-start min-h-20 py-2;
}

.is-readonly .nc-workflow-code-input-field {
  @apply bg-nc-bg-gray-extralight;
}

:deep(.cm-editor) {
  @apply w-full;
}

:deep(.nc-workflow-expression) {
  @apply bg-nc-bg-brand text-nc-content-brand rounded px-1.5 mx-0.5 text-small cursor-pointer whitespace-nowrap;
  @apply inline-flex items-center hover:bg-nc-brand-100 transition-colors;
  line-height: 20px;
}

// An expression being edited reads as code.
:deep(.nc-workflow-expression-raw) {
  @apply bg-nc-bg-gray-light rounded text-nc-content-gray;
  font-family: 'DM Mono', monospace;
  font-size: 12px;
}
</style>

<style lang="scss">
// Autocomplete renders on the page (see `tooltips`), so it is styled by its own class.
.cm-tooltip.nc-workflow-cm-autocomplete {
  @apply rounded-xl bg-nc-bg-default border-0 overflow-hidden;
  z-index: 10002; // above the compose modal and the picker layer
  box-shadow: 0 0 0 1px rgba(var(--rgb-base), 0.08), 0 8px 24px rgba(var(--rgb-base), 0.12);

  // CodeMirror's base theme paints its own background over ours.
  background: var(--nc-bg-default) !important;

  > ul {
    @apply p-1 font-sans;
    max-height: 280px !important;
    min-width: 300px;
    max-width: 420px;

    > li {
      @apply flex items-center gap-3 h-8 px-2 rounded-md text-caption text-nc-content-gray;

      &[aria-selected] {
        @apply bg-nc-bg-gray-light text-nc-content-gray-emphasis;
      }
    }
  }

  .cm-completionLabel {
    @apply flex-1 min-w-0 truncate;
    font-family: 'DM Mono', monospace;
    font-size: 12px;
  }

  // Calls read as calls.
  .nc-workflow-cm-option-method .cm-completionLabel::after,
  .nc-workflow-cm-option-function .cm-completionLabel::after {
    content: '()';
    @apply text-nc-content-gray-muted;
  }

  .cm-completionMatchedText {
    @apply no-underline text-nc-content-brand;
  }

  .cm-completionDetail {
    @apply flex-none ml-auto text-captionSm text-nc-content-gray-muted not-italic truncate max-w-48;
  }

  .cm-tooltip.cm-completionInfo {
    @apply rounded-lg bg-nc-bg-default border-0 text-captionSm text-nc-content-gray-subtle px-3 py-2 max-w-64;
    box-shadow: 0 0 0 1px rgba(var(--rgb-base), 0.08), 0 8px 24px rgba(var(--rgb-base), 0.12);
  }
}
</style>
