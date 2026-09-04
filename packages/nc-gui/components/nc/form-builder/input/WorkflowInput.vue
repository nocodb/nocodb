<script setup lang="ts">
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import StarterKit from '@tiptap/starter-kit'
import { EditorContent, VueRenderer, useEditor } from '@tiptap/vue-3'
import type { VariableDefinition } from 'nocodb-sdk'
import dayjs from 'dayjs'
import tippy from 'tippy.js'
import { WorkflowExpression, WorkflowVariablePicker } from '~/helpers/tiptap-markdown/extensions'
import { Markdown } from '~/helpers/tiptap-markdown'

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
          offset: [40, 100],
          trigger: 'manual',
          placement: 'left-end',
        })
      },

      onUpdate(suggestionProps: Record<string, any>) {
        component.updateProps({
          ...suggestionProps,
          groupedItems: props.groupedVariables,
        })

        if (!suggestionProps.clientRect) return

        popup[0].setProps({
          getReferenceClientRect: suggestionProps.clientRect,
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
        popup[0].destroy()
        component.destroy()
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

// Turn expression chips produced by editor.getHTML() back into {{ }}} tokens for storage / runtime interpolation.
function expressionSpansToTokens(html: string): string {
  const container = document.createElement('div')
  container.innerHTML = html
  container.querySelectorAll('span[data-type="workflowExpression"]').forEach((el) => {
    el.replaceWith(document.createTextNode(el.getAttribute('data-expression') || ''))
  })
  return container.innerHTML
}

// Turn stored {{ }} tokens into expression chip spans (only within text nodes, never inside attributes).
function tokensToExpressionSpans(html: string): string {
  const container = document.createElement('div')
  container.innerHTML = html

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

const editor = useEditor({
  content: '',
  extensions: [
    StarterKit.configure({
      heading: false,
      hardBreak: isMultiline.value ? { keepMarks: true } : false,
      blockquote: false,
      bulletList: isRichText.value ? undefined : false,
      orderedList: isRichText.value ? undefined : false,
      listItem: isRichText.value ? undefined : false,
      codeBlock: false,
      horizontalRule: false,
      bold: isRichText.value ? undefined : false,
      italic: isRichText.value ? undefined : false,
      strike: false,
    }),
    ...(isRichText.value
      ? [
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
      vModel.value = editor.isEmpty ? '' : expressionSpansToTokens(editor.getHTML())
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

    vModel.value = markdown.trim()
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

onMounted(() => {
  if (!editor.value || !vModel.value) return

  if (isRichText.value) {
    // Legacy plain-text bodies (saved before rich text) get wrapped so line breaks survive.
    const source = looksLikeHtml(vModel.value) ? vModel.value : `<p>${escapeHtml(vModel.value).replace(/\n/g, '<br>')}</p>`

    editor.value.commands.setContent(tokensToExpressionSpans(source))
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
})

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

// ── Rich-text formatting toolbar ──

const showLinkMenu = ref(false)

const linkMenuRef = ref<HTMLElement>()

const linkUrl = ref('')

const linkText = ref('')

function toggleBold() {
  editor.value?.chain().focus().toggleBold().run()
}

function toggleItalic() {
  editor.value?.chain().focus().toggleItalic().run()
}

function toggleBulletList() {
  editor.value?.chain().focus().toggleBulletList().run()
}

function toggleOrderedList() {
  editor.value?.chain().focus().toggleOrderedList().run()
}

function openLinkMenu() {
  if (!editor.value) return

  // Toggle off an existing link on the current selection.
  if (editor.value.isActive('link')) {
    editor.value.chain().focus().extendMarkRange('link').unsetLink().run()
    return
  }

  const { from, to } = editor.value.state.selection
  linkText.value = editor.value.state.doc.textBetween(from, to, ' ')
  linkUrl.value = ''
  showLinkMenu.value = true
}

function applyLink() {
  const href = linkUrl.value.trim()
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
    <div v-if="isRichText && !readOnly" class="nc-workflow-input-toolbar" data-testid="nc-workflow-richtext-toolbar">
      <NcTooltip :title="$t('labels.bold')">
        <NcButton
          size="xs"
          type="text"
          class="nc-workflow-format-btn"
          :class="{ 'is-active': editor?.isActive('bold') }"
          @click.stop="toggleBold"
        >
          <GeneralIcon icon="bold" class="w-4 h-4" />
        </NcButton>
      </NcTooltip>
      <NcTooltip :title="$t('labels.italic')">
        <NcButton
          size="xs"
          type="text"
          class="nc-workflow-format-btn"
          :class="{ 'is-active': editor?.isActive('italic') }"
          @click.stop="toggleItalic"
        >
          <GeneralIcon icon="italic" class="w-4 h-4" />
        </NcButton>
      </NcTooltip>
      <NcTooltip :title="$t('labels.bulletList')">
        <NcButton
          size="xs"
          type="text"
          class="nc-workflow-format-btn"
          :class="{ 'is-active': editor?.isActive('bulletList') }"
          @click.stop="toggleBulletList"
        >
          <GeneralIcon icon="ncList" class="w-4 h-4" />
        </NcButton>
      </NcTooltip>
      <NcTooltip :title="$t('labels.numberedList')">
        <NcButton
          size="xs"
          type="text"
          class="nc-workflow-format-btn"
          :class="{ 'is-active': editor?.isActive('orderedList') }"
          @click.stop="toggleOrderedList"
        >
          <GeneralIcon icon="ncNumberList" class="w-4 h-4" />
        </NcButton>
      </NcTooltip>
      <NcTooltip :title="$t('general.link')">
        <NcButton
          size="xs"
          type="text"
          class="nc-workflow-format-btn"
          :class="{ 'is-active': editor?.isActive('link') }"
          data-testid="nc-workflow-richtext-link-btn"
          @click.stop="openLinkMenu"
        >
          <GeneralIcon icon="link2" class="w-4 h-4" />
        </NcButton>
      </NcTooltip>

      <div v-if="showLinkMenu" ref="linkMenuRef" class="nc-workflow-link-menu" @click.stop>
        <input
          v-model="linkText"
          class="nc-workflow-link-input"
          :placeholder="$t('general.text')"
          data-testid="nc-workflow-richtext-link-text"
        />
        <input
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
    </div>

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
        'top-1': isMultiline && !isRichText,
        'top-1.5': !isMultiline,
        'nc-workflow-insert-btn-richtext': isRichText,
      }"
      hide-on-click
      title="Insert variable"
    >
      <NcButton size="xs" type="text" class="nc-workflow-input-insert-btn !px-1.5" @click.stop="insertExpression">
        <GeneralIcon icon="ncPlusSquareSolid" class="text-nc-content-brand flex-none w-4 h-4" />
      </NcButton>
    </NcTooltip>
  </div>
</template>

<style lang="scss">
.nc-workflow-input {
  @apply relative w-full;

  .nc-workflow-input-editor {
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

  // ── Rich-text mode ──

  .nc-workflow-input-toolbar {
    @apply relative flex items-center gap-0.5 mb-1;

    .nc-workflow-format-btn.is-active {
      @apply bg-nc-bg-gray-light text-nc-content-brand;
    }
  }

  .nc-workflow-link-menu {
    @apply absolute z-50 top-8 left-0 flex flex-col gap-1 p-2 rounded-lg bg-nc-bg-default border-1 border-nc-border-gray-medium;
    width: 260px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);

    .nc-workflow-link-input {
      @apply w-full px-2 py-1 text-small rounded-md border-1 border-nc-border-gray-medium outline-none;
      @apply focus:border-nc-border-brand;
    }
  }

  &.rich-text {
    .nc-workflow-insert-btn-richtext {
      @apply bottom-1 top-auto;
    }

    .ProseMirror {
      @apply h-auto min-h-24;
      white-space: normal;

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
    }
  }
}
</style>
