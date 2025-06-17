<script setup lang="ts">
import * as monaco from 'monaco-editor'
import { Pane, Splitpanes } from 'splitpanes'
import { TypeGenerator } from '~/components/smartsheet/automation/scripts/utils/TypeGenerator'

const editorRef = ref<HTMLDivElement | null>(null)

let editor: monaco.editor.IStandaloneCodeEditor

const { isUIAllowed } = useRoles()

const { activeAutomation, activeAutomationId, activeBaseSchema } = storeToRefs(useAutomationStore())

const { activeProjectId } = storeToRefs(useBases())

const { libCode, code, config, configValue, isSettingsOpen } = useScriptStoreOrThrow()

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
    foldingStrategy: 'indentation',
    selectOnLineNumbers: true,
    language: 'typescript',
    tabSize: 2,
    bracketPairColorization: {
      enabled: true,
      independentColorPoolPerBracketType: true,
    },
    minimap: {
      enabled: false,
    },
    fontSize: 13,
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
  })

  editor.onDidChangeModelContent(() => {
    code.value = editor.getValue()
  })

  editor.focus()
}

onMounted(async () => {
  code.value = activeAutomation.value?.script || ''
  configValue.value = activeAutomation.value?.config || {}
  await until(() => editorRef.value).toBeTruthy()
  await setupMonacoEditor()
})

const { updateAutomation } = useAutomationStore()

const triggerUpdate = useDebounceFn((val) => {
  updateAutomation(
    activeProjectId.value,
    activeAutomationId.value,
    {
      config: val,
    },
    {
      skipNetworkCall: !isUIAllowed('scriptCreateOrEdit'),
    },
  )
}, 1000)
</script>

<template>
  <div class="flex h-full w-full">
    <Splitpanes class="nc-extensions-content-resizable-wrapper">
      <Pane class="flex flex-col h-full min-w-0">
        <div class="w-full flex-1">
          <div ref="editorRef" class="h-full" />
        </div>
      </Pane>
      <Pane>
        <SmartsheetAutomationScriptsConfigInput
          v-if="isSettingsOpen"
          v-model:model-value="configValue"
          :config="config"
          @change="triggerUpdate"
        />
        <SmartsheetAutomationScriptsPlayground v-else />
      </Pane>
    </Splitpanes>
  </div>
</template>

<style lang="scss">
.monaco-editor {
  position: absolute !important;
}
</style>
