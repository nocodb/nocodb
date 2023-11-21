<script lang="ts" setup>
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import TurndownService from 'turndown'
import { marked } from 'marked'
import { generateJSON } from '@tiptap/html'
import Underline from '@tiptap/extension-underline'
import { TaskItem } from '@/helpers/dbTiptapExtensions/task-item'
import { Link } from '@/helpers/dbTiptapExtensions/links'

const props = defineProps<{
  value?: string | null
  readonly?: boolean
  syncValueChange?: boolean
  showMenu?: boolean
  fullMode?: boolean
}>()

const emits = defineEmits(['update:value'])

const turndownService = new TurndownService({})

turndownService.addRule('lineBreak', {
  filter: (node) => {
    return node.nodeName === 'BR'
  },
  replacement: () => {
    return '<br />'
  },
})

turndownService.addRule('taskList', {
  filter: (node) => {
    return node.nodeName === 'LI' && !!node.getAttribute('data-checked')
  },
  replacement: (content, node: any) => {
    // Remove the first \n\n and last \n\n
    const processContent = content.replace(/^\n\n/, '').replace(/\n\n$/, '')

    const isChecked = node.getAttribute('data-checked') === 'true'

    return `[${isChecked ? 'x' : ' '}] ${processContent}\n\n`
  },
})

const checkListItem = {
  name: 'checkListItem',
  level: 'block',
  tokenizer(src: string) {
    src = src.split('\n\n')[0]
    const isMatched = src.startsWith('[ ]') || src.startsWith('[x]') || src.startsWith('[X]')

    if (isMatched) {
      const isNotChecked = src.startsWith('[ ]')
      let text = src.slice(3)
      if (text[0] === ' ') text = text.slice(1)

      const token = {
        // Token to generate
        type: 'checkListItem',
        raw: src,
        text,
        tokens: [],
        checked: !isNotChecked,
      }

      ;(this as any).lexer.inline(token.text, token.tokens) // Queue this data to be processed for inline tokens
      return token
    }

    return false
  },
  renderer(token: any) {
    return `<ul data-type="taskList"><li data-checked="${
      token.checked ? 'true' : 'false'
    }" data-type="taskItem"><label><input type="checkbox" ${
      token.checked ? 'checked="checked"' : ''
    }><span></span></label><div>${(this as any).parser.parseInline(token.tokens)}</div></li></ul>` // parseInline to turn child tokens into HTML
  },
}

marked.use({ extensions: [checkListItem] })

const editorDom = ref<HTMLElement | null>(null)

const vModel = useVModel(props, 'value', emits, { defaultValue: '' })

const tiptapExtensions = [
  StarterKit,
  TaskList,
  TaskItem.configure({
    nested: true,
  }),
  Underline,
  Link,
]

const editor = useEditor({
  extensions: tiptapExtensions,
  onUpdate: ({ editor }) => {
    const markdown = turndownService
      .turndown(editor.getHTML().replaceAll(/<p><\/p>/g, '<br />'))
      .replaceAll(/\n\n<br \/>\n\n/g, '<br>\n\n')

    vModel.value = markdown
  },
  editable: !props.readonly,
})

const setEditorContent = (contentMd: any) => {
  if (!editor.value) return
  ;(editor.value.state as any).history$.prevRanges = null
  ;(editor.value.state as any).history$.done.eventCount = 0

  const selection = editor.value.view.state.selection

  const contentHtml = contentMd ? marked.parse(contentMd) : '<p></p>'

  const content = generateJSON(contentHtml, tiptapExtensions)

  editor.value.chain().setContent(content).setTextSelection(selection.to).run()
}

if (props.syncValueChange) {
  watch(vModel, () => {
    setEditorContent(vModel.value)
  })
}

watch(editorDom, () => {
  if (!editorDom.value) return

  setEditorContent(vModel.value)

  // Focus editor after editor is mounted
  setTimeout(() => {
    editor.value?.chain().focus().run()
  }, 50)
})

const focusEditorEnd = () => {
  setTimeout(() => {
    if (!editor.value) return
    const docSize = editor.value.state.doc.content.size

    editor.value
      ?.chain()
      .setTextSelection(docSize - 2)
      .focus()
      .run()
  }, 50)
}
</script>

<template>
  <div
    class="h-full"
    :class="{
      'flex flex-col flex-grow': props.fullMode,
    }"
  >
    <div v-if="props.showMenu" class="absolute top-0 right-0.5">
      <CellRichTextSelectedBubbleMenu v-if="editor" :editor="editor" embed-mode />
    </div>
    <CellRichTextSelectedBubbleMenuPopup v-if="editor" :editor="editor" />
    <CellRichTextLinkOptions v-if="editor" :editor="editor" />
    <EditorContent
      ref="editorDom"
      :editor="editor"
      class="nc-textarea-rich w-full h-full nc-text-rich-scroll nc-scrollbar-md"
      :class="{
        'ml-1.5 mt-0.5': props.fullMode,
      }"
    />
    <div v-if="props.fullMode" class="flex flex-grow" @click="focusEditorEnd"></div>
  </div>
</template>

<style lang="scss">
.nc-text-rich-scroll {
  &::-webkit-scrollbar-thumb {
    @apply bg-transparent;
  }
}
.nc-text-rich-scroll:hover {
  &::-webkit-scrollbar-thumb {
    @apply bg-gray-200;
  }
}

.nc-textarea-rich {
  .ProseMirror {
    @apply pt-1;

    > * {
      @apply ml-1;
    }
  }
  .ProseMirror-focused {
    // remove all border
    outline: none;
  }

  p {
    @apply !mb-1;
  }

  ul {
    li {
      @apply ml-4;
      list-style-type: disc;
    }
  }

  ol {
    @apply -ml-6 !pl-4;
    li {
      list-style-type: decimal;
    }
  }

  ul,
  ol {
    @apply !my-0;
  }

  ul[data-type='taskList'] {
    @apply;
    li {
      @apply !ml-0 flex flex-row gap-x-2;
      list-style-type: none;

      input {
        @apply mt-0.75 flex rounded-sm;
        z-index: -10;
      }
      // Unchecked
      input:not(:checked) {
        // Add border to checkbox
        border-width: 1.5px;
        @apply border-gray-700;
      }
    }
  }

  // Pre tag is the parent wrapper for Code block
  pre {
    border-color: #d0d5dd;
    border: 1px;
    color: black;
    font-family: 'JetBrainsMono', monospace;
    padding: 1rem;
    border-radius: 0.5rem;
    @apply overflow-auto mt-3 bg-gray-100;

    code {
      @apply !px-0;
    }
  }

  code {
    @apply rounded-md px-2 py-1 bg-gray-100;
    color: inherit;
    font-size: 0.8rem;
  }

  h1 {
    font-weight: 700;
    font-size: 1.85rem;
    margin-bottom: 0.1rem;
  }

  h2 {
    font-weight: 600;
    font-size: 1.55rem;
    margin-bottom: 0.1em;
  }

  h3 {
    font-weight: 600;
    font-size: 1.15rem;
    margin-bottom: 0.1em;
  }

  blockquote {
    border-left: 3px solid #d0d5dd;
    padding: 0 1em;
    color: #666;
    margin: 1em 0;
    font-style: italic;
  }

  hr {
    @apply !border-gray-300;
    border: 0;
    border-top: 1px solid #ccc;
    margin: 1.5em 0;
  }
}
</style>
