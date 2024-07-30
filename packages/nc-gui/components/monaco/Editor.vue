<script setup lang="ts">
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker&inline'
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker&inline'

import type { editor as MonacoEditor } from 'monaco-editor'

interface Props {
  modelValue: string | Record<string, any>
  hideMinimap?: boolean
  lang?: string
  validate?: boolean
  disableDeepCompare?: boolean
  readOnly?: boolean
  autoFocus?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  lang: 'json',
  validate: true,
  disableDeepCompare: false,
  autoFocus: true,
})

const emits = defineEmits(['update:modelValue'])

const { modelValue } = toRefs(props)

const { hideMinimap, lang, validate, disableDeepCompare, readOnly, autoFocus } = props

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

/**
 * Adding monaco editor to Vite
 *
 * @ts-expect-error */
self.MonacoEnvironment = window.MonacoEnvironment = {
  async getWorker(_: any, label: string) {
    switch (label) {
      case 'json': {
        const workerBlob = new Blob([JsonWorker], { type: 'text/javascript' })
        return await initWorker(URL.createObjectURL(workerBlob))
      }
      default: {
        const workerBlob = new Blob([EditorWorker], { type: 'text/javascript' })
        return await initWorker(URL.createObjectURL(workerBlob))
      }
    }
  },
}

const root = ref<HTMLDivElement>()

let editor: MonacoEditor.IStandaloneCodeEditor

const format = () => {
  editor.setValue(JSON.stringify(JSON.parse(editor?.getValue() as string), null, 2))
}

defineExpose({
  format,
  isValid,
})

onMounted(async () => {
  const { editor: monacoEditor, languages } = await import('monaco-editor')

  if (root.value && lang) {
    const model = monacoEditor.createModel(vModel.value, lang)

    if (lang === 'json') {
      // configure the JSON language support with schemas and schema associations
      languages.json.jsonDefaults.setDiagnosticsOptions({
        validate: validate as boolean,
      })
    }

    editor = monacoEditor.create(root.value, {
      model,
      theme: 'vs',
      foldingStrategy: 'indentation',
      selectOnLineNumbers: true,
      language: props.lang,
      scrollbar: {
        verticalScrollbarSize: 1,
        horizontalScrollbarSize: 1,
      },
      lineNumbers: 'off',
      tabSize: 2,
      automaticLayout: true,
      readOnly,
      bracketPairColorization: {
        enabled: true,
        independentColorPoolPerBracketType: true,
      },
      minimap: {
        enabled: !hideMinimap,
      },
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

    if (!isDrawerOrModalExist() && autoFocus) {
      // auto focus on json cells only
      editor.focus()
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

watch(
  () => readOnly,
  (v) => {
    if (!editor) return

    editor.updateOptions({ readOnly: v })
  },
)
</script>

<template>
  <div ref="root"></div>
</template>

<style scoped lang="scss">
:deep(.margin-view-overlays) {
  @apply !w-0;
}
:deep(.margin) {
  @apply !w-0;
}

:deep(.monaco-scrollable-element) {
  @apply !left-0;
}
</style>
