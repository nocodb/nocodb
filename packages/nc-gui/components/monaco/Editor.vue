<script setup lang="ts">
import type { editor as MonacoEditor } from 'monaco-editor'
import { languages, editor as monacoEditor } from 'monaco-editor'

import PlaceholderContentWidget from './Placeholder'

interface Props {
  modelValue: string | Record<string, any>
  hideMinimap?: boolean
  lang?: string
  validate?: boolean
  disableDeepCompare?: boolean
  placeholder?: string
  readOnly?: boolean
  autoFocus?: boolean
  monacoConfig?: Partial<MonacoEditor.IStandaloneEditorConstructionOptions>
  monacoCustomTheme?: Partial<MonacoEditor.IStandaloneThemeData>
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  lang: 'json',
  validate: true,
  disableDeepCompare: false,
  autoFocus: true,
  monacoConfig: () => ({} as Partial<MonacoEditor.IStandaloneEditorConstructionOptions>),
  monacoCustomTheme: () => ({} as Partial<MonacoEditor.IStandaloneThemeData>),
})

const emits = defineEmits(['update:modelValue'])

const { modelValue, readOnly } = toRefs(props)

const { hideMinimap, lang, validate, disableDeepCompare, autoFocus, monacoConfig, monacoCustomTheme, placeholder } = props

const vModel = computed<string>({
  get: () => {
    if (typeof modelValue.value === 'object') {
      return JSON.stringify(modelValue.value, null, 2)
    } else {
      return modelValue.value ?? ''
    }
  },
  set: (newVal: string | Record<string, any>) => {
    if (typeof modelValue.value === 'object') {
      try {
        emits('update:modelValue', typeof newVal === 'object' ? newVal : JSON.parse(newVal))
      } catch (e) {
        console.error(e)
      }
    } else {
      emits('update:modelValue', newVal)
    }
  },
})

const isValid = ref(true)

const root = ref<HTMLDivElement>()

let editor: MonacoEditor.IStandaloneCodeEditor

const format = (space = monacoConfig.tabSize || 2) => {
  try {
    const parsedValue = JSON.parse(editor?.getValue() as string)
    editor.setValue(JSON.stringify(parsedValue, null, space))
  } catch (error: unknown) {
    console.error('Failed to parse and format JSON:', error)
  }
}

defineExpose({
  format,
  isValid,
})

onMounted(async () => {
  if (root.value && lang) {
    const model = monacoEditor.createModel(vModel.value, lang)

    if (lang === 'json') {
      // configure the JSON language support with schemas and schema associations
      languages.json.jsonDefaults.setDiagnosticsOptions({
        validate: validate as boolean,
      })
    }

    let isCustomTheme = false

    if (Object.keys(monacoCustomTheme).length) {
      monacoEditor.defineTheme('custom', monacoCustomTheme)
      isCustomTheme = true
    }

    editor = monacoEditor.create(root.value, {
      model,
      contextmenu: false,
      theme: isCustomTheme ? 'custom' : 'vs',
      foldingStrategy: 'indentation',
      selectOnLineNumbers: true,
      language: props.lang,
      scrollbar: {
        verticalScrollbarSize: 1,
        horizontalScrollbarSize: 1,
      },
      lineNumbers: 'off',
      tabSize: monacoConfig.tabSize || 2,
      automaticLayout: true,
      readOnly: readOnly.value,
      bracketPairColorization: {
        enabled: true,
        independentColorPoolPerBracketType: true,
      },
      minimap: {
        enabled: !hideMinimap,
      },
      ...(lang === 'json' ? { detectIndentation: false, insertSpaces: true } : {}),
      ...monacoConfig,
    })

    editor.onDidChangeModelContent(async () => {
      try {
        isValid.value = true

        if (disableDeepCompare || lang !== 'json') {
          vModel.value = editor.getValue()
        } else {
          const obj = JSON.parse(editor.getValue())

          if (!obj || !deepCompare(vModel.value, obj)) vModel.value = obj
        }
      } catch (e) {
        isValid.value = false
        console.log(e)
      }
    })

    if (placeholder) {
      // eslint-disable-next-line no-new
      new PlaceholderContentWidget(placeholder, editor)
    }

    const activeDrawerOrModal = isDrawerOrModalExist()

    if (!activeDrawerOrModal && autoFocus) {
      // auto focus on json cells only
      editor.focus()
    }

    if (activeDrawerOrModal?.classList.contains('json-modal') && autoFocus) {
      setTimeout(() => {
        const lineCount = editor.getModel()?.getLineCount() ?? 0
        const lastLineLength = editor.getModel()?.getLineContent(lineCount).length ?? 0
        const endPosition = { lineNumber: lineCount, column: lastLineLength + 1 }
        editor.setPosition(endPosition)
        editor.revealPositionInCenter(endPosition)
        editor.focus()
      }, 200)
    }

    if (lang === 'json') {
      format()
    }
  }
})

watch(vModel, (v) => {
  if (!editor || !v) return

  const editorValue = editor?.getValue()
  if (!disableDeepCompare && lang === 'json') {
    if (!editorValue || !deepCompare(JSON.parse(v), JSON.parse(editorValue))) {
      editor.setValue(v)
    }
  } else {
    if (editorValue !== v) editor.setValue(v)
  }
})

watch(readOnly, (v) => {
  if (!editor) return

  editor.updateOptions({ readOnly: v })
})
</script>

<template>
  <div ref="root"></div>
</template>

<style scoped lang="scss">
:deep(.monaco-editor) {
  background-color: transparent !important;
  border-radius: 8px !important;
  .view-line * {
    font-family: 'DM Mono', monospace !important;
  }
}

:deep(.overflow-guard) {
  border-radius: 8px !important;
}
</style>
