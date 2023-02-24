<script lang="ts" setup>
import dayjs from 'dayjs'
import type { PageSidebarNode, PublishTreeNode } from '~~/composables/docs/useDocs'

const props = defineProps<{
  modelValue: boolean
}>()

const emits = defineEmits(['update:modelValue'])

const isOpen = useVModel(props, 'modelValue', emits)

const {
  bulkPublish,
  fetchDrafts,
  // drafts,
  nestedDrafts,
  openedBook,
} = useDocs()

const formStatus = ref<'notSubmited' | 'submitting' | 'submitted'>('notSubmited')
const draftsFormTree = ref<Array<PublishTreeNode>>([])
const flatDraftsFormTree = computed(() => {
  const flat = (tree: Array<PublishTreeNode>) => {
    const flatTree: Array<PublishTreeNode> = []
    tree.forEach((node) => {
      flatTree.push(node)
      if (node.children) {
        flatTree.push(...flat(node.children as any))
      }
    })
    return flatTree
  }
  return flat(draftsFormTree.value)
})

watch(isOpen, async () => {
  if (isOpen.value) {
    formStatus.value = 'notSubmited'
    await fetchDrafts()
    draftsFormTree.value = []
    // traverse nestedDrafts.value tree and add selected property
    const traverse = (tree: Array<PageSidebarNode>, copy: Array<PublishTreeNode>) => {
      tree.forEach((node) => {
        copy.push({ ...node, isSelected: true, key: node.id! })

        if (node.children) {
          copy.find((draft) => draft.id === node.id)!.children = [] as Array<PublishTreeNode>
          traverse(node.children, copy.find((draft) => draft.id === node.id)!.children! as Array<PublishTreeNode>)
        }
      })
    }
    traverse(nestedDrafts.value, draftsFormTree.value)
  }
})

const onCheck = (page: PublishTreeNode, checked: boolean) => {
  // set selected property of the page and all its children
  const traverse = (tree: Array<PublishTreeNode>) => {
    tree.forEach((node) => {
      node.isSelected = checked
      if (node.children) {
        traverse(node.children as any)
      }
    })
  }

  if (page.children) traverse(page.children as any)
}

const publishDrafts = async () => {
  formStatus.value = 'submitting'

  try {
    await bulkPublish(flatDraftsFormTree.value.filter((draft) => draft.isSelected))
  } catch (e) {
    formStatus.value = 'notSubmited'
    console.error(e)
  } finally {
    formStatus.value = 'submitted'
  }
}
</script>

<template>
  <a-modal
    :visible="isOpen"
    :closable="false"
    ok-text="Publish"
    class="docs-publish-modal"
    :ok-button-props="{ hidden: true } as any"
    :cancel-button-props="{ hidden: true } as any"
    :footer="null"
    :centered="true"
  >
    <div v-if="isOpen" class="flex flex-col">
      <div class="flex flex-row justify-between items-center mr-4 ml-4 pb-1.5">
        <div class="flex text-md py-1 pl-2" style="font-weight: 500">
          <div v-if="formStatus === 'submitted'" class="text-green-500">{{ openedBook?.title }} has been published</div>
          <template v-else-if="formStatus === 'submitting'"> Publishing... </template>
          <template v-else> Publish </template>
        </div>
        <div class="flex hover:bg-gray-50 p-1 rounded-md cursor-pointer" @click="isOpen = false">
          <MdiClose class="my-auto" />
        </div>
      </div>
      <div class="flex flex-col mx-6 pt-3 border-t-1 border-gray-200">
        <template v-if="formStatus === 'submitted'">
          <div class="flex flex-row items-center pb-3">
            <a-button type="text" class="!rounded-sm !py-1 !bg-gray-100 !border-gray-200 !border-1"> Copy public link </a-button>
            <a-button type="text" class="!rounded-sm !py-1 !bg-gray-100 !border-gray-200 !border-1"> Open public link </a-button>
            <a-button type="text" class="!rounded-sm !py-1 !bg-gray-100 !border-gray-200 !border-1"> Embed </a-button>
          </div>
        </template>
        <template v-else-if="formStatus === 'submitting'">
          <a-skeleton-button class="!w-2/3 pb-3" :active="true" size="large" :block="true" />
        </template>
        <template v-else>
          <div class="flex mb-1.5 font-semibold text-xs">
            {{ flatDraftsFormTree.filter((draft) => draft.isSelected).length }}/{{ flatDraftsFormTree.length }} pages selected
          </div>
          <div class="doc-publish-draft-list flex flex-col mt-1.5 h-[calc(100vh-35rem)] overflow-y-auto">
            <DocsBookPublishDraftList :items="draftsFormTree" :level="1" :on-check="onCheck" />
          </div>
        </template>
        <div class="flex flex-row justify-end border-t-1 border-gray-200 pt-3 mb-2">
          <a-button
            v-if="formStatus === 'submitted'"
            type="primary"
            class="!rounded-md !py-1"
            style="font-weight: 500"
            @click="isOpen = false"
          >
            Done
          </a-button>
          <a-button v-else type="primary" class="!rounded-md !py-1" style="font-weight: 500" @click="publishDrafts">
            Publish v{{ openedBook?.order }}
          </a-button>
        </div>
      </div>
    </div>
  </a-modal>
</template>

<style lang="scss">
.docs-publish-modal {
  .doc-publish-draft-list {
    &::-webkit-scrollbar {
      width: 4px;
    }

    /* Track */
    &::-webkit-scrollbar-track {
      background: #ffffff00 !important;
    }

    /* Handle */
    &::-webkit-scrollbar-thumb {
      background: rgb(228, 228, 228);
    }

    /* Handle on hover */
    &::-webkit-scrollbar-thumb:hover {
      background: rgb(194, 194, 194);
    }
  }
  .ant-modal-content {
    @apply !rounded-md;
  }
  .ant-modal-body {
    @apply !py-2.5 !px-0;
  }
}
</style>
