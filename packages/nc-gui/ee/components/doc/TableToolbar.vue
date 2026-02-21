<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3'

const props = defineProps<{
  editor: Editor
}>()

const editor = toRef(props, 'editor')

const addColumnBefore = () => editor.value.chain().focus().addColumnBefore().run()
const addColumnAfter = () => editor.value.chain().focus().addColumnAfter().run()
const deleteColumn = () => editor.value.chain().focus().deleteColumn().run()
const addRowBefore = () => editor.value.chain().focus().addRowBefore().run()
const addRowAfter = () => editor.value.chain().focus().addRowAfter().run()
const deleteRow = () => editor.value.chain().focus().deleteRow().run()
const deleteTable = () => editor.value.chain().focus().deleteTable().run()
</script>

<template>
  <div class="nc-doc-table-toolbar flex items-center gap-x-0.5 bg-nc-bg-default rounded-lg px-1 py-1">
    <!-- Column operations -->
    <NcTooltip>
      <template #title>Add column before</template>
      <NcButton size="small" type="text" @click="addColumnBefore">
        <div class="flex items-center gap-0.5 text-[11px] font-medium px-0.5">
          <GeneralIcon icon="plus" class="!text-[12px]" />
          <span>Col ←</span>
        </div>
      </NcButton>
    </NcTooltip>

    <NcTooltip>
      <template #title>Add column after</template>
      <NcButton size="small" type="text" @click="addColumnAfter">
        <div class="flex items-center gap-0.5 text-[11px] font-medium px-0.5">
          <GeneralIcon icon="plus" class="!text-[12px]" />
          <span>Col →</span>
        </div>
      </NcButton>
    </NcTooltip>

    <NcTooltip>
      <template #title>Delete column</template>
      <NcButton size="small" type="text" class="!text-red-500" @click="deleteColumn">
        <div class="flex items-center gap-0.5 text-[11px] font-medium px-0.5">
          <GeneralIcon icon="delete" class="!text-[12px]" />
          <span>Col</span>
        </div>
      </NcButton>
    </NcTooltip>

    <div class="divider border-r-1 border-nc-border-gray-medium !h-5 !mx-0.5" />

    <!-- Row operations -->
    <NcTooltip>
      <template #title>Add row above</template>
      <NcButton size="small" type="text" @click="addRowBefore">
        <div class="flex items-center gap-0.5 text-[11px] font-medium px-0.5">
          <GeneralIcon icon="plus" class="!text-[12px]" />
          <span>Row ↑</span>
        </div>
      </NcButton>
    </NcTooltip>

    <NcTooltip>
      <template #title>Add row below</template>
      <NcButton size="small" type="text" @click="addRowAfter">
        <div class="flex items-center gap-0.5 text-[11px] font-medium px-0.5">
          <GeneralIcon icon="plus" class="!text-[12px]" />
          <span>Row ↓</span>
        </div>
      </NcButton>
    </NcTooltip>

    <NcTooltip>
      <template #title>Delete row</template>
      <NcButton size="small" type="text" class="!text-red-500" @click="deleteRow">
        <div class="flex items-center gap-0.5 text-[11px] font-medium px-0.5">
          <GeneralIcon icon="delete" class="!text-[12px]" />
          <span>Row</span>
        </div>
      </NcButton>
    </NcTooltip>

    <div class="divider border-r-1 border-nc-border-gray-medium !h-5 !mx-0.5" />

    <!-- Delete entire table -->
    <NcTooltip>
      <template #title>Delete table</template>
      <NcButton size="small" type="text" class="!text-red-500" @click="deleteTable">
        <div class="flex items-center gap-0.5 text-[11px] font-medium px-0.5">
          <GeneralIcon icon="delete" class="!text-[12px]" />
          <span>Table</span>
        </div>
      </NcButton>
    </NcTooltip>
  </div>
</template>
