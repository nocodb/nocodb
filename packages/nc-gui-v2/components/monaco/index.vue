<script setup lang="ts">
import * as monaco from 'monaco-editor'
import { onMounted } from '#imports'

const { modelValue } = defineProps<{ modelValue: any }>()
const emit = defineEmits(['update:modelValue'])

const root = ref<HTMLDivElement>()
let editor = $ref<monaco.editor.IStandaloneCodeEditor>()

onMounted(() => {
  if (root.value) {
    const model = monaco.editor.createModel(JSON.stringify(modelValue, null, 2), 'json')

    // configure the JSON language support with schemas and schema associations
    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
    })

    editor = monaco.editor.create(root.value, {
      model,
      theme: 'dark',
    })

    editor.onDidChangeModelContent(async (e) => {
      try {
        // console.log(e)
        // const obj = JSON.parse(editor.value.getValue())
        // if (!deepCompare(modelValue, obj)) emit('update:modelValue', obj)
      } catch (e) {
        console.log(e)
      }
    })
  }
})

// watch(
//   () => modelValue,
//   (v) => {
//     if (editor?.value && v && !deepCompare(v, JSON.parse(editor?.value?.getValue() as string))) {
//       debugger
//       editor.value.setValue(JSON.stringify(v, null, 2))
//     }
//   },
// )
</script>

<template>
  <div ref="root"></div>
</template>

<style scoped></style>
