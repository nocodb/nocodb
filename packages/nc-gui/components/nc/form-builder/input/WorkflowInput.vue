<script setup lang="ts">
import Placeholder from '@tiptap/extension-placeholder'
import StarterKit from '@tiptap/starter-kit'
import { EditorContent, VueRenderer, useEditor } from '@tiptap/vue-3'
import type { VariableDefinition } from 'nocodb-sdk'
import tippy from 'tippy.js'
import { WorkflowExpression, WorkflowVariablePicker } from '~/helpers/tiptap-markdown/extensions'

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

// Serialize TipTap document to plain text with expressions
const serializeDoc = (doc: any): string => {
  let text = ''
  doc.descendants((node: any) => {
    if (node.type.name === 'workflowExpression') {
      text += node.attrs.expression || `{{ ${node.attrs.id} }}`
    } else if (node.text) {
      text += node.text
    }
  })
  return text.trim()
}

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

const editor = useEditor({
  content: '',
  extensions: [
    StarterKit.configure({
      heading: false,
      hardBreak: false,
      blockquote: false,
      bulletList: false,
      orderedList: false,
      listItem: false,
      codeBlock: false,
      horizontalRule: false,
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
  ],
  onUpdate: ({ editor }) => {
    vModel.value = serializeDoc(editor.state.doc)
  },
  editable: !readOnly.value,
  autofocus: false,
  editorProps: {
    attributes: {
      class: 'nc-workflow-input-editor',
    },
    handleKeyDown(_view, event) {
      if (event.key === 'Enter') {
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
      htmlContent += vModel.value.slice(lastIndex, match.index)
    }

    if (!expression) {
      continue
    }

    const variable = props.variables.find((v) => expression.trim().includes(v.key))

    htmlContent += `<span data-type="workflowExpression" data-id="${variable?.key || expression.trim()}" data-label="${
      variable?.name || expression.trim()
    }" data-expression="${fullMatch}"></span>`

    lastIndex = match.index + fullMatch.length
  }

  if (lastIndex < vModel.value.length) {
    htmlContent += vModel.value.slice(lastIndex)
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
  <div class="nc-workflow-input relative">
    <EditorContent :editor="editor" class="nc-workflow-input-editor" />

    <NcTooltip v-if="!readOnly" class="absolute top-1 right-1" hide-on-click title="Insert variable">
      <NcButton size="xs" type="text" class="nc-workflow-input-insert-btn !px-1.5" @click.stop="insertExpression">
        <GeneralIcon icon="ncPlusSquareSolid" class="text-nc-content-brand flex-none w-4 h-4" />
      </NcButton>
    </NcTooltip>
  </div>
</template>

<style lang="scss">
.nc-workflow-input {
  @apply relative w-full;

  .nc-workflow-expression {
    @apply bg-nc-bg-brand text-nc-content-brand rounded px-1.5 py-0.5 mx-0.5 font-medium cursor-pointer;
    @apply inline-flex items-center gap-1;
    @apply hover:bg-nc-brand-100 transition-colors;
    user-select: none;
  }

  .ProseMirror {
    @apply w-full px-3 py-2 outline-none border-1 border-nc-border-gray-medium rounded-lg;
    @apply focus:border-nc-border-brand transition-colors;
    @apply min-h-[38px] overflow-hidden;
    white-space: nowrap;

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
