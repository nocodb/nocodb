<script setup lang="ts">
import { TypeGenerator } from '~/ee/components/smartsheet/script/utils/TypeGenerator'
import type { ExecuteScriptNodeConfig } from '~/components/smartsheet/workflow/sidebar/config/custom/RunScript/types'

const loadMonacoEditor = () => import('monaco-editor')

// Async setup to make this component suspensible
const setup = async () => {
  // Initialize Monaco Editor to make this component truly async
  await initializeMonaco()
}

// Call the async setup
await setup()

const editorRef = ref<HTMLDivElement | null>(null)

let editor: monaco.editor.IStandaloneCodeEditor

const { activeBaseSchema } = storeToRefs(useScriptStore())

const { isDark } = useTheme()

const { selectedNodeId, updateNode, selectedNode } = useWorkflowOrThrow()

const config = computed<ExecuteScriptNodeConfig>(() => {
  return (selectedNode.value?.data?.config || {
    script: '',
    variables: [],
  }) as ExecuteScriptNodeConfig
})

const updateConfig = (updates: Partial<ExecuteScriptNodeConfig>) => {
  if (!selectedNodeId.value) return
  updateNode(selectedNodeId.value, {
    data: {
      ...selectedNode.value?.data,
      config: {
        ...config.value,
        ...updates,
      },
    },
  })
}

const scriptCode = computed({
  get: () => config.value.script || '',
  set: (value: string) => {
    updateConfig({ script: value })
  },
})

const updateTypes = async () => {
  if (!activeBaseSchema.value) return
  const typeGenerator = new TypeGenerator(true)
  const monaco = await loadMonacoEditor()

  monaco.languages.typescript.typescriptDefaults.setExtraLibs([
    { content: typeGenerator.generateTypes(activeBaseSchema.value) },
    { content: '' },
  ])
}

const dirty = false

const updateTheme = async () => {
  const monaco = await loadMonacoEditor()
  if (isDark.value) {
    monaco.editor.setTheme('vs-dark')
  } else {
    monaco.editor.setTheme('vs-light')
  }
}

async function setupMonacoEditor() {
  if (!editorRef.value) return

  const monaco = await loadMonacoEditor()

  await updateTypes()

  const model = monaco.editor.createModel(scriptCode.value, 'typescript')

  editor = monaco.editor.create(editorRef.value!, {
    model,
    contextmenu: false,
    theme: 'vs',
    folding: false,
    foldingStrategy: 'indentation',
    language: 'typescript',
    tabSize: 2,
    bracketPairColorization: {
      enabled: true,
      independentColorPoolPerBracketType: true,
    },
    lineNumbersMinChars: 5,
    minimap: {
      enabled: false,
    },
    scrollbar: {
      horizontal: 'hidden',
      verticalScrollbarSize: 6,
    },
    selectOnLineNumbers: false,
    scrollBeyondLastLine: false,
    fontSize: 13,
    lineHeight: 23,
    detectIndentation: true,
    autoIndent: 'full',
    automaticLayout: true,
    suggestOnTriggerCharacters: true,
    wordBasedSuggestions: 'currentDocument',
    quickSuggestions: true,
    tabCompletion: 'on',
    parameterHints: {
      enabled: true,
    },
    padding: {
      top: 6,
      bottom: 6,
    },
    overviewRulerBorder: false,
    wrappingStrategy: 'advanced',
    renderLineHighlight: 'none',
  })

  updateTheme()

  editor.onDidChangeModelContent(() => {
    if (dirty) {
      dirty = false
      return
    }
    updateConfig({
      script: editor.getValue(),
    })
  })

  editor.focus()
}

onMounted(async () => {
  await initializeMonaco()
  await until(() => editorRef.value).toBeTruthy()
  await setupMonacoEditor()
})

watch(activeBaseSchema, async (newVal) => {
  if (newVal) {
    await updateTypes()
  }
})

watch(isDark, async () => {
  await updateTheme()
})

onBeforeUnmount(async () => {
  editor?.getModel()?.dispose()
  editor?.dispose()
  const monaco = await loadMonacoEditor()
  monaco.editor.getModels().forEach((model) => model.dispose())
})
</script>

<template>
  <div class="border-r-1 border-b-1 h-full">
    <div class="text-nc-content-gray-emphasis px-3 border-b-1 text-captionBold py-2">Code</div>

    <div ref="editorRef" data-testid="nc-scripts-editor" class="h-full" />
  </div>
</template>

<style scoped lang="scss"></style>
