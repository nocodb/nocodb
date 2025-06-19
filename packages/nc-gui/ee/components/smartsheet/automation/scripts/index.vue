<script setup lang="ts">
import * as monaco from 'monaco-editor'
import { Pane, Splitpanes } from 'splitpanes'
import { TypeGenerator } from '~/components/smartsheet/automation/scripts/utils/TypeGenerator'

const editorRef = ref<HTMLDivElement | null>(null)

let editor: monaco.editor.IStandaloneCodeEditor

const { activeAutomation, activeBaseSchema } = storeToRefs(useAutomationStore())

const { libCode, code, config, configValue, isSettingsOpen, shouldShowSettings } = useScriptStoreOrThrow()

async function setupMonacoEditor() {
  if (!editorRef.value) return
  const typeGenerator = new TypeGenerator()

  const model = monaco.editor.createModel(code.value, 'typescript')

  monaco.languages.typescript.typescriptDefaults.setExtraLibs([
    { content: typeGenerator.generateTypes(activeBaseSchema.value) },
    { content: libCode.value ?? '' },
  ])

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
    wordBasedSuggestions: 'allDocuments',
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
    renderIndentGuides: false,
    wrappingStrategy: 'advanced',
    renderLineHighlight: 'none',
  })

  editor.onDidChangeModelContent(() => {
    code.value = editor.getValue()
  })

  editor.focus()
}

onMounted(async () => {
  code.value = activeAutomation.value?.script || ''
  configValue.value = {
    ...(activeAutomation.value?.config ?? {}),
  }
  await until(() => editorRef.value).toBeTruthy()
  await setupMonacoEditor()
})

onBeforeUnmount(() => {
  editor?.getModel()?.dispose()
  editor?.dispose()
  monaco.editor.getModels().forEach((model) => model.dispose())
})
</script>

<template>
  <div class="flex h-full w-full nc-scripts-content-resizable-wrapper">
    <Splitpanes>
      <Pane min-size="20" :size="70" class="flex flex-col h-full min-w-0">
        <div class="w-full flex-1">
          <div ref="editorRef" class="h-full" />
        </div>
      </Pane>
      <Pane :min-size="25" :size="30">
        <SmartsheetAutomationScriptsConfigInput
          v-if="isSettingsOpen && shouldShowSettings"
          v-model:model-value="configValue"
          :config="config"
        />
        <SmartsheetAutomationScriptsPlayground v-else />
      </Pane>
    </Splitpanes>
  </div>
  <SmartsheetAutomationScriptsBottomBar />
</template>

<style lang="scss">
.nc-scripts-content-resizable-wrapper {
  height: calc(100svh - var(--topbar-height) - 30px);
  .monaco-editor {
    @apply !border-0 !rounded-b-lg outline-none;
  }
  .overflow-guard {
    @apply !border-0 !rounded-b-lg !rounded-t-0;
  }
  .monaco-editor,
  .monaco-diff-editor,
  .monaco-component {
    --vscode-editor-background: #ffffff;
    --vscode-editorGutter-background: #ffffff;
  }
  .line-numbers {
    @apply text-nc-content-gray-subtle2 !pr-1;
  }
  .monaco-hover-content {
    @apply !bg-nc-bg-gray-extralight;
    border-radius: 12px !important;

    .status-bar {
      @apply !bg-nc-bg-gray-extralight;
      .actions {
        @apply !bg-nc-bg-gray-extralight !py-1;
        .action {
          @apply !no-underline !text-nc-content-brand font-semibold;
        }
      }
    }
  }
}

.nc-docs-link {
  @apply !text-nc-content-gray-subtle no-underline;
}
</style>
