<script setup lang="ts">
import { MetaInj } from '#imports'

const editorOpen = ref(false)

const meta = $(inject(MetaInj))
</script>

<template>
  <a-tooltip>
    <template #title>
      <span> Debug Meta </span>
    </template>
    <mdi-bug-outline class="cursor-pointer" @click="editorOpen = true" />
  </a-tooltip>

  <a-modal v-model:visible="editorOpen" :footer="null" width="80%" :title="meta.title">
    <MonacoEditor ref="jsonEditorRef" v-model="meta" class="h-max-[70vh]" />
  </a-modal>
</template>
