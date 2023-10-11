<script lang="ts" setup>
import type { ColumnType, LinkToAnotherRecordType } from 'nocodb-sdk'
import { RelationTypes, UITypes, isLinksOrLTAR, isSystemColumn } from 'nocodb-sdk'

const props = defineProps<{
  // As we need to focus search box when the parent is opened
  isParentOpen: boolean
}>()

const emits = defineEmits(['created'])

const { isParentOpen } = toRefs(props)

const inputRef = ref()

const search = ref('')

const activeFieldIndex = ref(-1)

const activeView = inject(ActiveViewInj, ref())

const meta = inject(MetaInj, ref())

const { showSystemFields, metaColumnById } = useViewColumnsOrThrow(activeView, meta)

const { sorts } = useViewSorts(activeView)

const options = computed<ColumnType[]>(
  () =>
    meta.value?.columns
      ?.filter((c: ColumnType) => {
        if (c.uidt === UITypes.Links) {
          return true
        }
        if (isSystemColumn(metaColumnById?.value?.[c.id!])) {
          return (
            /** hide system columns if not enabled */
            showSystemFields.value
          )
        } else if (c.uidt === UITypes.QrCode || c.uidt === UITypes.Barcode || c.uidt === UITypes.ID) {
          return false
        } else {
          /** ignore hasmany and manytomany relations if it's using within sort menu */
          return !(isLinksOrLTAR(c) && (c.colOptions as LinkToAnotherRecordType).type !== RelationTypes.BELONGS_TO)
          /** ignore virtual fields which are system fields ( mm relation ) and qr code fields */
        }
      })
      .filter((c: ColumnType) => !sorts.value.find((s) => s.fk_column_id === c.id))
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
    class="flex flex-col w-full pt-4 pb-2 min-w-64 nc-sort-create-modal"
    @keydown.arrow-down.prevent="onArrowDown"
    @keydown.arrow-up.prevent="onArrowUp"
    @keydown.enter.prevent="onClick(options[activeFieldIndex])"
  >
    <div class="flex pb-3 px-4 border-b-1 border-gray-100">
      <input ref="inputRef" v-model="search" class="w-full focus:outline-none" :placeholder="$t('msg.selectFieldToSort')" />
    </div>
    <div class="flex-col w-full max-h-100 nc-scrollbar-md !overflow-y-auto">
      <div v-if="!options.length" class="flex text-gray-500 px-4 py-2.25">{{ $t('general.empty') }}</div>
      <div
        v-for="(option, index) in options"
        :key="index"
        v-e="['c:sort:add:column:select']"
        class="flex flex-row h-10 items-center gap-x-1.5 px-2.5 hover:bg-gray-100 cursor-pointer nc-sort-column-search-item"
        :class="{
          'bg-gray-100': activeFieldIndex === index,
        }"
        @click="onClick(option)"
      >
        <SmartsheetHeaderIcon :column="option" />
        <div>
          {{ option.title }}
        </div>
      </div>
    </div>
  </div>
</template>
