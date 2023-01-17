<script lang="ts" setup>
import dayjs from 'dayjs'
import type { PublishTreeNode } from '~~/composables/docs/useDocs'

const props = defineProps<{
  items: PublishTreeNode[]
  level: number
  onCheck: (page: PublishTreeNode, checked: boolean) => void
}>()

const { items, onCheck } = toRefs(props)
</script>

<template>
  <template v-for="item of items" :key="item">
    <div
      class="flex flex-row justify-between items-center mx-1 bg-gray-50 py-1 px-1 rounded-md mb-2 border-1 border-gray-100"
      :style="{ marginLeft: `${(level - 1) * 1.3}rem` }"
    >
      <div class="flex flex-row items-center gap-x-1 ml-4">
        <a-checkbox v-model:checked="item.isSelected" @update:checked="(checked) => onCheck(item, checked)" />
        <MdiFileDocumentOutline />
        <div>
          {{ item.title }}
        </div>
      </div>
      <div class="flex text-gray-500" style="font-weight: 300; font-size: 0.7rem">
        Last edited {{ dayjs(item.updated_at!).local().fromNow() }}
      </div>
    </div>
    <DocsBookPublishDraftList v-if="item.children" :items="(item.children as any)" :level="level + 1" :on-check="onCheck" />
  </template>
</template>

<style scoped></style>
