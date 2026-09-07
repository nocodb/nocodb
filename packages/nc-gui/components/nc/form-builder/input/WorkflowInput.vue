<script setup lang="ts">
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import StarterKit from '@tiptap/starter-kit'
import { BubbleMenu, EditorContent, VueRenderer, useEditor } from '@tiptap/vue-3'
import type { VariableDefinition } from 'nocodb-sdk'
import dayjs from 'dayjs'
import tippy from 'tippy.js'
import type { WorkflowInputTool } from './WorkflowInputTools.vue'
import { WorkflowComposeInj, WorkflowComposeModeInj } from '~/context'
import { WorkflowExpression, WorkflowVariablePicker } from '~/helpers/tiptap-markdown/extensions'
import { Markdown } from '~/helpers/tiptap-markdown'
import { FontFamily } from '~/helpers/tiptap-markdown/extensions/marks/fontFamily'
import { FontSize } from '~/helpers/tiptap-markdown/extensions/marks/fontSize'
import { Highlight } from '~/helpers/tiptap-markdown/extensions/marks/highlight'
import { TextAlign } from '~/helpers/tiptap-markdown/extensions/textAlign'
import { TextColor } from '~/helpers/tiptap-markdown/extensions/marks/textColor'
import { EmailTextStyle } from '~/helpers/tiptap-markdown/extensions/marks/textStyle'

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
  plugins?: Array<'multiline' | 'richText'>
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: undefined,
  variables: () => [],
  groupedVariables: () => [],
  readOnly: false,
})

const emit = defineEmits(['update:modelValue'])

const { t } = useI18n()

const vModel = computed({
  get: () => {
    const value = props.modelValue

    if (ncIsString(value)) return value

    if (ncIsNumber(value)) return value.toString()

    // date conditions can hold a Date/dayjs instance; ISO is what if.ts's `new Date(value)` reads back.
    // toISOString() throws RangeError on an invalid date, so validity is checked first
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString()

    if (dayjs.isDayjs(value)) return value.isValid() ? value.toISOString() : ''

    // anyof/allof conditions store multi-values as an array; if.ts reads the comma-joined form identically
    if (ncIsArray(value)) return value.every(isPrimitiveValue) ? value.filter(isValidValue).join(',') : ''

    return ''
  },
  set: (v) => {
    emit('update:modelValue', v)
  },
})

const { readOnly } = toRefs(props)

// Custom suggestion render to pass groupedItems
// The panel (if any) owns the compose modal; inside it the body renders its full toolbar.
const compose = inject(WorkflowComposeInj, null)

const expanded = inject(WorkflowComposeModeInj, ref(false))

// In the sidebar the picker flies out over the canvas; inside the expand modal the caret is
// mid-screen, so it drops below the caret instead.
const suggestionPlacement = () =>
  expanded.value
    ? { placement: 'bottom-start' as const, offset: [0, 8] as [number, number] }
    : { placement: 'left-end' as const, offset: [40, 100] as [number, number] }

const createSuggestionRender = () => ({
  render: () => {
    let component: VueRenderer
    let popup: any

    return {
      onStart: (suggestionProps: Record<string, any>) => {
        component = new VueRenderer(WorkflowVariablePicker, {
          props: {
            ...suggestionProps,
            groupedItems: props.groupedVariables,
          },
          editor: suggestionProps.editor,
        })

        if (!suggestionProps.clientRect) return

        popup = tippy('body', {
          getReferenceClientRect: suggestionProps.clientRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          ...suggestionPlacement(),
        })
      },

      onUpdate(suggestionProps: Record<string, any>) {
        component.updateProps({
          ...suggestionProps,
          groupedItems: props.groupedVariables,
        })

        if (!suggestionProps.clientRect) return

        popup?.[0]?.setProps({
          getReferenceClientRect: suggestionProps.clientRect,
          ...suggestionPlacement(),
        })
      },

      onKeyDown(suggestionProps: Record<string, any>) {
        if (suggestionProps.event.key === 'Escape') {
          popup?.[0]?.hide()
          return true
        }
        return component.ref?.onKeyDown(suggestionProps)
      },

      onExit() {
        // onStart skips the popup when there is no clientRect (editor detached / teleporting),
        // so neither handle is guaranteed here.
        popup?.[0]?.destroy()
        component?.destroy()
      },
    }
  },
})

// richText enables inline formatting (bold/italic/lists/links) and stores HTML;
// it implies multiline editing. Plain `multiline` keeps the legacy markdown/text storage.
const isRichText = computed(() => props.plugins?.includes('richText') || false)

