<script lang="ts" setup>
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import { Icon as IconifyIcon } from '@iconify/vue'

const { node } = defineProps(nodeViewProps)

const { flattenedNestedPages, openedProjectId } = storeToRefs(useDocStore())
const { nestedUrl } = useDocStore()

const page = computed(() => {
  if (!node.attrs.pageId) return null

  return flattenedNestedPages.value.find((p) => p.id === node.attrs.pageId)
})
</script>

<template>
  <NodeViewWrapper class="vue-component link-to-page-wrapper relative rounded-sm">
    <div
      v-if="!node.attrs.pageId"
      class="absolute w-full top-0 link-to-page-placeholder"
      :style="{
        height: '1px',
      }"
    ></div>
    <div
      v-else
      class="flex w-full min-h-8"
      :class="{
        'bg-gray-50': !page,
      }"
    >
      <a
        v-if="page"
        class="flex text-black text-none w-full"
        :style="{
          textDecoration: 'none !important',
        }"
        :href="`#${nestedUrl({ id: page.id!, projectId: openedProjectId })}`"
      >
        <div class="flex w-full flex-row py-1.5 px-2.5 hover:bg-gray-100 items-center gap-x-2.5 cursor-pointer group">
          <div class="relative">
            <IconifyIcon
              v-if="page.icon"
              :key="page.icon"
              :data-testid="`nc-doc-page-icon-${page.icon}`"
              class="text-lg"
              :icon="page.icon"
            ></IconifyIcon>
            <MdiFileDocumentOutline v-else class="text-black -mt-0.5 text-md" />
            <div
              class="absolute -right-2"
              :class="{
                '-bottom-2': page.icon,
                '-bottom-1': !page.icon,
              }"
            >
              <svg
                class="nc-icon text-black p-0 h-3"
                preserveAspectRatio="xMidYMid meet"
                viewBox="0 0 24 24"
                width="1.5em"
                height="1.5em"
              >
                <path
                  marker-width="10"
                  fill="currentColor"
                  stroke="white"
                  stroke-width="6"
                  width="10"
                  d="M6.4 18L5 16.6L14.6 7H6V5h12v12h-2V8.4Z"
                ></path>
                <path
                  marker-width="10"
                  fill="currentColor"
                  stroke="black"
                  stroke-width="2"
                  width="6"
                  d="M6.4 18L5 16.6L14.6 7H6V5h12v12h-2V8.4Z"
                ></path>
              </svg>
            </div>
          </div>
          <div
            class="flex text-sm text-black underline !underline-gray-300 !group-hover:underline-gray-800 underline-offset-4"
            :style="{
              fontWeight: 500,
            }"
          >
            {{ page?.title }}
          </div>
        </div>
      </a>
    </div>
  </NodeViewWrapper>
</template>
