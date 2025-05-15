<script setup lang="ts">
import { Handle, useNodeConnections } from '@vue-flow/core'
import type { ColumnType } from 'nocodb-sdk'

interface Props {
  record: Record<string, any>
  sourcePosition?: string
  targetPosition?: string
  coverImageFieldId?: string
  selectedCoverImageField?: ColumnType
  hierarchyData: Map<string, string[]>
  nodeSelected: (nodeId: string) => void
}
const props = defineProps<Props>()

const { getPossibleAttachmentSrc } = useAttachment()

const sourceConnections = useNodeConnections({
  handleType: 'target',
})

const targetConnections = useNodeConnections({
  handleType: 'source',
})

const isStartNode = computed(() => sourceConnections.value.length <= 0)

const isEndNode = computed(() => targetConnections.value.length <= 0)

watchEffect(() => {
  console.log('source', props.record, sourceConnections.value.length, targetConnections.value.length)
})
</script>

<template>
  <div class="w-full h-full">
    <Handle v-if="!isStartNode" type="target" :position="targetPosition"> </Handle>

    <Handle v-if="!isEndNode" type="source" :position="sourcePosition"> </Handle>

    <div v-if="coverImageFieldId && selectedCoverImageField">
      <CellAttachmentPreviewImage
        v-if="
          selectedCoverImageField?.title && record[selectedCoverImageField.title] && record[selectedCoverImageField.title].length
        "
        :key="`carousel-${record.Id}`"
        class="object-contain h-22 border-b"
        :srcs="getPossibleAttachmentSrc(record[selectedCoverImageField.title][0], 'card_cover')"
      />
      <div v-else class="h-22 w-full flex flex-row border-b border-gray-200 items-center justify-center">
        <img class="object-contain w-[48px] h-[48px]" src="~assets/icons/FileIconImageBox.png" />
      </div>
    </div>
    <div class="font-bold text-left w-full px-2 py-1 flex flex-col space-y-1">
      <span class="overflow-hidden font-bold text-lg text-center">{{ record.Title }}</span>
      <div v-if="!isEndNode || !hierarchyData.has(record.Id)" class="flex w-full justify-center items-center">
        <a-button
          size="small"
          class="!rounded-md w-8"
          type="text"
          :disabled="hierarchyData.has(record.Id)"
          @click.prevent="nodeSelected(record.Id)"
        >
          <GeneralIcon v-if="!hierarchyData.has(record.Id)" icon="chevronDown" />
          <GeneralIcon v-else icon="chevronUpDown" />
        </a-button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.process-node {
  padding: 10px;
  border-radius: 99px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.process-node .vue-flow__handle {
  border: none;
  height: unset;
  width: unset;
  background: transparent;
  font-size: 12px;
}
</style>
