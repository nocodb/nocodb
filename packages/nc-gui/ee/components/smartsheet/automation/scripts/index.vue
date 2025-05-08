<script setup lang="ts">
import * as monaco from 'monaco-editor'
import { Pane, Splitpanes } from 'splitpanes'
import { TypeGenerator } from '~/components/smartsheet/automation/scripts/utils/TypeGenerator'

const editorRef = ref<HTMLDivElement | null>(null)

let editor: monaco.editor.IStandaloneCodeEditor

const automationStore = useAutomationStore()

const { loadAutomation } = automationStore

const { activeProjectId } = storeToRefs(useBases())

const { activeAutomation, isLoadingAutomation, activeAutomationId, activeBaseSchema } = storeToRefs(automationStore)

const { libCode, code, config, configValue, isSettingsOpen } = useScriptStoreOrThrow()

async function setupMonacoEditor() {
  await until(() => isLoadingAutomation.value === false).toBeTruthy()
  await until(() => !!activeAutomation.value).toBeTruthy()

  if (!editorRef.value) return

  const typeGenerator = new TypeGenerator()

  monaco.languages.typescript.javascriptDefaults.addExtraLib(typeGenerator.generateTypes(activeBaseSchema.value))

  monaco.languages.typescript.javascriptDefaults.addExtraLib(libCode.value ?? '')

  monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    diagnosticCodesToIgnore: [1375, 1378, 2451],
    noSyntaxValidation: false,
  })

  monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ES2016,
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
  await until(() => !!activeAutomationId.value).toBeTruthy()
  await until(() => activeBaseSchema?.value?.id === activeProjectId.value).toBeTruthy()

  await loadAutomation(activeAutomationId.value)
  code.value = activeAutomation.value?.script || ''

  configValue.value = activeAutomation.value?.config || {}

  await until(() => editorRef.value).toBeTruthy()
  await setupMonacoEditor()
})

const { updateAutomation } = useAutomationStore()

const { isUIAllowed } = useRoles()

watch(
  configValue,
  (newVal) => {
    if (JSON.stringify(newVal) === JSON.stringify(activeAutomation.value.config)) return
    updateAutomation(
      activeProjectId.value,
      activeAutomationId.value,
      {
        config: newVal,
      },
      {
        skipNetworkCall: !isUIAllowed('scriptCreateOrEdit'),
      },
    )
  },
  {
    deep: true,
  },
)
</script>

<template>
  <div v-show="!isLoadingAutomation" class="flex h-full w-full">
    <Splitpanes class="nc-extensions-content-resizable-wrapper">
      <Pane class="flex flex-col h-full min-w-0">
        <div class="w-full flex-1">
          <div ref="editorRef" class="h-full" />
        </div>
      </Pane>
      <Pane>
        <SmartsheetAutomationScriptsConfigInput v-if="isSettingsOpen" v-model:model-value="configValue" :config="config" />
        <SmartsheetAutomationScriptsPlayground v-else />
      </Pane>
    </Splitpanes>
  </div>

  <div v-show="isLoadingAutomation" class="w-full flex items-center justify-center h-full">
    <GeneralLoader size="xlarge" />
  </div>
</template>

<style lang="scss">
.monaco-editor {
  position: absolute !important;
}
</style>