const isMultiline = computed(() => props.plugins?.includes('multiline') || isRichText.value)

// Minimal HTML detection — the rich-text editor always wraps content in these tags,
// while legacy plain-text values contain none.
function looksLikeHtml(value: string): boolean {
  return /<(?:p|br|strong|b|em|i|u|s|strike|a|span|ul|ol|li|blockquote|code|pre|h[1-6])\b[^>]*>/i.test(value)
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Resolve the {{ expression }} token to the id + display label used by the expression chip.
function deriveExpressionMeta(expression: string): { id: string; label: string } {
  const variable = props.variables.filter((v) => expression.includes(v.key)).sort((a, b) => b.key.length - a.key.length)[0]

  if (!variable) return { id: expression, label: expression }

  const remainingPath = expression.slice(variable.key.length)

  if (!remainingPath) return { id: variable.key, label: variable.name }

  const properties: string[] = []
  const pathRegex = /\.(\w+)|\[['"]([^'"]+)['"]\]/g
  let pathMatch

  // eslint-disable-next-line no-cond-assign
  while ((pathMatch = pathRegex.exec(remainingPath)) !== null) {
    properties.push(pathMatch[1] || pathMatch[2])
  }

  return {
    id: variable.key,
    label: properties.length > 0 ? properties[properties.length - 1] : variable.name,
  }
}

// Parse without executing: a stored body is untrusted, and a detached div still fires
// <img onerror> on innerHTML assignment. DOMParser documents are inert.
function parseInert(html: string): HTMLElement {
  return new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body
}

// Turn expression chips produced by editor.getHTML() back into {{ }}} tokens for storage / runtime interpolation.
function expressionSpansToTokens(html: string): string {
  const container = parseInert(html)
  container.querySelectorAll('span[data-type="workflowExpression"]').forEach((el) => {
    el.replaceWith(document.createTextNode(el.getAttribute('data-expression') || ''))
  })
  return container.innerHTML
}

// Turn stored {{ }} tokens into expression chip spans (only within text nodes, never inside attributes).
function tokensToExpressionSpans(html: string): string {
  const container = parseInert(html)

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text)

  const regex = /\{\{([^}]+)}}/g

  for (const node of textNodes) {
    const text = node.nodeValue || ''
    if (!text.includes('{{')) continue

    const fragment = document.createDocumentFragment()
    let lastIndex = 0
    let match

    regex.lastIndex = 0
    // eslint-disable-next-line no-cond-assign
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)))
      }

      const { id, label } = deriveExpressionMeta(match[1].trim())
      const span = document.createElement('span')
      span.setAttribute('data-type', 'workflowExpression')
      span.setAttribute('data-id', id)
      span.setAttribute('data-label', label)
      span.setAttribute('data-expression', match[0])
      fragment.appendChild(span)

      lastIndex = match.index + match[0].length
    }

    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex)))
    }

    node.replaceWith(fragment)
  }

  return container.innerHTML
}

// Two renderings of one form (sidebar + compose modal) mean this instance may be
// updated from the outside; track what we emitted/loaded so only real changes reload.
let lastEmitted: string | undefined

let lastLoaded: string | undefined

