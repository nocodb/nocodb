<script lang="ts" setup>
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import { LoadingOutlined } from '@ant-design/icons-vue'

const { node } = defineProps(nodeViewProps)

const indicator = h(LoadingOutlined, {
  style: {
    fontSize: '18px',
  },
  spin: true,
})

const handleClick = () => {
  window.open(node.attrs.url, '_blank')
}
</script>

<template>
  <NodeViewWrapper class="vue-component attachment-wrapper h-10 my-1.5">
    <div v-if="node.attrs.isUploading" class="flex flex-row space-x-4 px-4 py-2.5 bg-gray-100 rounded-md w-full items-baseline">
      <a-spin :indicator="indicator" class="!text-gray-500 flex" />
      <div class="flex text-sm text-gray-600">Uploading</div>
    </div>
    <div
      v-else
      class="attachment h-full flex flex-row items-center gap-x-2 w-full rounded-md hover:bg-gray-100 px-4 cursor-pointer"
      :url="node.attrs.url"
      @click="handleClick"
    >
      <MdiFileUploadOutline class="flex" />
      <div class="flex">
        {{ node.attrs.name }}
      </div>
      <div class="mt-0.5 flex text-xs text-gray-400">{{ Math.round((node.attrs.size / 1024) * 10) / 10 }} KB</div>
    </div>
  </NodeViewWrapper>
</template>
