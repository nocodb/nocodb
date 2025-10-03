<script setup lang="ts">
import { Pane, Splitpanes } from 'splitpanes'
import { initializeMonaco } from '../../../../../lib/monaco'
import { TypeGenerator } from '~/components/smartsheet/automation/scripts/utils/TypeGenerator'

// Lazy load Monaco Editor and its dependencies
const loadMonacoEditor = () => import('monaco-editor')
const loadMonacopilot = () => import('monacopilot')

const editorRef = ref<HTMLDivElement | null>(null)

let editor: monaco.editor.IStandaloneCodeEditor

const { isDark } = useTheme()

const { activeAutomation, activeBaseSchema } = storeToRefs(useAutomationStore())

const { appInfo } = useGlobal()

const { isAiBetaFeaturesEnabled } = useNocoAi()

const {
  libCode,
  config,
  configValue,
  isSettingsOpen,
  shouldShowSettings,
  isCreateEditScriptAllowed,
  isEditorOpen,
  updateScript,
  debouncedSave,
} = useScriptStoreOrThrow()

const updateTypes = async () => {
  if (!activeBaseSchema.value) return
  const typeGenerator = new TypeGenerator()
  const monaco = await loadMonacoEditor()

  monaco.languages.typescript.typescriptDefaults.setExtraLibs([
    { content: typeGenerator.generateTypes(activeBaseSchema.value) },
    { content: libCode.value ?? '' },
  ])
}

const { completeScript } = useNocoAi()

let dirty = false

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
  const { registerCompletion } = await loadMonacopilot()

  await updateTypes()

  const model = monaco.editor.createModel(activeAutomation.value?.script, 'typescript')

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

  if (isAiBetaFeaturesEnabled.value) {
    registerCompletion(monaco, editor, {
      language: 'typescript',
      endpoint: appInfo.value?.ncSiteUrl,
      allowFollowUpCompletions: true,
      requestHandler: async ({ body }) => {
        const res = await completeScript({
          ...body,
          schema: activeBaseSchema.value,
        })
        const processedCompletion = res.completion.trim().replace(/\t/g, '    ') // Convert tabs to spaces
        return {
          completion: processedCompletion,
        }
      },
    })
  }

  editor.onDidChangeModelContent(() => {
    if (dirty) {
      dirty = false
      return
    }
    updateScript({
      script: editor.getValue(),
      skipNetworkCall: true,
    })
    debouncedSave()
  })

  editor.focus()
}

watch(
  () => activeAutomation.value?._dirty,
  (newVal) => {
    if (newVal) {
      const pos = editor.getPosition()
      if (activeAutomation.value?.script !== editor.getValue()) {
        dirty = true
        editor.setValue(activeAutomation.value.script)
      }
      editor.setPosition(pos)
    }
  },
)

onMounted(async () => {
  await initializeMonaco()
  configValue.value = {
    ...(activeAutomation.value?.config ?? {}),
  }
  await waitForCondition(() => !!activeAutomation.value)
  await until(() => editorRef.value).toBeTruthy()
  await setupMonacoEditor()
})

watch(isEditorOpen, async (newVal) => {
  if (newVal) {
    await until(() => editorRef.value).toBeTruthy()
    await setupMonacoEditor()
  }
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
  <div
    class="flex h-full w-full nc-scripts-content-resizable-wrapper"
    :class="{
      'is-editor-open': isEditorOpen && isCreateEditScriptAllowed,
    }"
  >
    <Splitpanes>
      <Pane v-show="isCreateEditScriptAllowed" min-size="20" :size="isEditorOpen ? 70 : 0" class="flex flex-col h-full min-w-0">
        <div v-if="isEditorOpen" class="w-full flex-1">
          <div ref="editorRef" class="h-full" />
        </div>
      </Pane>
      <Pane :min-size="25" :size="isCreateEditScriptAllowed && isEditorOpen ? 30 : 100">
        <SmartsheetAutomationScriptsConfigInput
          v-if="isSettingsOpen && shouldShowSettings"
          v-model:model-value="configValue"
          :config="config"
        />
        <SmartsheetAutomationScriptsPlayground v-else :is-editor-open="isEditorOpen || !isCreateEditScriptAllowed" />
      </Pane>
    </Splitpanes>
  </div>
  <SmartsheetAutomationScriptsBottomBar />
</template>

<style lang="scss">
.nc-scripts-content-resizable-wrapper {
  &:not(.is-editor-open) {
    .splitpanes__splitter {
      display: none !important;
    }
  }

  height: calc(100svh - var(--topbar-height) - var(--footer-height));
  .monaco-editor {
    @apply !border-0 !rounded-b-lg outline-none;
  }
  .overflow-guard {
    @apply !border-0 !rounded-b-lg !rounded-t-0;
  }
  .monaco-editor,
  .monaco-diff-editor,
  .monaco-component {
    --vscode-editor-background: var(--nc-bg-default);
    --vscode-editorGutter-background: var(--nc-bg-default);
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
