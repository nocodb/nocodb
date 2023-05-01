<script lang="ts" setup>
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import { Icon as IconifyIcon } from '@iconify/vue'
import type { DocsPageType } from 'nocodb-sdk'
import { LoadingOutlined } from '@ant-design/icons-vue'

const { node } = defineProps(nodeViewProps)

const indicator = h(LoadingOutlined, {
  style: {
    fontSize: '18px',
  },
  spin: true,
})

const { flattenedNestedPages, openedProjectId, nestedPagesOfProjects, isPublic } = storeToRefs(useDocStore())
const { nestedUrl, fetchPage } = useDocStore()

const isLoading = ref(false)
const isErrored = ref(false)
const publicPage = ref<DocsPageType | null>(null)

const page = computed(() => {
  if (publicPage.value) return publicPage.value
  if (!node.attrs.pageId) return null

  return flattenedNestedPages.value.find((p) => p.id === node.attrs.pageId)
})

onMounted(async () => {
  if (!publicPage.value && isPublic.value) {
    const pageId = node.attrs.pageId
    if (pageId) {
      isLoading.value = true
      try {
        const page = await fetchPage({
          page: { id: pageId, project_id: openedProjectId.value } as any,
          projectId: openedProjectId.value,
          doNotSetProject: true,
        })
        if (!page) {
          isErrored.value = true
        }

        publicPage.value = page as any
      } catch (e) {
        isErrored.value = true
      }
      isLoading.value = false
    }
  }
})

watch(
  () => nestedPagesOfProjects.value[openedProjectId.value],
  (value) => {
    if (value) {
      isLoading.value = false
    } else {
      isLoading.value = true
    }
  },
  {
    immediate: true,
  },
)
</script>

<template>
  <NodeViewWrapper class="vue-component link-to-page-wrapper relative rounded-sm my-1">
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
        'bg-gray-50': !page && !isErrored,
      }"
    >
      <div
        v-if="isLoading || isErrored"
        class="flex w-full flex-row py-1.5 px-2.5 items-center gap-x-2.5 cursor-not-allowed group"
      >
        <div v-if="isLoading" class="-mt-1">
          <a-spin :indicator="indicator" class="!text-gray-500 flex" />
        </div>
        <div v-else-if="isErrored" class="flex flex-row items-center gap-x-2.5">
          <div class="flex relative">
            <IcBaselineVisibilityOff class="flex text-black -mt-0.5 text-md" />
            <div class="absolute -right-2 -bottom-1">
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
            class="flex text-sm text-black underline !underline-gray-300 underline-offset-4"
            :style="{
              fontWeight: 500,
            }"
          >
            No access
          </div>
        </div>
      </div>
      <a
        v-else-if="page"
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

<style lang="scss">
.ProseMirror {
  .focused {
    .link-to-page-wrapper {
      // outline with rounded corners
      background-color: #e8eafd;
      border-radius: 1px;
    }
  }
}
</style>
