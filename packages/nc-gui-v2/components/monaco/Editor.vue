<script setup lang="ts">
import * as monaco from 'monaco-editor'
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import TypescriptWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'
import { onMounted } from '#imports'
import { deepCompare } from '~/utils'

interface Props {
  modelValue: string
  lang?: string
  validate?: boolean
}

const { modelValue, lang = 'json', validate = true } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const isValid = ref(true)

/**
 * Adding monaco editor to Vite
 *
 * @ts-expect-error */
self.MonacoEnvironment = {
  getWorker(_: any, label: string) {
    switch (label) {
      case 'json':
        return new JsonWorker()
      case 'typescript':
        return new TypescriptWorker()
      default:
        return new EditorWorker()
    }
  },
}

const root = ref<HTMLDivElement>()
let editor: monaco.editor.IStandaloneCodeEditor

const format = () => {
  editor.setValue(JSON.stringify(JSON.parse(editor?.getValue() as string), null, 2))
}

defineExpose({
  format,
  isValid,
})

onMounted(() => {
  if (root.value && lang) {
    const model = monaco.editor.createModel(JSON.stringify(modelValue, null, 2), lang)
    if (lang === 'json') {
      // configure the JSON language support with schemas and schema associations
      monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
        validate: validate as boolean,
      })
    }

    editor = monaco.editor.create(root.value, {
      model,
      theme: 'vs',
      foldingStrategy: 'indentation',
      selectOnLineNumbers: true,
      scrollbar: {
        verticalScrollbarSize: 8,
        horizontalScrollbarSize: 8,
      },
      tabSize: 2,
      automaticLayout: true,
    })

    editor.onDidChangeModelContent(async (e) => {
      try {
        isValid.value = true

        const value = editor?.getValue()
        if (typeof modelValue === 'object') {
          if (!value || !deepCompare(modelValue, JSON.parse(value))) {
            emit('update:modelValue', JSON.stringify(modelValue, null, 2))
          }
        } else {
          if (value !== modelValue) emit('update:modelValue', value)
        }
      } catch (e) {
        isValid.value = false
        console.log(e)
      }
    })
  }
})

watch(
  () => modelValue,
  (v) => {
    if (editor && v) {
      const value = editor?.getValue()
      if (typeof v === 'object') {
        if (!value || !deepCompare(v, JSON.parse(value))) {
          editor.setValue(JSON.stringify(v, null, 2))
        }
      } else {
        if (value !== v) editor.setValue(v)
      }
    }
  },
)
</script>

<template>
  <div ref="root"></div>
</template>