const editor = useEditor({
  content: '',
  extensions: [
    StarterKit.configure({
      // h4-h6 are omitted: email clients render them smaller than body text
      heading: isRichText.value ? { levels: [1, 2, 3] } : false,
      hardBreak: isMultiline.value ? { keepMarks: true } : false,
      blockquote: isRichText.value ? undefined : false,
      bulletList: isRichText.value ? undefined : false,
      orderedList: isRichText.value ? undefined : false,
      listItem: isRichText.value ? undefined : false,
      codeBlock: false,
      horizontalRule: false,
      bold: isRichText.value ? undefined : false,
      italic: isRichText.value ? undefined : false,
      strike: isRichText.value ? undefined : false,
    }),
    ...(isRichText.value
      ? [
          Underline,
          TextColor,
          Highlight,
          EmailTextStyle,
          FontFamily,
          FontSize,
          TextAlign,
          Link.configure({
            openOnClick: false,
            autolink: false,
            HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
          }),
        ]
      : []),
    Placeholder.configure({
      emptyEditorClass: 'is-editor-empty',
      placeholder: props.placeholder ?? t('placeholder.variableValue'),
    }),
    WorkflowExpression.configure({
      suggestion: {
        ...createSuggestionRender(),
        items: ({ query }: { query: string }) => {
          if (!query) return props.variables

          const lowercaseQuery = query.toLowerCase()
          return props.variables.filter(
            (v) =>
              v.name.toLowerCase().includes(lowercaseQuery) ||
              v.key.toLowerCase().includes(lowercaseQuery) ||
              v.extra?.description?.toLowerCase().includes(lowercaseQuery),
          )
        },
        char: '{{',
        allowSpaces: true,
      },
      variables: props.variables,
    }),
    Markdown.configure({ breaks: true, transformPastedText: false }),
  ],
  onUpdate: ({ editor }) => {
    if (isRichText.value) {
      // Record what we emit, not the prop: the parent hasn't applied the update yet,
      // so reading vModel here would return the previous value.
      const next = editor.isEmpty ? '' : expressionSpansToTokens(editor.getHTML())
      lastEmitted = next
      vModel.value = next
      recomputeWordCount()
      return
    }

    let markdown = editor.storage.markdown.getMarkdown()

    markdown = markdown.replaceAll('<br/>', '\n')
    markdown = markdown.replaceAll('<br>', '\n')

    // Unescape markdown special characters that shouldn't be escaped in workflow input
    markdown = markdown.replaceAll('\\_', '_')
    markdown = markdown.replaceAll('\\*', '*')
    markdown = markdown.replaceAll('\\[', '[')
    markdown = markdown.replaceAll('\\]', ']')

    lastEmitted = markdown.trim()
    vModel.value = lastEmitted
  },
  editable: !readOnly.value,
  autofocus: false,
  editorProps: {
    attributes: {
      class: 'nc-workflow-input-editor',
    },
    handleKeyDown(_view, event) {
      if (event.key === 'Enter' && !isMultiline.value) {
        event.preventDefault()
        return true
      }
      return false
    },
  },
})

function loadContent() {
  if (!editor.value) return

  lastLoaded = vModel.value

  if (!vModel.value) {
    editor.value.commands.clearContent()
    if (isRichText.value) recomputeWordCount()
    return
  }

  if (isRichText.value) {
    // Legacy plain-text bodies (saved before rich text) get wrapped so line breaks survive.
    const source = looksLikeHtml(vModel.value) ? vModel.value : `<p>${escapeHtml(vModel.value).replace(/\n/g, '<br>')}</p>`

    editor.value.commands.setContent(tokensToExpressionSpans(source))
    recomputeWordCount()
    return
  }

  const expressionRegex = /\{\{([^}]+)}}/g
  let htmlContent = ''
  let lastIndex = 0
  let match

  // eslint-disable-next-line no-cond-assign
  while ((match = expressionRegex.exec(vModel.value)) !== null) {
    const [fullMatch, expression] = match

    if (match.index > lastIndex) {
      const textContent = vModel.value.slice(lastIndex, match.index)
      htmlContent += textContent.replace(/\n/g, '<br>')
    }

    if (!expression) {
      console.error('No expression found in match', match)
      continue
    }

    const trimmedExpression = expression.trim()

    // Find the longest matching variable key
    const variable = props.variables
      .filter((v) => trimmedExpression.includes(v.key))
      .sort((a, b) => b.key.length - a.key.length)[0]

    let displayLabel = trimmedExpression

    if (variable) {
      // Extract the property path after the variable key
      const remainingPath = trimmedExpression.slice(variable.key.length)

      if (remainingPath) {
        // Parse the entire path to get all properties
        const properties = []
        const currentPath = remainingPath

        // Match alternating dot notation and bracket notation
        // Supports: .prop, ['prop'], ["prop"], .prop['nested'], etc.
        const pathRegex = /\.(\w+)|\[['"]([^'"]+)['"]\]/g
        let pathMatch

        // eslint-disable-next-line no-cond-assign
        while ((pathMatch = pathRegex.exec(currentPath)) !== null) {
          // pathMatch[1] is dot notation capture, pathMatch[2] is bracket notation capture
          properties.push(pathMatch[1] || pathMatch[2])
        }

        if (properties.length > 0) {
          // Use the last property in the chain as the display label
          displayLabel = properties[properties.length - 1]
        } else {
          displayLabel = variable.name
        }
      } else {
        displayLabel = variable.name
      }
    }

    htmlContent += `<span data-type="workflowExpression" data-id="${
      variable?.key || trimmedExpression
    }" data-label="${displayLabel}" data-expression="${fullMatch}"></span>`

    lastIndex = match.index + fullMatch.length
  }

  if (lastIndex < vModel.value.length) {
    const textContent = vModel.value.slice(lastIndex)
    htmlContent += textContent.replace(/\n/g, '<br>')
  }

  editor.value.commands.setContent(htmlContent || vModel.value)
}

