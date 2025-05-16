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
  displayValueCol?: ColumnType
}
const props = defineProps<Props>()

const { record, displayValueCol } = toRefs(props)

const sourceConnections = useNodeConnections({
  handleType: 'target',
})

const targetConnections = useNodeConnections({
  handleType: 'source',
})

const meta = inject(MetaInj, ref())

const isStartNode = computed(() => sourceConnections.value.length <= 0)

const isEndNode = computed(() => targetConnections.value.length <= 0)

const { getPossibleAttachmentSrc } = useAttachment()

const { t } = useI18n()
const { metas } = useMetas()
const basesStore = useBases()

const { basesUser } = storeToRefs(basesStore)

const baseStore = useBase()
const { isXcdbBase, isMssql, isMysql } = baseStore
const { sqlUis } = storeToRefs(baseStore)

const plainCellValue = computed(() => {
  if (!meta.value || !displayValueCol.value) return ''

  const sqlUi =
    displayValueCol.value?.source_id && sqlUis.value[displayValueCol.value?.source_id]
      ? sqlUis.value[displayValueCol.value?.source_id]
      : Object.values(sqlUis.value)[0]

  const abstractType = displayValueCol.value && sqlUi.getAbstractType(displayValueCol.value)

  return parsePlainCellValue(record.value[displayValueCol.value.title!], {
    col: displayValueCol.value,
    abstractType,
    meta: meta.value,
    metas: metas.value,
    baseUsers: basesUser.value,
    isMssql,
    isMysql,
    isXcdbBase,
    t,
  })
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
      <span class="overflow-hidden font-bold text-lg text-center">{{ plainCellValue }}</span>
      <div v-if="!isEndNode || !hierarchyData.has(record.Id)" class="flex w-full justify-center items-center">
        <NcButton
          size="small"
          type="text"
          :disabled="hierarchyData.has(record.Id)"
          icon-only
          @click.prevent="nodeSelected(record.Id)"
        >
          <template #icon>
            <GeneralIcon v-if="!hierarchyData.has(record.Id)" icon="chevronDown" />
            <GeneralIcon v-else icon="chevronUpDown" />
          </template>
        </NcButton>
      </div>
    </div>
  </div>
</template>
