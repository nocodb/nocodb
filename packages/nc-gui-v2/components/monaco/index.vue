<script setup lang="ts">
import * as monaco from 'monaco-editor'
import { onMounted } from '#imports'

const { modelValue } = defineProps<{ modelValue: any }>()
const emit = defineEmits(['update:modelValue'])

const root = ref<HTMLDivElement>()
const editor = ref<monaco.editor.IStandaloneCodeEditor>()

onMounted(() => {
  if (root.value) {
    editor.value = monaco.editor.create(root?.value, {
      value: JSON.stringify(modelValue, null, 2),
      language: 'json',
    })

    editor.value.onDidChangeModelContent((e) => {
      try {
        emit('update:modelValue', JSON.parse(editor?.value?.getValue() as string))
      } catch {}
    })
  }
})

watch(
  () => modelValue && JSON.stringify(modelValue, null, 2),
  (v) => {
    if (editor?.value && v) {
      editor.value.setValue(v)
    }
  },
)
</script>

<template>
  <div ref="root"></div>
</template>

<style scoped></style>