onMounted(loadContent)

watch(
  () => props.modelValue,
  () => {
    const incoming = vModel.value
    if (incoming === lastEmitted || incoming === lastLoaded) return
    if (editor.value?.isFocused) return
    loadContent()
  },
)

const insertExpression = () => {
  if (!editor.value) return

  const { $from } = editor.value.state.selection
  const lastChar = editor.value.state.doc.textBetween($from.pos - 1, $from.pos)

  if (editor.value.state.doc.textBetween($from.pos - 2, $from.pos) === '{{') {
    return
  }

  if (lastChar === '{') {
    editor.value.chain().insertContent('{').run()
  } else if (lastChar !== ' ' && $from.pos !== 1) {
    editor.value.chain().insertContent(' {{').run()
  } else {
    editor.value.chain().insertContent('{{').run()
  }
}

// ── Email body shell: expand modal, word count, quick variables ──

const wordCount = ref(0)

function recomputeWordCount() {
  const text = editor.value?.getText()?.trim() ?? ''
  wordCount.value = text ? text.split(/\s+/).length : 0
}

// ── Rich-text formatting toolbar ──

const showLinkMenu = ref(false)

const linkMenuRef = ref<HTMLElement>()

const linkUrlRef = ref<HTMLInputElement>()

// Fixed-position so the menu can open beside whichever trigger was clicked — toolbar,
// bubble, or sidebar strip — instead of a slot under the toolbar.
const linkMenuPos = ref({ top: 0, left: 0 })

const LINK_MENU_SIZE = { width: 260, height: 118 }

const linkUrl = ref('')

const linkText = ref('')

function toggleBold() {
  editor.value?.chain().focus().toggleBold().run()
}

function toggleItalic() {
  editor.value?.chain().focus().toggleItalic().run()
}

function toggleUnderline() {
  editor.value?.chain().focus().toggleUnderline().run()
}

function toggleStrike() {
  editor.value?.chain().focus().toggleStrike().run()
}

// Whole toolbar uses the lucide family (same as the comment box) so every glyph
// shares one stroke weight and optical size.
const headingLevels = [
  { level: 1 as const, icon: 'lucideHeading1' as const, label: 'labels.heading1' },
  { level: 2 as const, icon: 'lucideHeading2' as const, label: 'labels.heading2' },
  { level: 3 as const, icon: 'lucideHeading3' as const, label: 'labels.heading3' },
]

function toggleHeading(level: 1 | 2 | 3) {
  editor.value?.chain().focus().toggleHeading({ level }).run()
}

function toggleBlockquote() {
  editor.value?.chain().focus().toggleBlockquote().run()
}

function toggleCode() {
  editor.value?.chain().focus().toggleCode().run()
}

// One tool list drives both the modal toolbar and the selection bubble.
const formatGroups = computed<WorkflowInputTool[][]>(() => {
  const groups: WorkflowInputTool[][] = [
    [
      {
        key: 'bold',
        icon: 'lucideBold',
        label: 'labels.bold',
        isActive: () => !!editor.value?.isActive('bold'),
        action: toggleBold,
      },
      {
        key: 'italic',
        icon: 'lucideItalic',
        label: 'labels.italic',
        isActive: () => !!editor.value?.isActive('italic'),
        action: toggleItalic,
      },
      {
        key: 'underline',
        icon: 'lucideUnderline',
        label: 'labels.underline',
        isActive: () => !!editor.value?.isActive('underline'),
        action: toggleUnderline,
      },
      {
        key: 'strike',
        icon: 'lucideStrikethrough',
        label: 'labels.strike',
        isActive: () => !!editor.value?.isActive('strike'),
        action: toggleStrike,
      },
      { key: 'color', type: 'color' },
      { key: 'typography', type: 'typography' },
    ],
    headingLevels.map((h) => ({
      key: `h${h.level}`,
      icon: h.icon,
      label: h.label,
      isActive: () => !!editor.value?.isActive('heading', { level: h.level }),
      action: () => toggleHeading(h.level),
    })),
    [
      {
        key: 'bulletList',
        icon: 'lucideList',
        label: 'labels.bulletList',
        isActive: () => !!editor.value?.isActive('bulletList'),
        action: toggleBulletList,
      },
      {
        key: 'orderedList',
        icon: 'lucideListOrdered',
        label: 'labels.numberedList',
        isActive: () => !!editor.value?.isActive('orderedList'),
        action: toggleOrderedList,
      },
      {
        key: 'blockquote',
        icon: 'lucideQuote',
        label: 'labels.blockQuote',
        isActive: () => !!editor.value?.isActive('blockquote'),
        action: toggleBlockquote,
      },
      {
        key: 'code',
        icon: 'lucideCode',
        label: 'general.code',
        isActive: () => !!editor.value?.isActive('code'),
        action: toggleCode,
      },
      { key: 'align', type: 'align' },
    ],
    [
      {
        key: 'link',
        icon: 'lucideLink',
        label: 'general.link',
        isActive: () => !!editor.value?.isActive('link'),
        action: openLinkMenu,
      },
      { key: 'clear', icon: 'lucideRemoveFormatting', label: 'labels.clearFormatting', action: clearFormatting },
    ],
  ]

  return groups
})

