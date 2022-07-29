<script setup lang="ts">
import * as monaco from 'monaco-editor'
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import { onMounted } from '#imports'
import { deepCompare } from '~/utils'

const { modelValue } = defineProps<{ modelValue: any }>()

const emit = defineEmits(['update:modelValue'])
const isValid = ref(true)

/**
 * Adding monaco editor to Vite
 *
 * @ts-expect-error */
self.MonacoEnvironment = {
  getWorker(_: any, label: string) {
    if (label === 'json') {
      return new JsonWorker()
    }
    return new EditorWorker()
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
  if (root.value) {
    const model = monaco.editor.createModel(JSON.stringify(modelValue, null, 2), 'json')

    // configure the JSON language support with schemas and schema associations
    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
    })

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
        const obj = JSON.parse(editor.getValue())
        if (!deepCompare(modelValue, obj)) emit('update:modelValue', obj)
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
    if (editor && v && !deepCompare(v, JSON.parse(editor?.getValue() as string))) {
      editor.setValue(JSON.stringify(v, null, 2))
    }
  },
)
</script>

<template>
  <div ref="root"></div>
</template>
