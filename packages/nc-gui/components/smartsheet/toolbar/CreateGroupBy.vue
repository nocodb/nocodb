<script lang="ts" setup>
import type { ColumnType, LinkToAnotherRecordType } from 'nocodb-sdk'
import { RelationTypes, UITypes, isLinksOrLTAR, isSystemColumn } from 'nocodb-sdk'

const props = defineProps<{
  // As we need to focus search box when the parent is opened
  isParentOpen: boolean
  columns?: ColumnType[]
}>()

const emits = defineEmits(['created'])

const { isParentOpen, columns } = toRefs(props)

const inputRef = ref()

const search = ref('')

const activeFieldIndex = ref(-1)

const activeView = inject(ActiveViewInj, ref())

const meta = inject(MetaInj, ref())

const { showSystemFields, metaColumnById } = useViewColumnsOrThrow()

const { groupBy } = useViewGroupBy(activeView)

const options = computed<ColumnType[]>(
  () =>
    (columns.value || meta.value?.columns)
      ?.filter((c: ColumnType) => {
        if (c.uidt === UITypes.Links) {
          return true
        }
        if (isSystemColumn(metaColumnById?.value?.[c.id!])) {
          /** hide system columns if not enabled */
          if (c?.colOptions) {
            /** ignore virtual fields which are system fields ( mm relation ) and qr code fields */
            return false
          }
          return showSystemFields.value
        } else if (c.uidt === UITypes.QrCode || c.uidt === UITypes.Barcode || c.uidt === UITypes.ID) {
          return false
        } else {
          /** ignore hasmany and manytomany relations if it's using within group menu */
          return !(isLinksOrLTAR(c) && (c.colOptions as LinkToAnotherRecordType).type !== RelationTypes.BELONGS_TO)
        }
      })
      .filter((c: ColumnType) => !groupBy.value.find((g) => g.column?.id === c.id))
      .filter((c: ColumnType) => c.title?.toLowerCase().includes(search.value.toLowerCase())) ?? [],
)

const onClick = (column: ColumnType) => {
  emits('created', column)
}

watch(
  isParentOpen,
  () => {
    if (!isParentOpen.value) return

    setTimeout(() => {
      inputRef.value?.focus()
    }, 100)
  },
  {
    immediate: true,
  },
)

onMounted(() => {
  search.value = ''
  activeFieldIndex.value = -1
})

const onArrowDown = () => {
  activeFieldIndex.value = Math.min(activeFieldIndex.value + 1, options.value.length - 1)
}

const onArrowUp = () => {
  activeFieldIndex.value = Math.max(activeFieldIndex.value - 1, 0)
}
</script>

<template>
  <div
    class="flex flex-col w-full pt-4 pb-2 min-w-64 nc-group-by-create-modal"
    @keydown.arrow-down.prevent="onArrowDown"
    @keydown.arrow-up.prevent="onArrowUp"
    @keydown.enter.prevent="onClick(options[activeFieldIndex])"
  >
    <div class="flex pb-3 px-4 border-b-1 border-gray-100">
      <input ref="inputRef" v-model="search" class="w-full focus:outline-none" :placeholder="$t('msg.selectFieldToGroup')" />
    </div>
    <div class="flex-col w-full max-h-100 max-w-76 nc-scrollbar-md !overflow-y-auto">
      <div v-if="!options.length" class="flex text-gray-500 px-4 py-2.25">{{ $t('general.empty') }}</div>
      <div
        v-for="(option, index) in options"
        :key="index"
        v-e="['c:group-by:add:column:select']"
        class="flex flex-row h-10 items-center gap-x-1.5 px-2.5 hover:bg-gray-100 cursor-pointer nc-group-by-column-search-item"
        :class="{
          'bg-gray-100': activeFieldIndex === index,
        }"
        @click="onClick(option)"
      >
        <SmartsheetHeaderIcon :column="option" />
        <NcTooltip class="truncate">
          <template #title> {{ option.title }}</template>
          <span>
            {{ option.title }}
          </span>
        </NcTooltip>
      </div>
    </div>
  </div>
</template>