// Undo/redo earn a slot only on the persistent toolbar; the bubble is for the selection.
const toolbarGroups = computed<WorkflowInputTool[][]>(() => [
  [
    { key: 'undo', icon: 'lucideUndo2', label: 'general.undo', action: () => editor.value?.chain().focus().undo().run() },
    { key: 'redo', icon: 'lucideRedo2', label: 'general.redo', action: () => editor.value?.chain().focus().redo().run() },
  ],
  ...formatGroups.value,
])

const shouldShowBubble = ({ editor: e }: { editor: { state: { selection: { empty: boolean } }; isEditable: boolean } }) =>
  !readOnly.value && e.isEditable && !e.state.selection.empty

const bubbleTippyOptions = { duration: 100, maxWidth: 600, placement: 'top' as const, appendTo: () => document.body }

function clearFormatting() {
  editor.value?.chain().focus().unsetAllMarks().clearNodes().run()
}

function toggleBulletList() {
  editor.value?.chain().focus().toggleBulletList().run()
}

function toggleOrderedList() {
  editor.value?.chain().focus().toggleOrderedList().run()
}

function openLinkMenu(event?: MouseEvent) {
  if (!editor.value) return

  // Toggle off an existing link on the current selection.
  if (editor.value.isActive('link')) {
    editor.value.chain().focus().extendMarkRange('link').unsetLink().run()
    return
  }

  const { from, to } = editor.value.state.selection
  linkText.value = editor.value.state.doc.textBetween(from, to, ' ')
  linkUrl.value = ''

  // Anchor under the clicked button; fall back to the caret for keyboard-driven opens.
  const trigger = (event?.currentTarget as HTMLElement | null)?.getBoundingClientRect()
  const caret = editor.value.view.coordsAtPos(from)
  const anchor = trigger ?? { left: caret.left, bottom: caret.bottom, top: caret.top }

  const gap = 6
  const left = Math.max(8, Math.min(anchor.left, window.innerWidth - LINK_MENU_SIZE.width - 8))
  const fitsBelow = anchor.bottom + gap + LINK_MENU_SIZE.height <= window.innerHeight
  const top = fitsBelow ? anchor.bottom + gap : Math.max(8, anchor.top - gap - LINK_MENU_SIZE.height)

  linkMenuPos.value = { top, left }
  showLinkMenu.value = true
  nextTick(() => linkUrlRef.value?.focus())
}

// Scheme-less URLs are the norm when typing; the sanitizer only lets http(s)/mailto through.
function normalizeHref(raw: string): string {
  const value = raw.trim()
  if (!value) return ''
  if (/^(?:https?|mailto):/i.test(value)) return value
  if (/^[^\s/@]+@[^\s/@]+\.[^\s/@]+$/.test(value)) return `mailto:${value}`
  return `https://${value.replace(/^\/+/, '')}`
}

function applyLink() {
  const href = normalizeHref(linkUrl.value)
  if (!href || !editor.value) {
    showLinkMenu.value = false
    return
  }

  const { from, to } = editor.value.state.selection
  const selectedText = editor.value.state.doc.textBetween(from, to, ' ')
  const label = linkText.value.trim() || selectedText || href

  editor.value
    .chain()
    .focus()
    .insertContentAt({ from, to }, { type: 'text', text: label, marks: [{ type: 'link', attrs: { href } }] })
    .run()

  showLinkMenu.value = false
  linkUrl.value = ''
  linkText.value = ''
}

