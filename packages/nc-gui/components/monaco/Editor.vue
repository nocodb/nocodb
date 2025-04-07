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

let isInitialLoad = false

const vModel = computed<string>({
  get: () => {
    const value = modelValue.value

    // If value is null or undefined, return null
    if (ncIsNull(value) || ncIsUndefined(value)) {
      return null
    }

    // If value is not a string, convert it to a formatted JSON string
    if (typeof value !== 'string') {
      return JSON.stringify(value, null, 2)
    }

    // Handle JSON-specific cases on the initial load
    if (lang === 'json' && !isInitialLoad) {
      try {
        // if null string, return '"null"'
        if (value.trim() === 'null') {
          return '"null"'
        }
        // If value is a valid JSON string, leave it as is
        JSON.parse(value)
      } catch (e) {
        // If value is an invalid JSON string, convert it to a JSON string format
        return JSON.stringify(value)
      } finally {
        // Ensure this block runs only once during the initial load
        isInitialLoad = true
      }
    }

    return value
  },
  set: (newVal: string | Record<string, any>) => {
    try {
      // if the new value is null, emit null
      if (newVal === 'null') {
        emits('update:modelValue', null)
      }
      // If the current value is an object, attempt to parse and update
      else if (typeof modelValue.value === 'object') {
        // If the new value is 'null', emit null
        const parsedValue = typeof newVal === 'object' ? newVal : JSON.parse(newVal)
        emits('update:modelValue', parsedValue)
      } else {
        // Directly emit new value if it's not an object
        emits('update:modelValue', newVal)
      }
    } catch (e) {
      console.error('Failed to parse JSON:', e)
    }
  },
})

const isValid = ref(true)

const error = ref('')

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
  error,
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
        error.value = ''

        if (disableDeepCompare || lang !== 'json') {
          vModel.value = editor.getValue()
        } else {
          const obj = JSON.parse(editor.getValue())

          if (!obj || !deepCompare(vModel.value, obj)) vModel.value = obj
        }
      } catch (e) {
        isValid.value = false
        const err = await extractSdkResponseErrorMsg(e)
        error.value = err
        console.log(err)
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
