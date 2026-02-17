<script setup lang="ts">
import Placeholder from '@tiptap/extension-placeholder'
import StarterKit from '@tiptap/starter-kit'
import { EditorContent, VueRenderer, useEditor } from '@tiptap/vue-3'
import type { VariableDefinition } from 'nocodb-sdk'
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
  plugins?: Array<'multiline'>
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: 'Enter value',
  variables: () => [],
  groupedVariables: () => [],
  readOnly: false,
})

const emit = defineEmits(['update:modelValue'])

const vModel = computed({
  get: () => props.modelValue ?? '',
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

const isMultiline = computed(() => props.plugins?.includes('multiline') || false)

const editor = useEditor({
  content: '',
  extensions: [
    StarterKit.configure({
      heading: false,
      hardBreak: isMultiline.value ? { keepMarks: true } : false,
      blockquote: false,
      bulletList: false,
      orderedList: false,
      listItem: false,
      codeBlock: false,
      horizontalRule: false,
      bold: false,
      italic: false,
      strike: false,
    }),
    Placeholder.configure({
      emptyEditorClass: 'is-editor-empty',
      placeholder: props.placeholder,
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

watch(readOnly, (newValue) => {
  editor.value?.setEditable(!newValue)
})
</script>

<template>
  <div
    :class="{
      multiline: isMultiline,
    }"
    class="nc-workflow-input relative"
  >
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
}
</style>