function cancelLink() {
  showLinkMenu.value = false
  linkUrl.value = ''
  linkText.value = ''
}

onClickOutside(linkMenuRef, () => {
  if (showLinkMenu.value) cancelLink()
})

watch(readOnly, (newValue) => {
  editor.value?.setEditable(!newValue)
})
</script>

<template>
  <div
    :class="{
      'multiline': isMultiline,
      'rich-text': isRichText,
    }"
    class="nc-workflow-input relative"
  >
    <!-- ── Rich-text (email body) shell: toolbar + editor + footer in one bordered box ── -->
    <template v-if="isRichText">
      <div class="nc-email-shell" :class="{ 'is-expanded': expanded }" data-testid="nc-workflow-richtext-shell">
        <!-- Sidebar: status strip. Formatting lives in the selection bubble. -->
        <div v-if="!expanded" class="nc-email-head">
          <div class="nc-email-wordcount">
            <span class="nc-email-wordcount-num">{{ wordCount }}</span>
            {{ $t('general.words') }}
          </div>
          <div class="flex-1" />
          <template v-if="!readOnly">
            <NcTooltip :title="$t('general.insert')">
              <button
                class="nc-email-var-btn"
                data-testid="nc-workflow-richtext-variable-btn"
                @mousedown.prevent
                @click.stop="insertExpression"
              >
                <GeneralIcon icon="lucideBraces" class="w-4 h-4 flex-none" />
              </button>
            </NcTooltip>
            <NcTooltip v-if="compose" :title="$t('general.expand')">
              <NcButton
                size="xs"
                type="text"
                class="nc-workflow-format-btn"
                data-testid="nc-workflow-richtext-expand-btn"
                @click.stop="compose.open()"
              >
                <GeneralIcon icon="ncMaximize" class="w-4 h-4" />
              </NcButton>
            </NcTooltip>
          </template>
        </div>

        <!-- Modal: full toolbar -->
        <div v-else-if="!readOnly" class="nc-email-toolbar" data-testid="nc-workflow-richtext-toolbar">
          <NcFormBuilderInputWorkflowInputTools v-if="editor" :editor="editor" :groups="toolbarGroups" />

          <div class="flex-1" />

          <NcTooltip :title="$t('general.insert')">
            <button
              class="nc-email-var-btn"
              data-testid="nc-workflow-richtext-variable-btn"
              @mousedown.prevent
              @click.stop="insertExpression"
            >
              <GeneralIcon icon="lucideBraces" class="w-4 h-4 flex-none" />
              <span>{{ $t('general.variable') }}</span>
            </button>
          </NcTooltip>
        </div>

        <!-- Stays inside the shell (and so inside the modal's content subtree); fixed-positioned
               elements escape the shell's overflow:hidden on their own. -->
        <div
          v-if="showLinkMenu"
          ref="linkMenuRef"
          class="nc-workflow-link-menu"
          :style="{ top: `${linkMenuPos.top}px`, left: `${linkMenuPos.left}px` }"
          @click.stop
        >
          <input
            v-model="linkText"
            class="nc-workflow-link-input"
            :placeholder="$t('general.text')"
            data-testid="nc-workflow-richtext-link-text"
          />
          <input
            ref="linkUrlRef"
            v-model="linkUrl"
            class="nc-workflow-link-input"
            :placeholder="$t('placeholder.enterUrl')"
            data-testid="nc-workflow-richtext-link-url"
            @keydown.enter.stop.prevent="applyLink"
          />
          <div class="flex justify-end gap-2 mt-1">
            <NcButton size="xs" type="secondary" @click.stop="cancelLink">{{ $t('general.cancel') }}</NcButton>
            <NcButton size="xs" type="primary" data-testid="nc-workflow-richtext-link-apply" @click.stop="applyLink">
              {{ $t('general.apply') }}
            </NcButton>
          </div>
        </div>

        <EditorContent :editor="editor" class="nc-workflow-input-editor nc-email-editor multiline" />

        <BubbleMenu
          v-if="editor"
          :editor="editor"
          :should-show="shouldShowBubble"
          :update-delay="300"
          :tippy-options="bubbleTippyOptions"
        >
          <div class="nc-email-bubble" data-testid="nc-workflow-richtext-bubble" @mousedown.prevent>
            <NcFormBuilderInputWorkflowInputTools :editor="editor" :groups="formatGroups" />
          </div>
        </BubbleMenu>
      </div>
    </template>

    <!-- ── Plain / multiline (unchanged) ── -->
    <template v-else>
      <EditorContent
        :editor="editor"
        class="nc-workflow-input-editor"
        :class="{
          multiline: isMultiline,
        }"
      />

      <NcTooltip
        v-if="!readOnly"
        class="!absolute nc-workflow-insert-btn-tooltip right-1.5"
        :class="{
          'top-1': isMultiline,
          'top-1.5': !isMultiline,
        }"
        hide-on-click
        title="Insert variable"
      >
        <NcButton size="xs" type="text" class="nc-workflow-input-insert-btn !px-1.5" @click.stop="insertExpression">
          <GeneralIcon icon="ncPlusSquareSolid" class="text-nc-content-brand flex-none w-4 h-4" />
        </NcButton>
      </NcTooltip>
    </template>
  </div>
