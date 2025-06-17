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

  monaco.languages.typescript.javascriptDefaults.addExtraLib(typeGenerator.generateTypes(activeBaseSchema.value))

  monaco.languages.typescript.javascriptDefaults.addExtraLib(libCode.value ?? '')

  monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    diagnosticCodesToIgnore: [1375, 1378, 2451, 6385, 1108],
    noSyntaxValidation: false,
  })

  monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ESNext,
    allowNonTsExtensions: true,
    noLib: false,
    strictFunctionTypes: true,
    strict: true,
  })

  const model = monaco.editor.createModel(code.value, 'javascript')

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
  configValue.value = JSON.parse(JSON.stringify(activeAutomation.value?.config || {})) || {}
  await until(() => editorRef.value).toBeTruthy()
  await setupMonacoEditor()
})
</script>

<template>
  <div class="flex h-full w-full nc-scripts-content-resizable-wrapper">
    <Splitpanes>
      <Pane :size="70" class="flex flex-col h-full min-w-0">
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
  <div class="h-9 border-t-1 flex border-nc-border-gray-medium px-2 py-1">
    <div class="flex-1" />
    <div class="flex items-center gap-2">
      <NuxtLink target="_blank" class="nc-docs-link" href="https://nocodb.com/docs/scripts">
        <div class="flex items-center text-nc-content-gray-subtle text-bodySmBold gap-2 px-2">
          <GeneralIcon icon="ncBookOpen" class="w-4 h-4 text-nc-content-gray-subtle" />
          APIs
        </div>
      </NuxtLink>

      <NuxtLink target="_blank" class="nc-docs-link" href="https://nocodb.com/docs/scripts">
        <div class="flex items-center text-nc-content-gray-subtle text-bodySmBold gap-2 px-2">
          <GeneralIcon icon="ncBookOpen" class="w-4 h-4 text-nc-content-gray-subtle" />
          Example Scripts
        </div>
      </NuxtLink>
      <NuxtLink target="_blank" class="nc-docs-link" href="https://nocodb.com/docs/scripts/api/base">
        <div class="flex items-center text-nc-content-gray-subtle text-bodySmBold gap-2 px-2">
          <GeneralIcon icon="ncBookOpen" class="w-4 h-4 text-nc-content-gray-subtle" />
          Script Docs
        </div>
      </NuxtLink>
    </div>
  </div>
</template>

<style lang="scss">
.nc-scripts-content-resizable-wrapper {
  height: calc(100% - var(--topbar-height) - 36px);
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
    @apply text-nc-content-gray-subtle2;
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