</template>

<style lang="scss">
.nc-workflow-input {
  @apply relative w-full;

  .nc-workflow-input-editor:not(.nc-email-editor) {
    &.multiline {
      .ProseMirror {
        @apply h-auto min-h-16;

        p {
          text-wrap: pretty !important;
        }
      }
    }

    &:not(.multiline) {
      .ProseMirror {
        @apply min-h-8 h-10;
      }
    }
  }

  .nc-workflow-expression {
    @apply bg-nc-bg-brand text-nc-content-brand rounded px-1.5 py-0.25 mx-0.5 text-small cursor-pointer;
    @apply inline-flex items-center gap-1;
    @apply hover:bg-nc-brand-100 transition-colors;
    user-select: none;
  }

  .ProseMirror {
    @apply w-full px-3 py-2 outline-none border-1 border-nc-border-gray-medium rounded-lg;
    @apply focus:border-nc-border-brand transition-colors;

    &:focus-within {
      @apply !shadow-selected;
    }

    &:not(.multiline) {
      @apply overflow-hidden;
      white-space: nowrap;
    }

    &.multiline {
      @apply overflow-auto;
      white-space: pre-wrap;
      word-wrap: break-word;
    }

    &:focus {
      @apply ring-0 outline-none;
    }

    p {
      @apply m-0 inline;
    }
  }

  .tiptap p.is-editor-empty:first-child::before {
    @apply text-nc-content-gray-disabled;
    content: attr(data-placeholder);
    float: left;
    height: 0;
    pointer-events: none;
  }

  .nc-workflow-input-insert-btn {
    @apply opacity-0 transition-opacity;
  }

  &:hover .nc-workflow-input-insert-btn,
  &:focus-within .nc-workflow-input-insert-btn {
    @apply opacity-100;
  }
}

// ── Rich-text mode ──

.nc-email-shell {
  @apply relative flex flex-col rounded-lg bg-nc-bg-default border-1 border-nc-border-gray-medium overflow-hidden;
  transition: border-color 0.15s, box-shadow 0.15s;

  &:focus-within {
    @apply border-nc-border-brand !shadow-selected;
  }

  // Compose modal rows are the chrome; the shell itself goes borderless and fills.
  &.is-expanded {
    @apply flex-1 min-h-0 border-0 rounded-none;

    &:focus-within {
      @apply !shadow-none;
    }
  }
}

.nc-email-head {
  @apply flex items-center gap-0.5 pl-3.5 pr-1.5 h-9 flex-none border-b-1 border-nc-border-gray-light;
}

.nc-email-toolbar {
  @apply relative flex flex-nowrap items-center gap-0.5 px-1.5 py-1 flex-none overflow-x-auto;
  @apply bg-nc-bg-gray-extralight border-b-1 border-nc-border-gray-light;
}

.nc-email-bubble {
  @apply flex items-center gap-0.5 p-1 rounded-lg bg-nc-bg-default border-1 border-nc-border-gray-medium;
  box-shadow: 0 8px 24px rgba(16, 16, 21, 0.12);
}

.nc-email-head,
.nc-email-toolbar,
.nc-email-bubble {
  .nc-workflow-format-btn.is-active {
    @apply bg-nc-bg-gray-light text-nc-content-brand;
  }

  .nc-email-format-divider {
    @apply flex-none w-px h-4.5 mx-0.5 bg-nc-border-gray-medium;
  }

  // Square icon buttons; the font-name button opts out with its own width.
  .nc-workflow-format-btn:not(.nc-email-typo-btn) {
    @apply !w-7 !min-w-7 !px-0;
  }
}

.nc-email-var-btn {
  @apply flex-none inline-flex items-center gap-1 h-7 pl-1.5 pr-2 rounded-md cursor-pointer;
  @apply border-1 border-nc-border-gray-medium bg-nc-bg-default text-nc-content-brand text-small font-semibold;
  transition: background 0.15s, border-color 0.15s;

  &:hover {
    @apply bg-nc-bg-brand border-nc-border-brand;
  }
}

.nc-email-wordcount {
  @apply text-small text-nc-content-gray-muted whitespace-nowrap;

  .nc-email-wordcount-num {
    font-family: 'DM Mono', monospace;
  }
}

.nc-email-shell {
  .ProseMirror {
    // The shell owns the border and focus ring; the legacy .nc-workflow-input rules
    // put both on the editor itself, so they are overridden rather than out-specified.
    @apply h-auto min-h-35 w-full px-3.5 py-3 outline-none !border-0 !rounded-none !shadow-none;

    // global.css sets font-family on `*`, which resets every nested mark span (colour,
    // highlight, link) to Inter and hides the author's font. Marks must inherit instead;
    // inline styles and the code/chip rules below still win.
    * {
      font-family: inherit;
    }
    // Legacy .ProseMirror:not(.multiline) forces nowrap + overflow-hidden; the shell wraps and
    // scrolls at the .nc-email-editor level instead.
    white-space: pre-wrap !important;
    overflow: visible !important;
    overflow-wrap: break-word;

    p {
      @apply block m-0;
    }

    p + p {
      @apply mt-2;
    }

    ul {
      @apply list-disc pl-5 my-1;
    }

    ol {
      @apply list-decimal pl-5 my-1;
    }

    li {
      @apply my-0.5;

      p {
        @apply inline;
      }
    }

    a {
      @apply text-nc-content-brand underline cursor-pointer;
    }

    strong {
      font-weight: 600;
    }

    em {
      font-style: italic;
    }

    // Heading sizes mirror how mail clients render h1-h3 relative to body text
    h1 {
      @apply text-xl font-bold my-2;
    }

    h2 {
      @apply text-lg font-bold my-2;
    }

    h3 {
      @apply text-base font-bold my-1.5;
    }

    blockquote {
      @apply border-l-2 border-nc-border-gray-medium pl-3 my-2 text-nc-content-gray-subtle;
    }

    code {
      @apply px-1 py-0.5 rounded bg-nc-bg-gray-light font-mono text-small;
    }

    s {
      text-decoration: line-through;
    }

    u {
      text-decoration: underline;
    }
  }
}

// The shell teleports into the expand modal, so everything it owns is styled at top
// level rather than nested under .nc-workflow-input.
.nc-email-shell {
  .nc-workflow-expression {
    @apply bg-nc-bg-brand text-nc-content-brand rounded-md px-1.5 cursor-pointer whitespace-nowrap;
    @apply inline-flex items-center hover:bg-nc-brand-100 transition-colors;
    font-family: 'DM Mono', monospace;
    font-size: 12.5px;
    user-select: none;
  }

  .nc-email-editor {
    @apply flex-1 min-h-0 overflow-auto;
  }

  // Long emails scroll inside the panel instead of pushing the chips and Test step off-screen.
  &:not(.is-expanded) .nc-email-editor {
    max-height: 360px;
  }

  .tiptap p.is-editor-empty:first-child::before {
    @apply text-nc-content-gray-muted;
    content: attr(data-placeholder);
    float: left;
    height: 0;
    pointer-events: none;
  }
}

.nc-workflow-link-menu {
  @apply fixed flex flex-col gap-1 p-2 rounded-lg bg-nc-bg-default border-1 border-nc-border-gray-medium;
  width: 260px;
  z-index: 10001; // above the modal mask and the tippy bubble
  box-shadow: 0 8px 24px rgba(16, 16, 21, 0.12);

  .nc-workflow-link-input {
    @apply w-full px-2 py-1 text-small rounded-md border-1 border-nc-border-gray-medium outline-none;
    @apply focus:border-nc-border-brand;
  }
}

// Inside the compose modal: persistent toolbar, full-width editor that fills the remaining height.
.nc-email-shell.is-expanded {
  .nc-email-toolbar {
    @apply px-1 py-1 rounded-lg border-b-0 mt-1;
  }

  .nc-email-editor {
    @apply flex-1 min-h-0 px-1 py-3 flex flex-col;

    .ProseMirror {
      @apply p-0 flex-1;
      line-height: 1.6;
    }
  }
}
</style>
